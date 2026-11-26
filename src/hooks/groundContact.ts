import type { FlightState } from './flightDynamics.ts'

// 模型原点下方 1 米的触地探针，非完整机翼/起落架碰撞体。
export const GROUND_CLEARANCE = 1

export function resolveGroundContact(
  state: FlightState & { crashed: boolean },
  terrainHeight: number | undefined
) {
  if (state.crashed) return true
  if (
    terrainHeight === undefined ||
    !Number.isFinite(terrainHeight) ||
    state.altitude > terrainHeight + GROUND_CLEARANCE
  )
    return false

  state.altitude = terrainHeight + GROUND_CLEARANCE
  state.crashed = true
  state.speed = 0
  state.verticalSpeed = 0
  state.throttle = 0
  state.thrust = 0
  state.lift = 0
  state.drag = 0
  state.loadFactor = 0
  state.stalled = false
  return true
}
