import * as L from 'leaflet'
import { ref, onMounted, onBeforeUnmount, shallowRef, watch } from 'vue'
import { params } from './useUav'
import { routePlan } from './routePlan'
import { useI18n } from '@/i18n'

export function useLeaflet() {
  const { t } = useI18n()
  const container = ref<HTMLElement>()
  const map = shallowRef<L.Map>()
  const marker = shallowRef<L.Marker>()
  const following = ref(true)
  const headingUp = ref(true)
  let disposed = false
  let trail: L.Polyline | undefined
  let start: L.CircleMarker | undefined
  let destination: L.CircleMarker | undefined
  let plannedRoute: L.Polyline | undefined
  let points: L.LatLng[] = []
  let resizeObserver: ResizeObserver | undefined

  const updateHeading = () => {
    const heading = (params.heading * 180) / Math.PI
    // 插件 bearing 表示地图顺时针旋转角，因此取负航向使机头朝上。
    if (map.value) map.value.setBearing(headingUp.value ? -heading : 0)
    const arrow = marker.value
      ?.getElement()
      ?.querySelector<HTMLElement>('.heading-arrow')
    if (arrow)
      arrow.style.transform = `rotate(${
        heading + (map.value?.getBearing() ?? 0)
      }deg)`
  }
  const setMarkerPosition = (latlng: L.LatLngExpression) => {
    marker.value?.setLatLng(latlng)
    if (following.value) map.value?.panTo(latlng, { animate: false })
    const point = L.latLng(latlng)
    if (!points.length || point.distanceTo(points[points.length - 1]) >= 5) {
      points.push(point)
      if (points.length > 3000) points.shift()
      trail?.setLatLngs(points)
    }
    updateHeading()
  }
  const resetTrack = () => {
    points = [L.latLng(params.lat, params.lng)]
    start?.setLatLng(points[0])
    trail?.setLatLngs(points)
    setMarkerPosition(points[0])
  }

  const updateRoute = () => {
    const origin: L.LatLngTuple = [routePlan.start.lat, routePlan.start.lng]
    const target: L.LatLngTuple = [routePlan.end.lat, routePlan.end.lng]
    start?.setLatLng(origin)
    destination?.setLatLng(target)
    plannedRoute?.setLatLngs([origin, target])
  }

  onMounted(async () => {
    // 插件扩展 Leaflet 全局对象；使用同一份实例，避免仅旋转容器导致拖拽坐标错位。
    ;(globalThis as typeof globalThis & { L: typeof L }).L = L
    await import('leaflet-rotate/dist/leaflet-rotate.js')
    if (disposed || !container.value) return
    map.value = L.map(container.value, {
      rotate: true,
      bearing: headingUp.value ? (-params.heading * 180) / Math.PI : 0,
      rotateControl: false,
      shiftKeyRotate: false,
      pitchDrag: false,
      touchRotate: false,
      zoomControl: false,
      scrollWheelZoom: true,
    }).setView([params.lat, params.lng], 13)
    // 移除 Leaflet 品牌前缀，地图数据来源署名仍保留。
    map.value.attributionControl.setPrefix(false)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 10,
    }).addTo(map.value)
    destination = L.circleMarker([routePlan.end.lat, routePlan.end.lng], {
      radius: 6,
      color: '#fff2d6',
      fillColor: '#f5ae57',
      fillOpacity: 1,
      weight: 2,
    })
      .addTo(map.value)
      .bindTooltip(t('目标终点（手动飞行）'))
    plannedRoute = L.polyline([], {
      color: '#f5ae57',
      weight: 1.5,
      dashArray: '5 6',
      opacity: 0.8,
    }).addTo(map.value)
    trail = L.polyline([], {
      color: 'rgb(var(--primary-6))',
      weight: 2,
      opacity: 0.9,
    }).addTo(map.value)
    start = L.circleMarker([params.lat, params.lng], {
      radius: 5,
      color: '#eafbf4',
      fillColor: '#39b98b',
      fillOpacity: 1,
      weight: 2,
    })
      .addTo(map.value)
      .bindTooltip(t('飞行起点'))
    marker.value = L.marker([params.lat, params.lng], {
      icon: L.divIcon({
        className: 'uav-heading-marker',
        html: '<div class="heading-arrow"><svg viewBox="0 0 28 28" width="28" height="28"><path d="M14 2 L24 25 L14 20 L4 25 Z" fill="#78d8ff" stroke="#102e46" stroke-width="2"/></svg></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
      zIndexOffset: 1000,
    }).addTo(map.value)
    map.value.on('dragstart', () => {
      following.value = false
    })
    resizeObserver = new ResizeObserver(() => map.value?.invalidateSize())
    resizeObserver.observe(container.value)
    resetTrack()
    updateRoute()
  })
  watch(
    () => [params.lat, params.lng],
    () => setMarkerPosition([params.lat, params.lng])
  )
  watch(() => params.heading, updateHeading)
  watch(headingUp, updateHeading)
  watch(() => params.flightId, resetTrack)
  watch(() => routePlan.revision, updateRoute)
  watch(following, (value) => {
    if (value) map.value?.panTo([params.lat, params.lng], { animate: false })
  })
  onBeforeUnmount(() => {
    disposed = true
    resizeObserver?.disconnect()
    map.value?.remove()
    map.value = undefined
    marker.value = undefined
  })
  return { container, map, marker, following, headingUp, setMarkerPosition }
}
export default useLeaflet
