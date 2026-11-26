import type { RoutePoint } from './routePlan.ts'

const RADIUS = 6371008.8
const radians = (value: number) => (value * Math.PI) / 180
const clamp = (value: number) => Math.min(1, Math.max(-1, value))
const geometry = (start: RoutePoint, end: RoutePoint) => {
  const lat1 = radians(start.lat)
  const lat2 = radians(end.lat)
  const delta = radians(end.lng - start.lng)
  const h =
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(delta / 2) ** 2
  return {
    distance: 2 * RADIUS * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h)))),
    bearing:
      (Math.atan2(
        Math.sin(delta) * Math.cos(lat2),
        Math.cos(lat1) * Math.sin(lat2) -
          Math.sin(lat1) * Math.cos(lat2) * Math.cos(delta)
      ) +
        Math.PI * 2) %
      (Math.PI * 2),
  }
}

/** 当前无风无侧滑假设；横向偏差相对起终点大圆航线，右侧为正。 */
export function getNavigation(
  point: RoutePoint & {
    heading: number
    speed: number
    verticalSpeed: number
    /** 可选：有风时用实际航迹与地速估算接近率和 ETA。 */
    track?: number
    groundSpeed?: number
  },
  start: RoutePoint,
  end: RoutePoint,
  radius = 100
) {
  const target = geometry(point, end)
  const leg = geometry(start, end)
  const fromStart = geometry(start, point)
  const difference = target.bearing - point.heading
  const headingError = Math.atan2(Math.sin(difference), Math.cos(difference))
  const horizontalSpeed = Number.isFinite(point.groundSpeed)
    ? Math.max(0, point.groundSpeed! / 3.6)
    : Math.sqrt(
        Math.max(0, (point.speed / 3.6) ** 2 - point.verticalSpeed ** 2)
      )
  // 接近率按地面轨迹计算，风导致航迹偏移时仍给出正确 ETA。
  const groundTrack = Number.isFinite(point.track)
    ? point.track!
    : point.heading
  const trackError = Math.atan2(
    Math.sin(target.bearing - groundTrack),
    Math.cos(target.bearing - groundTrack)
  )
  const closingSpeed = horizontalSpeed * Math.cos(trackError)
  const crossTrackMeters =
    leg.distance < 0.01
      ? 0
      : RADIUS *
        Math.asin(
          clamp(
            Math.sin(fromStart.distance / RADIUS) *
              Math.sin(fromStart.bearing - leg.bearing)
          )
        )
  return {
    ...target,
    headingError,
    closingSpeed,
    etaSeconds:
      target.distance <= radius
        ? 0
        : closingSpeed > 0.5
        ? (target.distance - radius) / closingSpeed
        : null,
    crossTrackMeters,
  }
}
