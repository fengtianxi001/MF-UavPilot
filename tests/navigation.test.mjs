import assert from 'node:assert/strict'
import test from 'node:test'
import { getNavigation } from '../src/hooks/navigation.ts'

const origin = { lat: 0, lng: 0 }
const aircraft = { ...origin, heading: 0, speed: 180, verticalSpeed: 0 }
test('正北正东方位与距离，以及当前接近速度下到达半径 ETA', () => {
  const north = getNavigation(aircraft, origin, { lat: 1, lng: 0 })
  assert.equal(north.bearing, 0)
  assert.equal(north.headingError, 0)
  assert.equal(north.closingSpeed, 50)
  assert.ok(Math.abs(north.etaSeconds - (north.distance - 100) / 50) < 1e-10)
  assert.ok(
    Math.abs(
      getNavigation(aircraft, origin, { lat: 0, lng: 1 }).bearing - Math.PI / 2
    ) < 1e-10
  )
})
test('航向跨北向按最短转角，远离或横飞不虚构倒计时', () => {
  const crossing = getNavigation(
    { ...aircraft, heading: (359 * Math.PI) / 180 },
    origin,
    { lat: 1, lng: 0 }
  )
  assert.ok(Math.abs(crossing.headingError - Math.PI / 180) < 1e-10)
  const away = getNavigation({ ...aircraft, heading: Math.PI }, origin, {
    lat: 1,
    lng: 0,
  })
  assert.ok(away.closingSpeed < 0)
  assert.equal(away.etaSeconds, null)
  assert.equal(
    getNavigation({ ...aircraft, heading: Math.PI / 2 }, origin, {
      lat: 1,
      lng: 0,
    }).etaSeconds,
    null
  )
})
test('低速与垂直运动无法给出 ETA，进入目标范围为零', () => {
  assert.equal(
    getNavigation({ ...aircraft, speed: 1 }, origin, { lat: 1, lng: 0 })
      .etaSeconds,
    null
  )
  assert.equal(
    getNavigation({ ...aircraft, verticalSpeed: 50 }, origin, {
      lat: 1,
      lng: 0,
    }).etaSeconds,
    null
  )
  assert.equal(getNavigation(aircraft, origin, origin).etaSeconds, 0)
})
test('北向航线东侧右偏，西侧左偏，零长航线稳定', () => {
  const end = { lat: 1, lng: 0 }
  assert.ok(
    getNavigation({ ...aircraft, lat: 0.5, lng: 0.01 }, origin, end)
      .crossTrackMeters > 1000
  )
  assert.ok(
    getNavigation({ ...aircraft, lat: 0.5, lng: -0.01 }, origin, end)
      .crossTrackMeters < -1000
  )
  assert.equal(getNavigation(aircraft, origin, origin).crossTrackMeters, 0)
})
