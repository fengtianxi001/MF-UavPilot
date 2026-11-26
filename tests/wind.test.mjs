import assert from 'node:assert/strict'
import test from 'node:test'
import { windAt } from '../src/hooks/wind.ts'
import {
  createFlightState,
  FlightDynamics,
  FLIGHT_STEP,
} from '../src/hooks/flightDynamics.ts'

const calm = {
  enabled: false,
  fromDegrees: 0,
  speed: 0,
  gustSpeed: 0,
  gustPeriodSeconds: 11,
}
const settings = (overrides) => ({ ...calm, enabled: true, ...overrides })
const step = (
  state,
  wind,
  seconds,
  input = { pitch: 0, roll: 0, throttle: 0 }
) => {
  const dynamics = new FlightDynamics()
  for (let i = 0; i < Math.round(seconds / FLIGHT_STEP); i++) {
    dynamics.step(state, input, FLIGHT_STEP, wind)
  }
  return state
}

test('关闭风场时风矢量为零，不影响飞行', () => {
  assert.deepEqual(windAt(calm, 12.3), {
    north: 0,
    east: 0,
    speed: 0,
    fromDegrees: 0,
    gust: 0,
  })
  const withWindOff = step(createFlightState(), windAt(calm, 0), 30)
  const noArg = step(createFlightState(), undefined, 30)
  assert.equal(withWindOff.groundSpeed.toFixed(6), noArg.groundSpeed.toFixed(6))
  assert.equal(withWindOff.track, noArg.track)
  assert.equal(withWindOff.driftAngle, 0)
})

test('来向 0°（北风）吹向南方，来向 90°（东风）吹向西方', () => {
  const north = windAt(settings({ fromDegrees: 0, speed: 10 }), 0)
  assert.ok(Math.abs(north.north + 10) < 1e-9)
  assert.ok(Math.abs(north.east) < 1e-9)
  const eastWind = windAt(settings({ fromDegrees: 90, speed: 10 }), 0)
  assert.ok(Math.abs(eastWind.east + 10) < 1e-9)
  assert.ok(Math.abs(eastWind.north) < 1e-9)
  assert.equal(eastWind.speed, 10)
})

test('阵风为确定性的双正弦叠加，峰值不超过设定幅度', () => {
  const wind = settings({ speed: 5, gustSpeed: 4, gustPeriodSeconds: 10 })
  assert.deepEqual(windAt(wind, 3.3), windAt(wind, 3.3))
  for (let t = 0; t < 120; t += 0.25) {
    const gust = windAt(wind, t).gust
    assert.ok(Math.abs(gust) <= 4 + 1e-9)
  }
  assert.notEqual(windAt(wind, 0).gust, windAt(wind, 3).gust)
})

test('顺风提高地速，逆风降低地速，真空速与气动力不受影响', () => {
  // 航向 270°（向西）：来向 90°（东风）吹向西为顺风，来向 270° 为逆风。
  const calmState = step(createFlightState(500), undefined, 0.05)
  const tailwind = step(
    createFlightState(500),
    windAt(settings({ fromDegrees: 90, speed: 10 }), 0),
    0.05
  )
  const headwind = step(
    createFlightState(500),
    windAt(settings({ fromDegrees: 270, speed: 10 }), 0),
    0.05
  )
  assert.ok(tailwind.groundSpeed > calmState.groundSpeed)
  assert.ok(headwind.groundSpeed < calmState.groundSpeed)
  // 风不进入气动力：三种风况真空速、迎角、升力完全一致。
  assert.equal(tailwind.speed, calmState.speed)
  assert.equal(headwind.speed, calmState.speed)
  assert.equal(tailwind.angleOfAttack, calmState.angleOfAttack)
  assert.equal(tailwind.lift, calmState.lift)
})

test('侧风产生航迹偏移和漂移角，但航向保持', () => {
  const state = createFlightState(500)
  const wind = windAt(settings({ fromDegrees: 0, speed: 12 }), 0)
  step(state, wind, 20)
  assert.ok(Math.abs(state.driftAngle) > 0.01)
  assert.ok(Math.abs(state.track - state.heading) > 0.01)
  assert.ok(Math.abs(state.windFromDegrees) < 0.01)
})

test('顺风时地面航程更长，逆风更短，风不改变爬升率', () => {
  // 向西飞行：东风顺风，西风逆风。
  const tail = step(
    createFlightState(500),
    windAt(settings({ fromDegrees: 90, speed: 10 }), 0),
    30
  )
  const head = step(
    createFlightState(500),
    windAt(settings({ fromDegrees: 270, speed: 10 }), 0),
    30
  )
  const calmState = step(createFlightState(500), undefined, 30)
  assert.ok(tail.lng < calmState.lng)
  assert.ok(head.lng > calmState.lng)
  assert.ok(tail.lng < head.lng)
  // 垂直速度由升力决定，不受水平风影响。
  assert.equal(tail.verticalSpeed, calmState.verticalSpeed)
  assert.equal(head.verticalSpeed, calmState.verticalSpeed)
})

test('无效风矢量不产生 NaN，静止时航迹回落到航向', () => {
  const state = createFlightState(500)
  step(state, { north: NaN, east: undefined, speed: NaN, fromDegrees: NaN }, 1)
  assert.ok(Number.isFinite(state.groundSpeed))
  assert.ok(Number.isFinite(state.track))
  assert.ok(Number.isFinite(state.driftAngle))
})
