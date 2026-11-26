import assert from 'node:assert/strict'
import test from 'node:test'
import {
  destinationPoint,
  createTerrainProbe,
  assessTerrain,
  createMissionState,
  updateMission,
} from '../src/hooks/flightMission.ts'

const R = 6371008.8
const origin = { lat: 0, lng: 0 }
const farEnd = { lat: 20, lng: 20 }
const near = (actual, expected, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≈ ${expected}`)
const state = (overrides = {}) => ({
  ...origin,
  heading: 0,
  speed: 360,
  verticalSpeed: 0,
  altitude: 1000,
  ...overrides,
})
const probe = (seconds, altitude = 1000) => ({
  ...origin,
  seconds,
  projectedAltitude: altitude,
})

test('正北前向一度，且不修改起点', () => {
  const point = Object.freeze({ lat: 30, lng: 120 })
  const next = destinationPoint(point, 0, (R * Math.PI) / 180)
  near(next.lat, 31)
  near(next.lng, 120)
})

test('赤道正东前向一度', () => {
  const next = destinationPoint(origin, Math.PI / 2, (R * Math.PI) / 180)
  near(next.lat, 0)
  near(next.lng, 1)
})

test('向东、向西跨日期变更线，经度归一化', () => {
  const distance = (R * Math.PI) / 180
  near(
    destinationPoint({ lat: 0, lng: 179.5 }, Math.PI / 2, distance).lng,
    -179.5
  )
  near(
    destinationPoint({ lat: 0, lng: -179.5 }, -Math.PI / 2, distance).lng,
    179.5
  )
  near(destinationPoint({ lat: 10, lng: 540 }, 0, 0).lng, -180)
})

test('向北越过极点，结果保持有限', () => {
  const next = destinationPoint({ lat: 89, lng: 0 }, 0, (R * Math.PI) / 90)
  near(next.lat, 89)
  near(Math.abs(next.lng), 180)
})

test('探测点为未来 2/4/...20 秒，以 km/h 换算地速', () => {
  const input = Object.freeze(state())
  const probes = createTerrainProbe(input)
  assert.deepEqual(
    probes.map((p) => p.seconds),
    [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]
  )
  near(probes[0].lat, (200 / R) * (180 / Math.PI))
  near(probes[9].lat, (2000 / R) * (180 / Math.PI))
  assert.ok(probes.every((p) => p.projectedAltitude === 1000))
})

test('下降和爬升投影扣除垂直速度，按航向放置探测点', () => {
  for (const verticalSpeed of [-60, 60]) {
    const probes = createTerrainProbe(
      state({ verticalSpeed, heading: Math.PI / 2 })
    )
    near(probes[0].lng, (160 / R) * (180 / Math.PI))
    near(probes[9].lng, (1600 / R) * (180 / Math.PI))
    assert.equal(probes[0].projectedAltitude, 1000 + verticalSpeed * 2)
    assert.equal(probes[9].projectedAltitude, 1000 + verticalSpeed * 20)
  }
})

test('静止、纯垂直及垂直速度超出总速时，水平距离钳制到零', () => {
  for (const input of [
    state({ speed: 0 }),
    state({ verticalSpeed: 100 }),
    state({ verticalSpeed: -120 }),
  ]) {
    assert.ok(
      createTerrainProbe(input).every((p) => p.lat === 0 && p.lng === 0)
    )
  }
})

test('safe 返回最小净空，等于阈值仍安全，支持自定义阈值', () => {
  const probes = Object.freeze([
    Object.freeze(probe(2)),
    Object.freeze(probe(4)),
  ])
  const heights = Object.freeze([800, 900])
  assert.deepEqual(assessTerrain(probes, heights), {
    status: 'safe',
    seconds: null,
    clearance: 100,
  })
  assert.deepEqual(assessTerrain(probes, heights, 101), {
    status: 'risk',
    seconds: 4,
    clearance: 100,
  })
})

test('null、undefined、短数组、稀疏数组和非有限高度均视为缺测', () => {
  for (const heights of [
    [800, null],
    [800, undefined],
    [800],
    [800, NaN],
    [800, Infinity],
    new Array(2),
  ]) {
    assert.deepEqual(assessTerrain([probe(2), probe(4)], heights), {
      status: 'unknown',
      seconds: null,
      clearance: null,
    })
  }
  assert.deepEqual(assessTerrain([], []), {
    status: 'unknown',
    seconds: null,
    clearance: null,
  })
})

test('风险优先于前后缺测，乱序输入仍选最早风险而非最小净空', () => {
  assert.deepEqual(
    assessTerrain(
      [probe(2), probe(8), probe(4), probe(6)],
      [null, 999, 950, undefined]
    ),
    { status: 'risk', seconds: 4, clearance: 50 }
  )
})

test('下降投影产生风险，负净空也保留', () => {
  const probes = createTerrainProbe(state({ verticalSpeed: -10 }))
  assert.deepEqual(assessTerrain(probes, Array(10).fill(850)), {
    status: 'risk',
    seconds: 6,
    clearance: 90,
  })
  assert.deepEqual(assessTerrain([probe(2, 90)], [100]), {
    status: 'risk',
    seconds: 2,
    clearance: -10,
  })
})

test('无效投影高度或时刻不能错误报告 safe', () => {
  assert.equal(assessTerrain([probe(2, NaN)], [0]).status, 'unknown')
  assert.equal(assessTerrain([probe(Infinity)], [0]).status, 'unknown')
})

test('新任务相互独立，累计时间与球面水平航程且不修改输入', () => {
  const initial = Object.freeze(createMissionState())
  assert.deepEqual(initial, {
    elapsedSeconds: 0,
    distanceMeters: 0,
    outcome: 'flying',
  })
  assert.notEqual(createMissionState(), createMissionState())
  const one = Object.freeze({ lat: 0, lng: 1, altitude: 5000 })
  const two = Object.freeze({ lat: 0, lng: 2, altitude: -100 })
  const first = Object.freeze(updateMission(initial, origin, one, farEnd, 2))
  const second = updateMission(first, one, two, farEnd, 3)
  assert.equal(second.elapsedSeconds, 5)
  near(second.distanceMeters, (R * Math.PI) / 90)
  assert.equal(second.outcome, 'flying')
  assert.equal(initial.distanceMeters, 0)
  assert.equal(first.elapsedSeconds, 2)
})

test('仅有限正 dt 累加，无效 dt 不阻止航程更新', () => {
  for (const dt of [0, -1, NaN, Infinity, -Infinity]) {
    const next = updateMission(
      createMissionState(),
      origin,
      { lat: 0, lng: 1 },
      farEnd,
      dt
    )
    assert.equal(next.elapsedSeconds, 0)
    near(next.distanceMeters, (R * Math.PI) / 180)
  }
})

test('静止不累计距离；默认 100m 水平圆判定不是降落', () => {
  const current = { ...origin, altitude: 20000 }
  const next = updateMission(createMissionState(), current, current, origin, 1)
  assert.equal(next.outcome, 'arrived')
  assert.equal(next.distanceMeters, 0)
})

test('前后位置任一点已在终点半径内均到达', () => {
  const outside = destinationPoint(origin, 0, 200)
  const inside = destinationPoint(origin, 0, 50)
  for (const [previous, current] of [
    [outside, inside],
    [inside, outside],
  ]) {
    assert.equal(
      updateMission(createMissionState(), previous, current, origin, 1).outcome,
      'arrived'
    )
  }
})

test('单帧跨过终点，两端在圆外仍到达', () => {
  const previous = destinationPoint(origin, -Math.PI / 2, 1000)
  const current = destinationPoint(origin, Math.PI / 2, 1000)
  const next = updateMission(createMissionState(), previous, current, origin, 2)
  assert.equal(next.outcome, 'arrived')
  near(next.distanceMeters, 2000)
  assert.equal(next.elapsedSeconds, 2)
})

test('掠过圆内到达，圆外不达，自定义半径生效', () => {
  for (const offset of [50, 150]) {
    const middle = destinationPoint(origin, 0, offset)
    const previous = destinationPoint(middle, -Math.PI / 2, 1000)
    const current = destinationPoint(middle, Math.PI / 2, 1000)
    assert.equal(
      updateMission(createMissionState(), previous, current, origin, 1).outcome,
      offset === 50 ? 'arrived' : 'flying'
    )
    assert.equal(
      updateMission(
        createMissionState(),
        previous,
        current,
        origin,
        1,
        false,
        200
      ).outcome,
      'arrived'
    )
  }
})

test('终点位于延长线但不在线段上，不算到达', () => {
  const previous = destinationPoint(origin, Math.PI / 2, 500)
  const current = destinationPoint(origin, Math.PI / 2, 1000)
  assert.equal(
    updateMission(createMissionState(), previous, current, origin, 1).outcome,
    'flying'
  )
  assert.equal(
    updateMission(createMissionState(), current, previous, origin, 1).outcome,
    'flying'
  )
})

test('高纬度和日期变更线附近跨越终点也能检测', () => {
  for (const end of [
    { lat: 80, lng: 179.999 },
    { lat: -75, lng: -179.999 },
  ]) {
    const previous = destinationPoint(end, -Math.PI / 2, 1000)
    const current = destinationPoint(end, Math.PI / 2, 1000)
    assert.equal(
      updateMission(createMissionState(), previous, current, end, 1).outcome,
      'arrived'
    )
    near(
      updateMission(createMissionState(), previous, current, farEnd, 1)
        .distanceMeters,
      2000
    )
  }
})

test('触地优先于同帧跨越到达，终止帧仍累计时间与距离', () => {
  const previous = destinationPoint(origin, -Math.PI / 2, 1000)
  const current = destinationPoint(origin, Math.PI / 2, 1000)
  const next = updateMission(
    createMissionState(),
    previous,
    current,
    origin,
    2,
    true
  )
  assert.equal(next.outcome, 'crashed')
  assert.equal(next.elapsedSeconds, 2)
  near(next.distanceMeters, 2000)
})

test('arrived/crashed 结束冻结，包括后续触地与无效输入', () => {
  for (const outcome of ['arrived', 'crashed']) {
    const mission = Object.freeze({
      elapsedSeconds: 12,
      distanceMeters: 345,
      outcome,
    })
    assert.equal(
      updateMission(mission, origin, farEnd, origin, 100, true),
      mission
    )
    assert.equal(
      updateMission(mission, { lat: NaN, lng: NaN }, farEnd, origin, Infinity),
      mission
    )
  }
})
