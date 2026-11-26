import assert from 'node:assert/strict'
import test from 'node:test'
import {
  aerodynamicForces,
  airDensity,
  AIRFRAME,
  GRAVITY,
  WING_INCIDENCE,
} from '../src/hooks/aerodynamics.ts'
import {
  createFlightState,
  FlightDynamics,
  FLIGHT_STEP,
} from '../src/hooks/flightDynamics.ts'

const neutral = { pitch: 0, roll: 0, throttle: 0 }
const advance = (state, dynamics, seconds, input = neutral) => {
  for (let i = 0; i < Math.round(seconds / FLIGHT_STEP); i++) {
    dynamics.step(state, input, FLIGHT_STEP)
  }
}

test('中性操纵保持配平巡航速度和高度', () => {
  const state = createFlightState()
  advance(state, new FlightDynamics(), 60)
  assert.equal(state.speed, 180)
  assert.equal(state.altitude, 2000)
  assert.equal(state.roll, 0)
  assert.equal(state.pitch, 0)
  assert.ok(state.lng < 119.86)
})

test('真航向北为零，向东为 90 度', () => {
  const north = { ...createFlightState(), heading: 0 }
  const east = { ...createFlightState(), heading: Math.PI / 2 }
  advance(north, new FlightDynamics(), 10)
  advance(east, new FlightDynamics(), 10)
  assert.ok(north.lat > 29.83)
  assert.ok(Math.abs(north.lng - 119.86) < 1e-8)
  assert.ok(east.lng > 119.86)
  assert.ok(Math.abs(east.lat - 29.83) < 1e-5)
})

test('先建立滚转，左右转弯方向相反且对称', () => {
  const left = { ...createFlightState(), heading: Math.PI }
  const right = { ...left }
  const leftDynamics = new FlightDynamics()
  const rightDynamics = new FlightDynamics()
  rightDynamics.step(right, { ...neutral, roll: 1 }, FLIGHT_STEP)
  assert.ok(right.roll > 0 && right.roll < 0.01)
  assert.ok(right.heading - Math.PI < 0.001)
  advance(left, leftDynamics, 4, { ...neutral, roll: -1 })
  advance(right, rightDynamics, 4 - FLIGHT_STEP, { ...neutral, roll: 1 })
  assert.ok(left.roll < 0 && left.heading < Math.PI)
  assert.ok(right.roll > 0 && right.heading > Math.PI)
  assert.ok(Math.abs(left.roll + right.roll) < 1e-9)
})

test('松开操纵保留瞬间惯性，随后辅助回正', () => {
  const state = createFlightState()
  const dynamics = new FlightDynamics()
  advance(state, dynamics, 3, { ...neutral, roll: 1 })
  const bankBeforeRelease = state.roll
  dynamics.step(state, neutral, FLIGHT_STEP)
  assert.ok(state.roll > bankBeforeRelease * 0.9)
  advance(state, dynamics, 8)
  assert.ok(Math.abs(state.roll) < 0.001)
})

test('爬升减速，俯冲增速，高度随飞行轨迹变化', () => {
  const climbing = createFlightState()
  const diving = createFlightState()
  advance(climbing, new FlightDynamics(), 8, { ...neutral, pitch: 1 })
  advance(diving, new FlightDynamics(), 8, { ...neutral, pitch: -1 })
  assert.ok(climbing.altitude > 2000 && climbing.verticalSpeed > 0)
  assert.ok(climbing.speed < 180)
  assert.ok(diving.altitude < 2000 && diving.verticalSpeed < 0)
  assert.ok(diving.speed > 180)
})

test('油门缓慢变化且松开后保持，空速不直接跳变', () => {
  const state = createFlightState()
  const dynamics = new FlightDynamics()
  dynamics.step(state, { ...neutral, throttle: 1 }, FLIGHT_STEP)
  assert.ok(state.throttle > 0.55 && state.throttle < 0.56)
  assert.ok(state.speed - 180 < 0.01)
  advance(state, dynamics, 5, { ...neutral, throttle: 1 })
  assert.equal(state.throttle, 1)
  const speed = state.speed
  advance(state, dynamics, 5)
  assert.equal(state.throttle, 1)
  assert.ok(state.speed > speed)
})

test('低速触发渐进失速和下沉，操纵响应减弱', () => {
  const slow = { ...createFlightState(), speed: 70, throttle: 0 }
  const normal = createFlightState()
  const slowDynamics = new FlightDynamics()
  const normalDynamics = new FlightDynamics()
  slowDynamics.step(slow, { ...neutral, roll: 1 }, FLIGHT_STEP)
  normalDynamics.step(normal, { ...neutral, roll: 1 }, FLIGHT_STEP)
  assert.ok(slow.roll < normal.roll)
  advance(slow, slowDynamics, 2)
  assert.equal(slow.stalled, true)
  assert.ok(slow.verticalSpeed < 0)
  assert.ok(slow.altitude < 2000)
})

test('30、60、144 FPS 使用固定步长得到相同飞行结果', () => {
  const simulate = (fps) => {
    const state = createFlightState()
    const dynamics = new FlightDynamics()
    let accumulator = 0
    for (let frame = 0; frame < fps * 20; frame++) {
      accumulator += 1 / fps
      while (accumulator >= FLIGHT_STEP) {
        dynamics.step(
          state,
          { pitch: 0.2, roll: 0.4, throttle: 0.1 },
          FLIGHT_STEP
        )
        accumulator -= FLIGHT_STEP
      }
    }
    return state
  }
  const reference = simulate(60)
  for (const fps of [30, 144]) {
    const state = simulate(fps)
    assert.ok(Math.abs(state.altitude - reference.altitude) < 0.1)
    assert.ok(Math.abs(state.speed - reference.speed) < 0.05)
    assert.ok(Math.abs(state.lat - reference.lat) < 0.00001)
    assert.ok(Math.abs(state.lng - reference.lng) < 0.00001)
  }
})

test('非法时间步不更新，过长时间步受到限制', () => {
  const state = createFlightState()
  const dynamics = new FlightDynamics()
  const initial = { ...state }
  for (const dt of [0, -1, NaN, Infinity]) dynamics.step(state, neutral, dt)
  assert.deepEqual(state, initial)
  const limited = createFlightState()
  dynamics.step(state, neutral, 100)
  new FlightDynamics().step(limited, neutral, 0.1)
  assert.deepEqual(state, limited)
})

test('持续转弯保持角度、速度和位置数值有效', () => {
  const state = createFlightState()
  advance(state, new FlightDynamics(), 180, { pitch: 0, roll: 1, throttle: 1 })
  for (const [key, value] of Object.entries(state)) {
    if (typeof value === 'number') assert.ok(Number.isFinite(value), key)
  }
  assert.ok(state.heading >= 0 && state.heading < 2 * Math.PI)
  assert.ok(state.lng >= -180 && state.lng <= 180)
  assert.ok(Math.abs(state.roll) <= (55 * Math.PI) / 180)
})

test('重置清除角速度与飞行轨迹惯性', () => {
  const state = createFlightState()
  const dynamics = new FlightDynamics()
  advance(state, dynamics, 3, { pitch: 1, roll: 1, throttle: -1 })
  dynamics.reset()
  Object.assign(state, createFlightState())
  dynamics.step(state, neutral, FLIGHT_STEP)
  assert.equal(state.roll, 0)
  assert.equal(state.pitch, 0)
  assert.ok(Math.abs(state.verticalSpeed) < 1e-10)
  assert.equal(state.speed, 180)
})

test('ISA 海平面密度合理，密度随高度降低且在 11km 连续', () => {
  assert.ok(Math.abs(airDensity(0) - 1.225) < 0.001)
  assert.ok(airDensity(10000) < airDensity(2000))
  assert.ok(airDensity(20000) < airDensity(11000))
  assert.ok(Math.abs(airDensity(11000.01) - airDensity(10999.99)) < 0.00001)
})

test('配平升力等于重量，动压和气动力随空速平方变化', () => {
  const trim = aerodynamicForces(50, 2000, WING_INCIDENCE)
  const faster = aerodynamicForces(100, 2000, WING_INCIDENCE)
  assert.ok(Math.abs(trim.lift - AIRFRAME.mass * GRAVITY) < 1e-8)
  assert.ok(Math.abs(faster.lift / trim.lift - 4) < 1e-10)
  assert.ok(Math.abs(faster.drag / trim.drag - 4) < 1e-10)
  assert.ok(aerodynamicForces(50, 8000, WING_INCIDENCE).lift < trim.lift)
})

test('临界迎角后升力衰减且阻力增加，判据不是仅看速度', () => {
  const peak = aerodynamicForces(70, 2000, AIRFRAME.stallAngle)
  const separated = aerodynamicForces(70, 2000, (30 * Math.PI) / 180)
  assert.equal(peak.stalled, false)
  assert.equal(separated.stalled, true)
  assert.ok(separated.liftCoefficient < peak.liftCoefficient)
  assert.ok(separated.dragCoefficient > peak.dragCoefficient)
  assert.equal(aerodynamicForces(15, 2000, 0).stalled, false)
  const negative = aerodynamicForces(50, 2000, (-30 * Math.PI) / 180)
  assert.ok(negative.lift < 0 && negative.drag > 0)
})

test('大迎角启动会触发失速遥测，发动机推力滞后于油门', () => {
  const state = { ...createFlightState(), pitch: (30 * Math.PI) / 180 }
  const dynamics = new FlightDynamics()
  dynamics.step(state, neutral, FLIGHT_STEP)
  assert.equal(state.stalled, true)
  assert.ok(state.angleOfAttack > AIRFRAME.stallAngle)
  assert.ok(Number.isFinite(state.loadFactor))
  const engine = { ...createFlightState(), throttle: 1 }
  new FlightDynamics().step(engine, neutral, FLIGHT_STEP)
  const reference = createFlightState()
  assert.ok(engine.thrust > reference.thrust)
  assert.ok(engine.thrust < reference.thrust / 0.55)
})

test('无动力滑翔时阻力耗散机械能，不产生无源加速能量', () => {
  const state = { ...createFlightState(), throttle: 0 }
  const dynamics = new FlightDynamics()
  // 等待发动机推力滞后消退。
  advance(state, dynamics, 20)
  const energy = () =>
    AIRFRAME.mass * (GRAVITY * state.altitude + (state.speed / 3.6) ** 2 / 2)
  const before = energy()
  advance(state, dynamics, 10)
  assert.ok(energy() < before)
})
