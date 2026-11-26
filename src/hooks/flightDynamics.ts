import {
  aerodynamicForces,
  airDensity,
  AIRFRAME,
  GRAVITY,
  MAX_THRUST,
  WING_INCIDENCE,
} from './aerodynamics.ts'

// 质点气动力 + 辅助姿态控制：不是完整六自由度刚体模型。
export interface FlightState {
  lat: number
  lng: number
  altitude: number
  heading: number
  pitch: number
  roll: number
  correction: number
  speed: number
  throttle: number
  verticalSpeed: number
  stalled: boolean
  angleOfAttack: number
  loadFactor: number
  airDensity: number
  lift: number
  drag: number
  thrust: number
  /** 地速，km/h；无风时等于真空速的水平分量。 */
  groundSpeed: number
  /** 航迹角（地速方向），弧度，正北 0°。 */
  track: number
  /** 风引起的航迹与航向差，弧度，右侧为正。 */
  driftAngle: number
  windSpeed: number
  windFromDegrees: number
}

export interface FlightInput {
  pitch: number
  roll: number
  throttle: number
}

export interface WindVector {
  north: number
  east: number
  speed: number
  fromDegrees: number
}

const radians = (degrees: number) => (degrees * Math.PI) / 180
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))
const smooth = (
  current: number,
  target: number,
  response: number,
  dt: number
) => current + (target - current) * (1 - Math.exp(-response * dt))

export const FLIGHT_STEP = 1 / 120
export const CRUISE_SPEED_KMH = 220
export const MAX_SPEED_KMH = 300
const cruiseDensity = airDensity(2000)

export function createFlightState(altitude = 2000): FlightState {
  const forces = aerodynamicForces(50, altitude, WING_INCIDENCE)
  return {
    lat: 29.83,
    lng: 119.86,
    altitude,
    // 真航向：北为 0，顺时针增加。
    heading: radians(270),
    pitch: 0,
    roll: 0,
    correction: 1,
    speed: 180,
    throttle: 0.55,
    verticalSpeed: 0,
    stalled: false,
    angleOfAttack: WING_INCIDENCE,
    loadFactor: forces.lift / (AIRFRAME.mass * GRAVITY),
    airDensity: forces.density,
    lift: forces.lift,
    drag: forces.drag,
    thrust: MAX_THRUST * 0.55 * (forces.density / cruiseDensity),
    groundSpeed: 180,
    track: radians(270),
    driftAngle: 0,
    windSpeed: 0,
    windFromDegrees: 0,
  }
}

export class FlightDynamics {
  private rollRate = 0
  private pitchRate = 0
  private flightPathAngle = 0
  private engineThrottle = 0.55

  reset() {
    this.rollRate = 0
    this.pitchRate = 0
    this.flightPathAngle = 0
    this.engineThrottle = 0.55
  }

  step(state: FlightState, input: FlightInput, dt: number, wind?: WindVector) {
    if (!Number.isFinite(dt) || dt <= 0) return
    // 防止后台恢复时将很长的时间间隔一次性积分。
    dt = Math.min(dt, 0.1)
    const speed = state.speed / 3.6
    const cruiseSpeed = CRUISE_SPEED_KMH / 3.6
    const authority = clamp(speed / cruiseSpeed, 0.3, 1.2)
    const alpha = state.pitch + WING_INCIDENCE - this.flightPathAngle
    const forces = aerodynamicForces(speed, state.altitude, alpha)
    const stallAmount = clamp(
      (Math.abs(alpha) - AIRFRAME.stallAngle) / radians(12),
      0,
      1
    )

    state.throttle = clamp(state.throttle + input.throttle * 0.18 * dt, 0, 1)
    const targetRoll = clamp(input.roll, -1, 1) * radians(50)
    const targetPitch =
      clamp(input.pitch, -1, 1) * radians(input.pitch > 0 ? 18 : 15) -
      stallAmount * radians(18)

    // 二阶操纵响应：先建立角速度，再改变姿态，而不是按帧直接跳变角度。
    this.rollRate = smooth(
      this.rollRate,
      clamp((targetRoll - state.roll) * 2.2, -radians(35), radians(35)) *
        authority,
      4.5,
      dt
    )
    this.pitchRate = smooth(
      this.pitchRate,
      clamp((targetPitch - state.pitch) * 1.8, -radians(12), radians(12)) *
        authority,
      3.5,
      dt
    )
    state.roll = clamp(
      state.roll + this.rollRate * dt,
      -radians(55),
      radians(55)
    )
    state.pitch = clamp(
      state.pitch + this.pitchRate * dt,
      -radians(25),
      radians(22)
    )

    this.engineThrottle = smooth(this.engineThrottle, state.throttle, 1.5, dt)
    // 简化螺旋桨推力随密度降低而衰减，发动机响应存在滞后。
    const thrust =
      MAX_THRUST * this.engineThrottle * (forces.density / cruiseDensity)
    const thrustAngle = state.pitch - this.flightPathAngle
    const acceleration =
      (thrust * Math.cos(thrustAngle) - forces.drag) / AIRFRAME.mass -
      GRAVITY * Math.sin(this.flightPathAngle)
    const pathRate =
      (forces.lift * Math.cos(state.roll) +
        thrust * Math.sin(thrustAngle) -
        AIRFRAME.mass * GRAVITY * Math.cos(this.flightPathAngle)) /
      (AIRFRAME.mass * Math.max(speed, 5))
    const headingRate =
      (forces.lift * Math.sin(state.roll)) /
      (AIRFRAME.mass *
        Math.max(speed, 5) *
        Math.max(0.2, Math.cos(this.flightPathAngle)))
    // 飞行包线数值保护：不支持垂直/倒飞、零空速和触地运动。
    this.flightPathAngle = clamp(
      this.flightPathAngle + pathRate * dt,
      -radians(80),
      radians(80)
    )
    const nextSpeed = clamp(speed + acceleration * dt, 5, MAX_SPEED_KMH / 3.6)
    const averageSpeed = (speed + nextSpeed) / 2
    state.speed = nextSpeed * 3.6
    state.angleOfAttack = alpha
    state.stalled = forces.stalled
    state.loadFactor = forces.lift / (AIRFRAME.mass * GRAVITY)
    state.airDensity = forces.density
    state.lift = forces.lift
    state.drag = forces.drag
    state.thrust = thrust
    state.verticalSpeed = averageSpeed * Math.sin(this.flightPathAngle)
    state.altitude += state.verticalSpeed * dt
    state.correction = Math.cos(this.flightPathAngle)

    // 水平升力分量产生航向变化，不再直接套用协调转弯率。
    state.heading =
      (((state.heading + headingRate * dt) % (Math.PI * 2)) + Math.PI * 2) %
      (Math.PI * 2)

    // 真空速保持为空速；风只叠加到地速与航迹，不改变气动力和失速判据。
    const horizontalAir = averageSpeed * state.correction
    const windNorth = finiteWind(wind?.north)
    const windEast = finiteWind(wind?.east)
    const airNorth = Math.cos(state.heading) * horizontalAir
    const airEast = Math.sin(state.heading) * horizontalAir
    const groundNorth = airNorth + windNorth
    const groundEast = airEast + windEast
    const groundSpeed = Math.hypot(groundNorth, groundEast)
    state.groundSpeed = groundSpeed * 3.6
    state.track =
      groundSpeed > 0.05
        ? ((Math.atan2(groundEast, groundNorth) % (Math.PI * 2)) +
            Math.PI * 2) %
          (Math.PI * 2)
        : state.heading
    state.driftAngle = Math.atan2(
      Math.sin(state.track - state.heading),
      Math.cos(state.track - state.heading)
    )
    state.windSpeed = Math.hypot(windNorth, windEast)
    state.windFromDegrees = ((finiteWind(wind?.fromDegrees) % 360) + 360) % 360

    // 球面前向测地，使用地速与航迹角推进地面位置。
    const angularDistance = (groundSpeed * dt) / 6371008.8
    const latitude = radians(state.lat)
    const longitude = radians(state.lng)
    const nextLatitude = Math.asin(
      clamp(
        Math.sin(latitude) * Math.cos(angularDistance) +
          Math.cos(latitude) *
            Math.sin(angularDistance) *
            Math.cos(state.track),
        -1,
        1
      )
    )
    const nextLongitude =
      longitude +
      Math.atan2(
        Math.sin(state.track) * Math.sin(angularDistance) * Math.cos(latitude),
        Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(nextLatitude)
      )
    state.lat = (nextLatitude * 180) / Math.PI
    state.lng =
      (((((nextLongitude * 180) / Math.PI + 180) % 360) + 360) % 360) - 180
  }
}

const finiteWind = (value: number | undefined) =>
  value !== undefined && Number.isFinite(value) ? value : 0
