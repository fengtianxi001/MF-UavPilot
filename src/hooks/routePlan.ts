import { reactive } from 'vue'

export interface RoutePoint {
  lat: number
  lng: number
}
export interface FlightRoute {
  start: RoutePoint & {
    altitude: number
    heightReference?: 'agl' | 'ellipsoid'
  }
  end: RoutePoint
  arrivalRadius?: number
}

export const mapPicker = reactive({
  target: null as 'start' | 'end' | null,
  selection: null as {
    target: 'start' | 'end'
    lat: number
    lng: number
  } | null,
  revision: 0,
})

// 只发布选点结果，由表单填入草稿；不直接应用航线或重置飞行。
export function selectMapPoint(point: RoutePoint) {
  if (!mapPicker.target) return false
  if (
    !Number.isFinite(point.lat) ||
    Math.abs(point.lat) > 85 ||
    !Number.isFinite(point.lng) ||
    Math.abs(point.lng) > 180
  )
    return false
  mapPicker.selection = {
    target: mapPicker.target,
    lat: point.lat,
    lng: point.lng,
  }
  mapPicker.revision += 1
  mapPicker.target = null
  return true
}

export const routePlan = reactive<FlightRoute & { revision: number }>({
  start: { lat: 29.83, lng: 119.86, altitude: 500, heightReference: 'agl' },
  end: { lat: 29.83, lng: 119.8 },
  arrivalRadius: 100,
  revision: 0,
})

export function routeGeometry(start: RoutePoint, end: RoutePoint) {
  const radians = (value: number) => (value * Math.PI) / 180
  const lat1 = radians(start.lat)
  const lat2 = radians(end.lat)
  const deltaLat = lat2 - lat1
  const deltaLng = radians(end.lng - start.lng)
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2
  const distance =
    6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))))
  const bearing =
    (Math.atan2(
      Math.sin(deltaLng) * Math.cos(lat2),
      Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng)
    ) +
      Math.PI * 2) %
    (Math.PI * 2)
  return { distance, bearing }
}

export function validateRoute(route: FlightRoute): string | null {
  for (const point of [route.start, route.end]) {
    if (!Number.isFinite(point.lat) || Math.abs(point.lat) > 85)
      return '纬度须在 -85° 至 85° 之间（地图支持范围）'
    if (!Number.isFinite(point.lng) || Math.abs(point.lng) > 180)
      return '经度须在 -180° 至 180° 之间'
  }
  if (
    route.start.heightReference === 'agl' &&
    (!Number.isFinite(route.start.altitude) ||
      route.start.altitude < 10 ||
      route.start.altitude > 10000)
  ) {
    return '初始离地高度须在 10 至 10000 米之间'
  }
  if (
    route.arrivalRadius !== undefined &&
    (!Number.isFinite(route.arrivalRadius) ||
      route.arrivalRadius < 25 ||
      route.arrivalRadius > 1000)
  ) {
    return '到达半径须在 25 至 1000 米之间'
  }
  if (
    !Number.isFinite(route.start.altitude) ||
    route.start.altitude < -500 ||
    route.start.altitude > 20000
  ) {
    return '初始椭球高度须在 -500 至 20000 米之间'
  }
  if (routeGeometry(route.start, route.end).distance < 10)
    return '起点和终点至少相距 10 米'
  if (
    routeGeometry(route.start, route.end).distance <=
    (route.arrivalRadius ?? 100)
  ) {
    return '起点须位于终点到达范围之外'
  }
  return null
}

export function applyRoute(route: FlightRoute) {
  const error = validateRoute(route)
  if (error) return error
  routePlan.start = { ...route.start }
  routePlan.end = { ...route.end }
  routePlan.arrivalRadius = route.arrivalRadius ?? 100
  routePlan.revision += 1
  return null
}
