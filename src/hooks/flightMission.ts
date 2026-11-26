import type { RoutePoint } from './routePlan.ts'

// 与 routeGeometry 使用相同半径；不运行时导入其模块，避免引入 Vue。
const EARTH_RADIUS = 6371008.8
const radians = (degrees: number) => (degrees * Math.PI) / 180
const degrees = (angle: number) => (angle * 180) / Math.PI
const clamp = (value: number) => Math.min(1, Math.max(-1, value))

export interface TerrainProbeState extends RoutePoint {
  /** 航向：弧度，正北为 0，顺时针为正。 */
  heading: number
  /** 总速度，km/h。 */
  speed: number
  /** 垂直速度，m/s，爬升为正。 */
  verticalSpeed: number
  /** 与地形高度使用相同基准的高度，m。 */
  altitude: number
  /** 可选：有风时的航迹角与地速，预测应沿实际地面轨迹。 */
  track?: number
  groundSpeed?: number
}

export interface TerrainProbe extends RoutePoint {
  seconds: number
  projectedAltitude: number
}

export interface TerrainAssessment {
  status: 'safe' | 'risk' | 'unknown'
  /** 最早风险时刻；safe/unknown 为 null。 */
  seconds: number | null
  /** risk 为该时刻净空，safe 为最小净空，unknown 为 null，单位 m。 */
  clearance: number | null
}

export interface MissionState {
  elapsedSeconds: number
  distanceMeters: number
  outcome: 'flying' | 'arrived' | 'crashed'
}

/** 球面前向测地；距离为 m，返回经度范围 [-180, 180)。 */
export function destinationPoint(
  point: RoutePoint,
  headingRadians: number,
  distanceMeters: number
): RoutePoint {
  const lat = radians(point.lat)
  const angularDistance = distanceMeters / EARTH_RADIUS
  const nextLat = Math.asin(
    clamp(
      Math.sin(lat) * Math.cos(angularDistance) +
        Math.cos(lat) * Math.sin(angularDistance) * Math.cos(headingRadians)
    )
  )
  const nextLng =
    radians(point.lng) +
    Math.atan2(
      Math.sin(headingRadians) * Math.sin(angularDistance) * Math.cos(lat),
      Math.cos(angularDistance) - Math.sin(lat) * Math.sin(nextLat)
    )
  return {
    lat: degrees(nextLat),
    lng: ((((degrees(nextLng) + 180) % 360) + 360) % 360) - 180,
  }
}

/**
 * 演示预测：假设未来 20 秒航迹、地速及垂直速度保持不变。
 * 无风时航迹等于机头航向，地速取总速水平分量。
 */
export function createTerrainProbe(state: TerrainProbeState): TerrainProbe[] {
  const horizontalSpeed = Number.isFinite(state.groundSpeed)
    ? Math.max(0, state.groundSpeed! / 3.6)
    : Math.sqrt(
        Math.max(0, (state.speed / 3.6) ** 2 - state.verticalSpeed ** 2)
      )
  const track = Number.isFinite(state.track) ? state.track! : state.heading
  return Array.from({ length: 10 }, (_, index) => {
    const seconds = (index + 1) * 2
    return {
      ...destinationPoint(state, track, horizontalSpeed * seconds),
      seconds,
      projectedAltitude: state.altitude + state.verticalSpeed * seconds,
    }
  })
}

/** 任一缺测则整组 unknown，但已知风险优先；恰好等于阈值不算 risk。 */
export function assessTerrain(
  probes: readonly TerrainProbe[],
  heights: readonly (number | null | undefined)[],
  clearance = 100
): TerrainAssessment {
  let missing = probes.length === 0
  let minimum = Infinity
  let risk: TerrainAssessment | null = null
  for (let index = 0; index < probes.length; index += 1) {
    const probe = probes[index]!
    const height = heights[index]
    if (
      typeof height !== 'number' ||
      !Number.isFinite(height) ||
      !Number.isFinite(probe.projectedAltitude) ||
      !Number.isFinite(probe.seconds)
    ) {
      missing = true
      continue
    }
    const gap = probe.projectedAltitude - height
    minimum = Math.min(minimum, gap)
    if (gap < clearance && (risk === null || probe.seconds < risk.seconds!)) {
      risk = { status: 'risk', seconds: probe.seconds, clearance: gap }
    }
  }
  if (risk) return risk
  if (missing) return { status: 'unknown', seconds: null, clearance: null }
  return { status: 'safe', seconds: null, clearance: minimum }
}

export function createMissionState(): MissionState {
  return { elapsedSeconds: 0, distanceMeters: 0, outcome: 'flying' }
}

// 纯球面几何，与 routeGeometry 的 haversine 距离定义一致。
function geometry(start: RoutePoint, end: RoutePoint) {
  const lat1 = radians(start.lat)
  const lat2 = radians(end.lat)
  const deltaLng = radians(end.lng - start.lng)
  const haversine =
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2
  return {
    angle: 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, haversine)))),
    bearing: Math.atan2(
      Math.sin(deltaLng) * Math.cos(lat2),
      Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng)
    ),
  }
}

function entersRadius(
  previous: RoutePoint,
  current: RoutePoint,
  end: RoutePoint,
  segment: ReturnType<typeof geometry>,
  radius: number
): boolean {
  const target = geometry(previous, end)
  if (
    target.angle * EARTH_RADIUS <= radius ||
    geometry(current, end).angle * EARTH_RADIUS <= radius
  )
    return true
  if (segment.angle === 0) return false

  // 在本帧最短大圆弧上求垂足；经线跨界和高纬度不依赖经纬度线性插值。
  const bearingDelta = target.bearing - segment.bearing
  const along = Math.atan2(
    Math.sin(target.angle) * Math.cos(bearingDelta),
    Math.cos(target.angle)
  )
  const across = Math.asin(
    clamp(Math.sin(target.angle) * Math.sin(bearingDelta))
  )
  return (
    along >= 0 &&
    along <= segment.angle &&
    Math.abs(across) * EARTH_RADIUS <= radius
  )
}

/**
 * 演示任务：默认 100m 水平圆判定表示到达，并非降落，不检查高度。
 * 每帧轨迹视为前后位置间最短大圆弧（对跖点无法唯一确定轨迹）。
 * 不修改输入；结束后冻结；触地优先于本帧到达。
 */
export function updateMission(
  mission: MissionState,
  previous: RoutePoint,
  current: RoutePoint,
  end: RoutePoint,
  dt: number,
  crashed = false,
  radius = 100
): MissionState {
  if (mission.outcome !== 'flying') return mission
  const segment = geometry(previous, current)
  const distance = segment.angle * EARTH_RADIUS
  return {
    elapsedSeconds:
      mission.elapsedSeconds + (Number.isFinite(dt) && dt > 0 ? dt : 0),
    distanceMeters:
      mission.distanceMeters + (Number.isFinite(distance) ? distance : 0),
    outcome: crashed
      ? 'crashed'
      : entersRadius(previous, current, end, segment, radius)
      ? 'arrived'
      : 'flying',
  }
}
