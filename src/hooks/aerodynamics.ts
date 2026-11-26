// 通用演示参数，并非 TB2 的实测气动数据或飞行训练模型。
export const AIRFRAME = Object.freeze({
  mass: 650,
  wingArea: 10,
  liftAtZero: 0.2,
  liftSlope: 5.2,
  stallAngle: (15 * Math.PI) / 180,
  zeroLiftDrag: 0.035,
  inducedDrag: 0.055,
})

export const GRAVITY = 9.80665
const clamp = (x: number, min: number, max: number) =>
  Math.min(max, Math.max(min, x))

// ISA 对流层 + 等温低平流层近似；演示仅支持 -500 至 20000 米。
export function airDensity(altitude: number) {
  const h = clamp(altitude, -500, 20000)
  const temperature = 288.15 - 0.0065 * Math.min(h, 11000)
  const pressure =
    101325 *
    (temperature / 288.15) ** 5.25588 *
    Math.exp((-GRAVITY * Math.max(0, h - 11000)) / (287.05 * temperature))
  return pressure / (287.05 * temperature)
}

export function aerodynamicForces(
  speed: number,
  altitude: number,
  alpha: number
) {
  const angle = Math.atan2(Math.sin(alpha), Math.cos(alpha))
  const magnitude = Math.abs(angle)
  const sign = angle < 0 ? -1 : 1
  const attachedLift = AIRFRAME.liftAtZero + AIRFRAME.liftSlope * angle
  const blend = clamp(
    (magnitude - AIRFRAME.stallAngle) / ((12 * Math.PI) / 180),
    0,
    1
  )
  // 超过临界迎角后平滑转入分离流；大迎角阻力趋向平板近似。
  const limitedLift =
    AIRFRAME.liftAtZero +
    AIRFRAME.liftSlope * sign * Math.min(magnitude, AIRFRAME.stallAngle)
  const separatedLift = Math.sin(2 * angle)
  const liftCoefficient =
    blend === 0
      ? attachedLift
      : limitedLift * (1 - blend) + separatedLift * blend
  const dragCoefficient =
    AIRFRAME.zeroLiftDrag +
    AIRFRAME.inducedDrag * liftCoefficient ** 2 +
    1.8 * Math.sin(angle) ** 2 * blend
  const density = airDensity(altitude)
  const dynamicPressure = 0.5 * density * speed ** 2
  return {
    density,
    dynamicPressure,
    liftCoefficient,
    dragCoefficient,
    lift: dynamicPressure * AIRFRAME.wingArea * liftCoefficient,
    drag: dynamicPressure * AIRFRAME.wingArea * dragCoefficient,
    stalled: magnitude > AIRFRAME.stallAngle,
  }
}

// 以 2000 米、220 km/h 建立巡航配平；机翼安装角使机身保持近似水平。
const cruisePressure = 0.5 * airDensity(2000) * (220 / 3.6) ** 2
export const WING_INCIDENCE =
  ((AIRFRAME.mass * GRAVITY) / (cruisePressure * AIRFRAME.wingArea) -
    AIRFRAME.liftAtZero) /
  AIRFRAME.liftSlope
export const MAX_THRUST =
  (aerodynamicForces(220 / 3.6, 2000, WING_INCIDENCE).drag / 0.55) * 1.35
