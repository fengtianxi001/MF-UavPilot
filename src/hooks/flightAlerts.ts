export const ALERT_LIMITS = Object.freeze({
  lowAltitude: 100,
  rapidDescent: -8,
})

export interface AlertState {
  altitude: number
  groundHeight: number | null
  verticalSpeed: number
  stalled: boolean
  crashed: boolean
  initializing?: boolean
  initializationError?: string
  outcome?: 'flying' | 'arrived' | 'crashed'
  terrainAhead?: {
    status: string
    seconds: number | null
    clearance: number | null
  }
}

export interface FlightAlert {
  id: string
  title: string
  message: string
}

// 使用原始物理状态，告警不经过仪表显示的平滑延迟。
export function getFlightAlerts(state: AlertState): FlightAlert[] {
  if (
    state.initializing ||
    state.initializationError ||
    state.outcome === 'arrived'
  )
    return []
  if (state.crashed)
    return [
      {
        id: 'ground-contact',
        title: '已触地 · 飞行结束',
        message: 'Aircraft stopped. Press R to restart from the configured origin.',
      },
    ]

  const alerts: FlightAlert[] = []
  if (state.terrainAhead?.status === 'risk')
    alerts.push({
      id: 'terrain-ahead',
      title: '前方地形风险',
      message: `Approx. ${state.terrainAhead.seconds?.toFixed(
        0
      )} s ahead, clearance is only ${state.terrainAhead.clearance?.toFixed(
        0
      )} m. Check terrain and adjust heading or altitude.`,
    })
  if (state.stalled)
    alerts.push({
      id: 'stall',
      title: '迎角失速',
      message: 'Lower the nose, reduce AoA, add throttle, avoid sharp turns.',
    })
  if (state.groundHeight !== null && Number.isFinite(state.groundHeight)) {
    const height = state.altitude - state.groundHeight
    if (Number.isFinite(height) && height < ALERT_LIMITS.lowAltitude)
      alerts.push({
        id: 'low-altitude',
        title: '离地高度过低',
        message: `Current AGL ${height.toFixed(
          1
        )} m. Watch terrain ahead and keep climb margin.`,
      })
  }
  if (
    Number.isFinite(state.verticalSpeed) &&
    state.verticalSpeed < ALERT_LIMITS.rapidDescent
  ) {
    alerts.push({
      id: 'rapid-descent',
      title: '快速下沉',
      message: `Descending at ${Math.abs(state.verticalSpeed).toFixed(
        1
      )} m/s. Check attitude, airspeed and AGL.`,
    })
  }
  return alerts
}
