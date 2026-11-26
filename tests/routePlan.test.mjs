import assert from 'node:assert/strict'
import test from 'node:test'
import {
  routeGeometry,
  validateRoute,
  applyRoute,
  routePlan,
} from '../src/hooks/routePlan.ts'

test('离地高度与到达范围设置校验', () => {
  const route = {
    start: { lat: 29.83, lng: 119.86, altitude: 500, heightReference: 'agl' },
    end: { lat: 29.83, lng: 119.8 },
    arrivalRadius: 100,
  }
  assert.equal(validateRoute(route), null)
  assert.ok(validateRoute({ ...route, start: { ...route.start, altitude: 0 } }))
  assert.ok(validateRoute({ ...route, arrivalRadius: 0 }))
  assert.ok(validateRoute({ ...route, end: { lat: 29.83, lng: 119.86001 } }))
})

const route = () => ({
  start: { lat: 29.83, lng: 119.86, altitude: 500 },
  end: { lat: 29.83, lng: 119.8 },
})
test('航线几何提供正确距离与朝向', () => {
  const west = routeGeometry(route().start, route().end)
  assert.ok(west.distance > 5700 && west.distance < 5900)
  assert.ok(Math.abs((west.bearing * 180) / Math.PI - 270) < 0.1)
  const north = routeGeometry({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })
  assert.equal(north.bearing, 0)
  assert.ok(north.distance > 111000 && north.distance < 112000)
})
test('非法坐标、高度和过近起终点不允许应用', () => {
  for (const invalid of [
    { ...route(), start: { lat: NaN, lng: 119, altitude: 500 } },
    { ...route(), end: { lat: 86, lng: 119 } },
    { ...route(), end: { lat: 29, lng: 181 } },
    { ...route(), start: { ...route().start, altitude: 20001 } },
    { ...route(), end: { lat: 29.83, lng: 119.86 } },
  ]) {
    const revision = routePlan.revision
    assert.ok(validateRoute(invalid))
    assert.ok(applyRoute(invalid))
    assert.equal(routePlan.revision, revision)
  }
})
test('合法应用更新配置和版本，隔离表单对象引用', () => {
  const draft = route()
  const revision = routePlan.revision
  assert.equal(applyRoute(draft), null)
  assert.equal(routePlan.revision, revision + 1)
  draft.start.lat = 0
  assert.equal(routePlan.start.lat, 29.83)
})
