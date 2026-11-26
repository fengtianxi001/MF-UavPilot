import assert from 'node:assert/strict'
import test from 'node:test'
test('前方地形风险接入告警，初始化与到达状态不误报', () => {
  const state = {
    altitude: 500,
    groundHeight: 0,
    verticalSpeed: 0,
    stalled: false,
    crashed: false,
    terrainAhead: { status: 'risk', seconds: 12, clearance: 30 },
  }
  assert.equal(getFlightAlerts(state)[0].id, 'terrain-ahead')
  assert.deepEqual(getFlightAlerts({ ...state, initializing: true }), [])
  assert.deepEqual(getFlightAlerts({ ...state, outcome: 'arrived' }), [])
})
import { getFlightAlerts } from '../src/hooks/flightAlerts.ts'

const safe = {
  altitude: 500,
  groundHeight: 100,
  verticalSpeed: 0,
  stalled: false,
  crashed: false,
}
test('正常飞行无告警，未知高程不误报低空', () => {
  assert.deepEqual(getFlightAlerts(safe), [])
  for (const height of [null, NaN, Infinity]) {
    assert.deepEqual(
      getFlightAlerts({ ...safe, altitude: 0, groundHeight: height }),
      []
    )
  }
})
test('低空依据离地高度而非椭球高度', () => {
  assert.equal(
    getFlightAlerts({ ...safe, groundHeight: 450 })[0].id,
    'low-altitude'
  )
  assert.deepEqual(
    getFlightAlerts({ ...safe, altitude: 50, groundHeight: -100 }),
    []
  )
  assert.deepEqual(getFlightAlerts({ ...safe, groundHeight: 400 }), [])
})
test('失速和快速下沉同时显示，不吞掉其他告警', () => {
  const alerts = getFlightAlerts({
    ...safe,
    stalled: true,
    verticalSpeed: -10,
    groundHeight: 450,
  })
  assert.deepEqual(
    alerts.map((item) => item.id),
    ['stall', 'low-altitude', 'rapid-descent']
  )
})
test('触地优先，仅保留飞行结束提示', () => {
  const alerts = getFlightAlerts({
    ...safe,
    crashed: true,
    stalled: true,
    verticalSpeed: -20,
    groundHeight: 500,
  })
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].id, 'ground-contact')
})
test('恢复正常后告警立即解除', () => {
  const state = { ...safe, stalled: true }
  assert.equal(getFlightAlerts(state).length, 1)
  state.stalled = false
  assert.equal(getFlightAlerts(state).length, 0)
})
