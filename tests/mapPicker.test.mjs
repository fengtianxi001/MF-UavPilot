import assert from 'node:assert/strict'
import test from 'node:test'
import { mapPicker, routePlan, selectMapPoint } from '../src/hooks/routePlan.ts'

test('未进入选点模式时点击不更改配置', () => {
  mapPicker.target = null
  const revision = mapPicker.revision
  assert.equal(selectMapPoint({ lat: 30, lng: 120 }), false)
  assert.equal(mapPicker.revision, revision)
})
test('选点发布草稿坐标并结束模式，但不应用航线', () => {
  const before = JSON.stringify(routePlan)
  for (const target of ['start', 'end']) {
    mapPicker.target = target
    assert.equal(selectMapPoint({ lat: 30, lng: 120 }), true)
    assert.deepEqual({ ...mapPicker.selection }, { target, lat: 30, lng: 120 })
    assert.equal(mapPicker.target, null)
    assert.equal(JSON.stringify(routePlan), before)
  }
})
test('非法坐标不选取，保留选点模式供重试', () => {
  mapPicker.target = 'start'
  const revision = mapPicker.revision
  for (const point of [
    { lat: NaN, lng: 120 },
    { lat: 86, lng: 120 },
    { lat: 30, lng: 181 },
  ]) {
    assert.equal(selectMapPoint(point), false)
    assert.equal(mapPicker.target, 'start')
    assert.equal(mapPicker.revision, revision)
  }
  mapPicker.target = null
})
