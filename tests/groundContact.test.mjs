import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createFlightState,
  FlightDynamics,
  FLIGHT_STEP,
} from '../src/hooks/flightDynamics.ts'
import {
  resolveGroundContact,
  GROUND_CLEARANCE,
} from '../src/hooks/groundContact.ts'

const create = (altitude = 500) => ({
  ...createFlightState(altitude),
  crashed: false,
})

test('地形未知或无效时不误报触地，也不更改状态', () => {
  for (const height of [undefined, NaN, Infinity, -Infinity]) {
    const state = create(-10)
    const before = { ...state }
    assert.equal(resolveGroundContact(state, height), false)
    assert.deepEqual(state, before)
  }
})

test('高于探针接触面时继续飞行，包含负高程地形', () => {
  assert.equal(resolveGroundContact(create(), 300), false)
  assert.equal(resolveGroundContact(create(-50), -100), false)
})

test('等于或低于接触面时结束，贴合地面且所有运动和推力归零', () => {
  for (const altitude of [301, 300, 250]) {
    const state = create(altitude)
    assert.equal(resolveGroundContact(state, 300), true)
    assert.equal(state.crashed, true)
    assert.equal(state.altitude, 300 + GROUND_CLEARANCE)
    for (const key of [
      'speed',
      'verticalSpeed',
      'throttle',
      'thrust',
      'lift',
      'drag',
      'loadFactor',
    ]) {
      assert.equal(state[key], 0, key)
    }
  }
})

test('触地状态不可被后续高程覆盖，重置后可以重新飞行', () => {
  const state = create(0)
  resolveGroundContact(state, 0)
  const stopped = { ...state }
  assert.equal(resolveGroundContact(state, -100), true)
  assert.deepEqual(state, stopped)
  Object.assign(state, create())
  assert.equal(resolveGroundContact(state, 0), false)
  assert.equal(state.crashed, false)
  assert.equal(state.speed, 180)
})

test('下降飞行逐步触地后不再进行物理积分', () => {
  const state = create(30)
  const dynamics = new FlightDynamics()
  let contacts = 0
  for (let i = 0; i < 120 * 60; i++) {
    if (state.crashed) continue
    dynamics.step(state, { pitch: -1, roll: 0, throttle: -1 }, FLIGHT_STEP)
    if (resolveGroundContact(state, 0)) contacts++
  }
  assert.equal(contacts, 1)
  assert.equal(state.crashed, true)
  assert.equal(state.altitude, GROUND_CLEARANCE)
  assert.equal(state.speed, 0)
})
