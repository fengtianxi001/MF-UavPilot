import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advancePropeller,
  PROPELLER_VISUAL_RPS,
} from '../src/hooks/propeller.ts'

test('零油门保持转角，半油门转速为满油门一半', () => {
  assert.equal(advancePropeller(1, 0, 0.1), 1)
  const full = advancePropeller(0, 1, 0.01)
  const half = advancePropeller(0, 0.5, 0.01)
  assert.ok(Math.abs(half * 2 - full) < 1e-12)
  assert.ok(Math.abs(full + 2 * Math.PI * PROPELLER_VISUAL_RPS * 0.01) < 1e-12)
})
test('按时间积分与帧率无关，不受按键重复率影响', () => {
  const simulate = (fps) => {
    let angle = 0
    for (let i = 0; i < fps; i++) angle = advancePropeller(angle, 0.55, 1 / fps)
    return angle
  }
  assert.ok(Math.abs(simulate(30) - simulate(144)) < 1e-10)
})
test('无有效时间步不转动，非法油门不造成数值污染', () => {
  for (const dt of [0, -1, NaN, Infinity])
    assert.equal(advancePropeller(1, 1, dt), 1)
  assert.equal(advancePropeller(1, NaN, 0.1), 1)
  assert.equal(advancePropeller(1, -1, 0.1), 1)
  assert.equal(advancePropeller(1, 2, 0.1), advancePropeller(1, 1, 0.1))
})
