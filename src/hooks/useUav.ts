import {
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  watch,
} from 'vue'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import {
  createFlightState,
  FlightDynamics,
  FLIGHT_STEP,
} from './flightDynamics'
import { resolveGroundContact } from './groundContact'
import { routePlan, routeGeometry } from './routePlan'
import { advancePropeller } from './propeller'
import {
  createMissionState,
  updateMission,
  createTerrainProbe,
  assessTerrain,
  type TerrainAssessment,
} from './flightMission'
import { queryTerrainHeights } from './terrainSampling'
import { windSettings, windAt } from './wind'
import {
  weatherSettings,
  WEATHER_PRESETS,
  getWeatherPreset,
  weatherRenderParams,
  rainParams,
  fogParams,
} from './weather'
import { RainLayer } from './rainLayer'
import { FogLayer } from './fogLayer'

export interface TerrainProfile {
  status: 'waiting' | 'loading' | 'ready' | 'stale' | 'error'
  sampledAt: number | null
  message: string
  samples: {
    seconds: number
    height: number | null
    projectedAltitude: number
  }[]
}
const emptyTerrainProfile = (): TerrainProfile => ({
  status: 'waiting',
  sampledAt: null,
  message: '等待前方地形采样',
  samples: [],
})

export const params = reactive({
  ...createFlightState(routePlan.start.altitude),
  paused: false,
  crashed: false,
  groundHeight: null as number | null,
  flightId: 0,
  ...createMissionState(),
  initializing: true,
  initializationError: '',
  terrainAhead: {
    status: 'unknown',
    seconds: null,
    clearance: null,
  } as TerrainAssessment,
  terrainProfile: emptyTerrainProfile(),
  windEnabled: windSettings.enabled,
  windFromDegrees: windSettings.fromDegrees,
  windBaseSpeed: windSettings.speed,
  windGustSpeed: windSettings.gustSpeed,
  windGustPeriod: windSettings.gustPeriodSeconds,
  weatherPreset: weatherSettings.preset,
})

export function useUav() {
  type CameraMode = 'chase' | 'cockpit' | 'free'
  const cameraMode = ref<CameraMode>('chase')
  const container = ref<HTMLElement>()
  const viewer = shallowRef<Cesium.Viewer>()
  const uav = shallowRef<Cesium.Entity>()

  const dynamics = new FlightDynamics()
  const keys = new Set<string>()
  const controlCodes = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE'])
  const positionProperty = new Cesium.ConstantPositionProperty()
  const orientationProperty = new Cesium.ConstantProperty()
  const position = new Cesium.Cartesian3()
  const orientation = new Cesium.Quaternion()
  let propellerAngle = 0
  const propellerRotation = new Cesium.Quaternion()
  const propellerRotationProperty = new Cesium.ConstantProperty(
    Cesium.Quaternion.IDENTITY
  )

  const updatePropeller = () => {
    Cesium.Quaternion.fromAxisAngle(
      Cesium.Cartesian3.UNIT_Z,
      propellerAngle,
      propellerRotation
    )
    propellerRotationProperty.setValue(propellerRotation)
  }
  let animationId = 0
  let lastTime: number | undefined
  let accumulator = 0
  let disposed = false
  let initializationGeneration = 0
  let windElapsed = 0
  let lastTerrainRequest = -Infinity
  let lastTerrainResult = -Infinity
  let terrainRequestPending = false
  let terrainHeading = 0
  let removeCameraFollow: (() => void) | undefined
  let rainLayer: RainLayer | undefined
  let fogLayer: FogLayer | undefined
  // 固定后上方追踪机位，距离单位为米；地平线保持水平，不跟随机体滚转。
  const cameraOffset = new Cesium.HeadingPitchRange(0, -Math.PI / 4, 28)
  const cockpitTransform = new Cesium.Matrix4()
  const cockpitPosition = new Cesium.Cartesian3()
  const cockpitDirection = new Cesium.Cartesian3()
  const cockpitUp = new Cesium.Cartesian3()
  const orbitTransform = new Cesium.Matrix4()
  const orbitOffset = new Cesium.Cartesian3()

  const followCamera = () => {
    const activeViewer = viewer.value
    if (!activeViewer || !uav.value) return
    if (cameraMode.value === 'free') {
      // 保留用户在飞机局部 ENU 坐标系中的观察角度和距离，只移动观察中心。
      Cesium.Cartesian3.clone(activeViewer.camera.position, orbitOffset)
      Cesium.Transforms.eastNorthUpToFixedFrame(
        position,
        undefined,
        orbitTransform
      )
      activeViewer.camera.lookAtTransform(orbitTransform, orbitOffset)
      return
    }
    if (cameraMode.value === 'cockpit') {
      const { heading, pitch, roll } = params
      const forward = new Cesium.Cartesian3(
        Math.sin(heading) * Math.cos(pitch),
        Math.cos(heading) * Math.cos(pitch),
        Math.sin(pitch)
      )
      const right = new Cesium.Cartesian3(
        Math.cos(heading),
        -Math.sin(heading),
        0
      )
      const up = Cesium.Cartesian3.cross(
        right,
        forward,
        new Cesium.Cartesian3()
      )
      const rolledUp = Cesium.Cartesian3.add(
        Cesium.Cartesian3.multiplyByScalar(up, Math.cos(roll), up),
        Cesium.Cartesian3.multiplyByScalar(right, Math.sin(roll), right),
        up
      )
      Cesium.Transforms.eastNorthUpToFixedFrame(
        position,
        undefined,
        cockpitTransform
      )
      // 近似机头观察点：沿前方 2 米、竖直上方 0.8 米，无座舱内饰。
      const eye = Cesium.Cartesian3.multiplyByScalar(
        forward,
        2,
        new Cesium.Cartesian3()
      )
      eye.z += 0.8
      Cesium.Matrix4.multiplyByPoint(cockpitTransform, eye, cockpitPosition)
      Cesium.Matrix4.multiplyByPointAsVector(
        cockpitTransform,
        forward,
        cockpitDirection
      )
      Cesium.Matrix4.multiplyByPointAsVector(
        cockpitTransform,
        rolledUp,
        cockpitUp
      )
      activeViewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
      activeViewer.camera.setView({
        destination: cockpitPosition,
        orientation: { direction: cockpitDirection, up: cockpitUp },
      })
      return
    }
    cameraOffset.heading = params.heading
    activeViewer.camera.lookAt(position, cameraOffset)
  }

  const setCameraMode = (mode: CameraMode) => {
    const previousMode = cameraMode.value
    cameraMode.value = mode
    const activeViewer = viewer.value
    if (!activeViewer) return
    activeViewer.camera.cancelFlight()
    // 离开上一模式坐标系，再建立新的围绕飞机观察中心。
    activeViewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
    if (mode === 'free') {
      if (previousMode === 'cockpit') {
        // 座舱距离太近，切入自由观察时先退到默认距离。
        cameraOffset.heading = params.heading
        activeViewer.camera.lookAt(position, cameraOffset)
      } else {
        Cesium.Transforms.eastNorthUpToFixedFrame(
          position,
          undefined,
          orbitTransform
        )
        activeViewer.camera.lookAtTransform(orbitTransform)
      }
    }
    const controller = activeViewer.scene.screenSpaceCameraController
    const free = mode === 'free'
    controller.enableRotate = free
    controller.enableTranslate = false
    controller.enableTilt = free
    controller.enableLook = false
    controller.enableZoom = free
    followCamera()
  }
  const resetCamera = () => setCameraMode('chase')

  // 天气只影响渲染与风场，不改变气动力；切换后立即生效。
  const applyWeather = () => {
    const activeViewer = viewer.value
    if (!activeViewer) return
    const {
      fogDensity,
      brightness,
      saturation,
      lightIntensity,
      shadowDarkness,
    } = weatherRenderParams(params.weatherPreset)
    const { scene } = activeViewer
    scene.fog.density = fogDensity
    scene.globe.atmosphereBrightnessShift = brightness
    scene.globe.atmosphereSaturationShift = saturation
    if (scene.light instanceof Cesium.SunLight) {
      scene.light.intensity = lightIntensity
    }
    scene.shadowMap.darkness = shadowDarkness
  }

  /** 切换天气时载入该预设的风场参数，用户之后仍可手动微调。 */
  const applyWeatherWind = () => {
    const preset = getWeatherPreset(params.weatherPreset)
    params.windFromDegrees = preset.wind.fromDegrees
    params.windBaseSpeed = preset.wind.speed
    params.windGustSpeed = preset.wind.gustSpeed
    params.windGustPeriod = preset.wind.gustPeriodSeconds
  }

  /** 雨幕覆盖在 Cesium 画布上，只作视觉呈现。 */
  const applyRain = () => {
    if (!rainLayer || !viewer.value) return
    const options = rainParams(params.weatherPreset)
    if (options.count > 0) {
      if (rainLayer.element.parentElement !== viewer.value.container) {
        viewer.value.container.appendChild(rainLayer.element)
      }
      // 雨丝需要绘制在雾幕之上，否则会被浓雾遮盖。
      rainLayer.element.style.zIndex = '3'
      rainLayer.setOptions(options)
    } else {
      rainLayer.hide()
    }
  }

  /** 雾团层放在雨幕之下，避免浓雾盖住雨丝。 */
  const applyFog = () => {
    if (!fogLayer || !viewer.value) return
    const options = fogParams(params.weatherPreset)
    if (options.opacity > 0) {
      if (fogLayer.element.parentElement !== viewer.value.container) {
        viewer.value.container.appendChild(fogLayer.element)
      }
      fogLayer.element.style.zIndex = '2'
      fogLayer.setOptions(options)
    } else {
      fogLayer.hide()
    }
  }
  //初始化cesium
  const boostrapViewer = async () => {
    const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN?.trim()
    const terrainUrl = import.meta.env.VITE_CESIUM_TERRAIN_URL?.trim()
    let terrainProvider: Cesium.TerrainProvider =
      new Cesium.EllipsoidTerrainProvider()

    try {
      if (ionToken && !terrainUrl) {
        Cesium.Ion.defaultAccessToken = ionToken
        terrainProvider = await Cesium.createWorldTerrainAsync()
      } else {
        // 公开示例服务无需 ion Token，可通过环境变量替换为其他地形源。
        terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl(
          terrainUrl || 'https://data.mars3d.cn/terrain/'
        )
      }
      terrainProvider.errorEvent.addEventListener((error) => {
        console.warn('真实地形切片加载失败，部分区域可能缺少山地起伏。', error)
      })
    } catch (error) {
      console.warn(
        '真实地形服务不可用，暂用椭球地形（无山地起伏）。请检查 VITE_CESIUM_TERRAIN_URL 或配置有效的 VITE_CESIUM_ION_TOKEN。',
        error
      )
    }

    if (disposed || !container.value) return
    viewer.value = new Cesium.Viewer(container.value, {
      infoBox: false,
      selectionIndicator: false,
      animation: false,
      baseLayerPicker: false,
      geocoder: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      homeButton: false,
      sceneModePicker: false,
      timeline: false,
      shadows: true,
      shouldAnimate: true,
      terrainProvider,
      // 公开卫星影像不依赖 ion Token，ArcGIS Provider 自动读取服务署名。
      baseLayer: Cesium.ImageryLayer.fromProviderAsync(
        Cesium.ArcGisMapServerImageryProvider.fromUrl(
          'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
        )
      ),
    })
    const { scene, clock } = viewer.value
    // 演示从起飞位置的近似地方太阳时 10:00 开始，避免启动时恰好处于夜间。
    // 太阳方向仍由日期、地理位置和模拟时钟计算，不随相机转动。
    const daylight = new Date()
    daylight.setUTCHours(0, 0, 0, 0)
    daylight.setUTCSeconds((10 - params.lng / 15) * 60 * 60)
    clock.currentTime = Cesium.JulianDate.fromDate(daylight)
    clock.multiplier = 1

    scene.light = new Cesium.SunLight({ intensity: 2.0 })
    scene.atmosphere.dynamicLighting =
      Cesium.DynamicAtmosphereLightingType.SUNLIGHT
    scene.globe.enableLighting = true
    scene.globe.dynamicAtmosphereLighting = true
    scene.globe.dynamicAtmosphereLightingFromSun = true
    scene.globe.depthTestAgainstTerrain = true
    scene.shadowMap.softShadows = true
    scene.shadowMap.darkness = 0.25
    rainLayer = new RainLayer()
    fogLayer = new FogLayer()
    applyWeather()
    applyFog()
    applyRain()
  }

  //加载无人机模型
  const onLoadModel = (url: string) => {
    // 当前 uav.glb 原始翼展约 1.591 米，按 TB2 约 12 米翼展等比定标。
    // 仅校准尺寸基准，模型本身的机身/机翼比例保持不变。
    const modelWingspanMeters = 1.590956814513043
    const targetWingspanMeters = 12
    onAdjustAttitude()
    const entity = viewer.value!.entities.add({
      name: 'uav',
      position: positionProperty,
      orientation: orientationProperty,
      model: {
        show: new Cesium.CallbackProperty(
          () =>
            !params.initializing &&
            !params.initializationError &&
            cameraMode.value !== 'cockpit',
          false
        ),
        uri: url,
        scale: targetWingspanMeters / modelWingspanMeters,
        // 禁用屏幕像素保底放大，保证远近距离下使用同一真实尺寸。
        minimumPixelSize: 0,
        // 关闭原有恒速动画，单独驱动已确认的螺旋桨节点 Cone。
        runAnimations: false,
        nodeTransformations: {
          Cone: new Cesium.TranslationRotationScale(),
        },
        // 使用场景太阳光，保留材质本身的明暗与高光，不单独强行提亮。
        shadows: Cesium.ShadowMode.ENABLED,
        imageBasedLightingFactor: new Cesium.Cartesian2(1.0, 1.0),
        environmentMapOptions: {
          enabled: true,
          brightness: 1.15,
          saturation: 1.0,
          groundAlbedo: 0.31,
          maximumSecondsDifference: 60,
          maximumPositionEpsilon: 250,
        },
      },
    })
    entity.model!.nodeTransformations.Cone.rotation = propellerRotationProperty
    uav.value = entity
    // 默认 trackedEntity 只跟随位置，不能保证镜头与机头航向一致。
    setCameraMode(cameraMode.value)
    removeCameraFollow =
      viewer.value!.scene.preRender.addEventListener(followCamera)
    followCamera()
  }
  // 只同步渲染属性，不在这里重复修改位移和高度。
  const onAdjustAttitude = () => {
    const { lng, lat, altitude, heading, pitch, roll } = params
    Cesium.Cartesian3.fromDegrees(lng, lat, altitude, undefined, position)
    // glTF 机头沿局部 X 轴；将正北为零的真航向转换为 Cesium 模型朝向。
    const hpr = new Cesium.HeadingPitchRoll(heading - Math.PI / 2, pitch, roll)
    Cesium.Transforms.headingPitchRollQuaternion(
      position,
      hpr,
      undefined,
      undefined,
      orientation
    )
    positionProperty.setValue(position)
    orientationProperty.setValue(orientation)
  }

  const clearInput = () => {
    keys.clear()
    lastTime = undefined
    accumulator = 0
  }

  const resetFlight = async () => {
    const generation = ++initializationGeneration
    const start = { ...routePlan.start }
    const end = { ...routePlan.end }
    clearInput()
    params.initializing = true
    params.initializationError = ''
    params.terrainAhead = { status: 'unknown', seconds: null, clearance: null }
    params.terrainProfile = emptyTerrainProfile()
    if (viewer.value) viewer.value.clock.shouldAnimate = false
    let groundHeight: number | null = null
    let altitude = start.altitude
    try {
      if (!viewer.value) throw new Error('地图尚未就绪。')
      if (start.heightReference === 'agl') {
        ;[groundHeight] = await queryTerrainHeights(
          viewer.value.terrainProvider,
          [start]
        )
        altitude = groundHeight! + start.altitude
      }
      if (!Number.isFinite(altitude) || altitude < -500 || altitude > 20000) {
        throw new Error(
          '地形加离地高度超出当前仿真支持范围（-500 至 20000 米）。'
        )
      }
    } catch (error) {
      if (disposed || generation !== initializationGeneration) return false
      params.initializing = false
      params.initializationError =
        error instanceof Error ? error.message : '地形查询失败，请重试。'
      params.paused = true
      return false
    }
    if (disposed || generation !== initializationGeneration) return false
    dynamics.reset()
    propellerAngle = 0
    updatePropeller()
    params.flightId += 1
    Object.assign(params, createFlightState(altitude), createMissionState(), {
      lat: start.lat,
      lng: start.lng,
      heading: routeGeometry(start, end).bearing,
      paused: false,
      crashed: false,
      groundHeight,
      initializing: false,
      initializationError: '',
    })
    lastTerrainRequest = -Infinity
    lastTerrainResult = -Infinity
    windElapsed = 0
    // 只同步航迹与漂移等派生字段；windAt 的 speed/fromDegrees 语义与飞行状态不同，
    // 直接合并会覆盖真空速和风向设置。
    const initialWind = windAt(windSettings, 0)
    params.windSpeed = initialWind.speed
    params.windFromDegrees = initialWind.fromDegrees
    if (viewer.value) viewer.value.clock.shouldAnimate = true
    onAdjustAttitude()
    resetCamera()
    return true
  }

  watch(
    () => routePlan.revision,
    () => {
      if (viewer.value && uav.value) resetFlight()
    }
  )

  // 界面风参数写入共享设置；立即生效，无需重置飞行。
  watch(
    () => [
      params.windEnabled,
      params.windFromDegrees,
      params.windBaseSpeed,
      params.windGustSpeed,
      params.windGustPeriod,
    ],
    () => {
      windSettings.enabled = Boolean(params.windEnabled)
      windSettings.fromDegrees = Number.isFinite(params.windFromDegrees)
        ? params.windFromDegrees
        : 0
      windSettings.speed = Math.max(0, params.windBaseSpeed || 0)
      windSettings.gustSpeed = Math.max(0, params.windGustSpeed || 0)
      windSettings.gustPeriodSeconds = Math.max(2, params.windGustPeriod || 11)
    }
  )

  watch(
    () => params.weatherPreset,
    () => {
      weatherSettings.preset = params.weatherPreset
      applyWeatherWind()
      applyWeather()
      applyFog()
      applyRain()
    }
  )

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      (target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest('input, textarea, select, [role="textbox"]')))
    ) {
      return
    }
    if (event.code === 'KeyC') {
      event.preventDefault()
      if (event.repeat || params.initializing || params.initializationError)
        return
      const modes: CameraMode[] = ['chase', 'cockpit', 'free']
      const current = modes.indexOf(cameraMode.value)
      setCameraMode(modes[(current + 1) % modes.length])
    } else if (event.code === 'KeyT') {
      // 循环切换天气预设；视觉与风场由 weatherPreset 监听统一应用。
      event.preventDefault()
      if (event.repeat) return
      const presets = WEATHER_PRESETS.map((preset) => preset.id)
      const current = presets.indexOf(params.weatherPreset)
      params.weatherPreset = presets[(current + 1) % presets.length]
    } else if (
      event.code === 'KeyP' ||
      event.code === 'Space' ||
      event.code === 'KeyR'
    ) {
      event.preventDefault()
      if (event.repeat) return
      if (event.code === 'KeyR') {
        void resetFlight()
      } else if (
        !params.crashed &&
        params.outcome === 'flying' &&
        !params.initializing &&
        !params.initializationError
      ) {
        params.paused = !params.paused
        clearInput()
        if (viewer.value) viewer.value.clock.shouldAnimate = !params.paused
      }
    } else if (controlCodes.has(event.code)) {
      event.preventDefault()
      if (
        !params.paused &&
        !params.crashed &&
        params.outcome === 'flying' &&
        !params.initializing &&
        !params.initializationError
      )
        keys.add(event.code)
    }
  }

  const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code)

  const checkGroundContact = () => {
    const activeViewer = viewer.value
    if (!activeViewer) return false
    const cartographic = Cesium.Cartographic.fromDegrees(params.lng, params.lat)
    // 只读取已加载的地形，不在每个物理步发网络请求。
    const height =
      activeViewer.terrainProvider instanceof Cesium.EllipsoidTerrainProvider
        ? 0
        : activeViewer.scene.globe.getHeight(cartographic)
    // 地形缓存可能含网络异常产生的极端值；超出合理范围时视为缺测，避免误判触地。
    const valid =
      height !== undefined &&
      Number.isFinite(height) &&
      height >= -500 &&
      height <= 9000
    params.groundHeight = valid ? (height as number) : null
    if (!resolveGroundContact(params, valid ? height : undefined)) return false
    params.paused = false
    clearInput()
    activeViewer.clock.shouldAnimate = false
    if (uav.value?.model) {
      uav.value.model.runAnimations = new Cesium.ConstantProperty(false)
    }
    return true
  }

  const finishMission = () => {
    clearInput()
    if (viewer.value) viewer.value.clock.shouldAnimate = false
    params.terrainAhead = { status: 'unknown', seconds: null, clearance: null }
    params.terrainProfile = {
      ...params.terrainProfile,
      status: 'stale',
      message: '飞行已结束，预测不再更新',
    }
  }

  const checkTerrainAhead = (now: number) => {
    const headingDelta = Math.abs(
      Math.atan2(
        Math.sin(params.heading - terrainHeading),
        Math.cos(params.heading - terrainHeading)
      )
    )
    if (now - lastTerrainResult > 5000 || headingDelta > Math.PI / 12) {
      params.terrainAhead = {
        status: 'unknown',
        seconds: null,
        clearance: null,
      }
      if (params.terrainProfile.status === 'ready') {
        params.terrainProfile.status = 'stale'
        params.terrainProfile.message =
          headingDelta > Math.PI / 12
            ? '航向已变化，等待重新采样'
            : '地形样本已过期，等待更新'
      }
    }
    if (
      terrainRequestPending ||
      now - lastTerrainRequest < 2000 ||
      !viewer.value
    )
      return
    const probes = createTerrainProbe(params)
    const snapshot = {
      lat: params.lat,
      lng: params.lng,
      heading: params.heading,
    }
    const flightId = params.flightId
    const generation = initializationGeneration
    lastTerrainRequest = now
    terrainRequestPending = true
    if (params.terrainProfile.status !== 'ready') {
      params.terrainProfile.status = 'loading'
      params.terrainProfile.message = '正在查询前方地形'
    }
    void queryTerrainHeights(viewer.value.terrainProvider, probes)
      .then((heights) => {
        if (
          disposed ||
          generation !== initializationGeneration ||
          flightId !== params.flightId ||
          params.outcome !== 'flying' ||
          params.initializing ||
          params.paused
        )
          return
        const angle = Math.abs(
          Math.atan2(
            Math.sin(params.heading - snapshot.heading),
            Math.cos(params.heading - snapshot.heading)
          )
        )
        // 过期/急转弯后返回的样本不再代表当前航向。
        if (
          angle > Math.PI / 12 ||
          routeGeometry(snapshot, params).distance > 150
        ) {
          params.terrainProfile.status = 'stale'
          params.terrainProfile.message = '飞机位置或航向已变化，等待重新采样'
          return
        }
        const age = (performance.now() - now) / 1000
        if (age > 5) {
          params.terrainProfile.status = 'stale'
          params.terrainProfile.message = '查询耗时过长，样本已过期'
          return
        }
        const upcoming = probes
          .map((probe, index) => ({
            probe: {
              ...probe,
              seconds: probe.seconds - age,
              projectedAltitude:
                params.altitude +
                params.verticalSpeed * Math.max(0, probe.seconds - age),
            },
            height: heights[index],
          }))
          .filter((item) => item.probe.seconds > 0)
        params.terrainAhead = assessTerrain(
          upcoming.map((item) => item.probe),
          upcoming.map((item) => item.height)
        )
        terrainHeading = snapshot.heading
        lastTerrainResult = performance.now()
        params.terrainProfile = {
          status: 'ready',
          sampledAt: Date.now(),
          message: '当前航向中心线预测',
          samples: upcoming.map((item) => ({
            seconds: item.probe.seconds,
            height: Number.isFinite(item.height) ? item.height : null,
            projectedAltitude: item.probe.projectedAltitude,
          })),
        }
      })
      .catch(() => {
        if (
          !disposed &&
          generation === initializationGeneration &&
          flightId === params.flightId
        ) {
          params.terrainAhead = {
            status: 'unknown',
            seconds: null,
            clearance: null,
          }
          params.terrainProfile = {
            ...params.terrainProfile,
            status: 'error',
            message: '地形查询失败 / 缺测，请检查地形服务',
          }
        }
      })
      .finally(() => {
        terrainRequestPending = false
      })
  }

  const renderer = (timestamp: number) => {
    if (disposed) return
    if (
      !params.paused &&
      !params.crashed &&
      params.outcome === 'flying' &&
      !params.initializing &&
      !params.initializationError &&
      !document.hidden
    ) {
      if (lastTime !== undefined) {
        accumulator += Math.min((timestamp - lastTime) / 1000, 0.1)
      }
      const input = {
        pitch: Number(keys.has('KeyW')) - Number(keys.has('KeyS')),
        roll: Number(keys.has('KeyD')) - Number(keys.has('KeyA')),
        throttle: Number(keys.has('KeyQ')) - Number(keys.has('KeyE')),
      }
      // 同时检查延迟加载的地形是否已覆盖飞机。
      let contacted = checkGroundContact()
      if (contacted) {
        Object.assign(
          params,
          updateMission(
            params,
            params,
            params,
            routePlan.end,
            0,
            true,
            routePlan.arrivalRadius
          )
        )
        finishMission()
      }
      while (!contacted && accumulator >= FLIGHT_STEP) {
        const previous = { lat: params.lat, lng: params.lng }
        windElapsed += FLIGHT_STEP
        dynamics.step(
          params,
          input,
          FLIGHT_STEP,
          windAt(windSettings, windElapsed)
        )
        propellerAngle = advancePropeller(
          propellerAngle,
          params.throttle,
          FLIGHT_STEP
        )
        accumulator -= FLIGHT_STEP
        contacted = checkGroundContact()
        Object.assign(
          params,
          updateMission(
            params,
            previous,
            params,
            routePlan.end,
            FLIGHT_STEP,
            contacted,
            routePlan.arrivalRadius
          )
        )
        if (params.outcome !== 'flying') {
          finishMission()
          break
        }
      }
      updatePropeller()
      if (!contacted && params.outcome === 'flying') {
        lastTime = timestamp
        checkTerrainAhead(timestamp)
      }
      onAdjustAttitude()
    } else {
      lastTime = undefined
      accumulator = 0
    }
    animationId = requestAnimationFrame(renderer)
  }

  onMounted(async () => {
    await boostrapViewer()
    if (disposed || !viewer.value) return
    onLoadModel(`${import.meta.env.VITE_API_DOMAIN}/models/uav.glb`)
    void resetFlight()
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    document.addEventListener('visibilitychange', clearInput)
    window.addEventListener('blur', clearInput)
    animationId = requestAnimationFrame(renderer)
  })

  onBeforeUnmount(() => {
    disposed = true
    rainLayer?.destroy()
    rainLayer = undefined
    fogLayer?.destroy()
    fogLayer = undefined
    initializationGeneration++
    cancelAnimationFrame(animationId)
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('keyup', onKeyUp)
    document.removeEventListener('visibilitychange', clearInput)
    window.removeEventListener('blur', clearInput)
    clearInput()
    removeCameraFollow?.()
    viewer.value?.destroy()
    viewer.value = undefined
    uav.value = undefined
  })

  return {
    container,
    viewer,
    restartFlight: resetFlight,
    cameraMode,
    setCameraMode,
    resetCamera,
  }
}
