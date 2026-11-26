import assert from 'node:assert/strict'
import test from 'node:test'
import * as C from 'cesium'
import { queryTerrainHeights } from '../src/hooks/terrainSampling.ts'

const makeProvider = (height) => ({
  tilingScheme: new C.GeographicTilingScheme(),
  requestTileGeometry: async () =>
    new C.HeightmapTerrainData({
      buffer: new Float32Array([height, height, height, height]),
      width: 2,
      height: 2,
    }),
})

test('真实高程采样支持起点与前方多个位置，非零地形不被忽略', async () => {
  const result = await queryTerrainHeights(makeProvider(730), [
    { lat: 29.83, lng: 119.86 },
    { lat: 29.84, lng: 119.86 },
  ])
  assert.deepEqual(result, [730, 730])
  assert.equal(result[0] + 500, 1230)
})
test('椭球地形不冒充真实地形初始化成功', async () => {
  await assert.rejects(
    queryTerrainHeights(new C.EllipsoidTerrainProvider(), [
      { lat: 30, lng: 120 },
    ]),
    /椭球地形/
  )
})
test('缺测或服务错误必须失败，不默认成零米', async () => {
  await assert.rejects(
    queryTerrainHeights(makeProvider(NaN), [{ lat: 30, lng: 120 }])
  )
  // 网络异常时地形服务曾返回 -49211 m 这类异常值，必须拒绝而非当作地面。
  await assert.rejects(
    queryTerrainHeights(makeProvider(-49211), [{ lat: 30, lng: 120 }]),
    /超出合理范围/
  )
  await assert.rejects(
    queryTerrainHeights(makeProvider(20000), [{ lat: 30, lng: 120 }]),
    /超出合理范围/
  )
  const provider = {
    ...makeProvider(0),
    requestTileGeometry: async () => {
      throw Error('服务不可用')
    },
  }
  await assert.rejects(queryTerrainHeights(provider, [{ lat: 30, lng: 120 }]))
})
test('超时释放等待状态并返回明确错误', async () => {
  const provider = {
    ...makeProvider(0),
    requestTileGeometry: () => new Promise(() => {}),
  }
  await assert.rejects(
    queryTerrainHeights(provider, [{ lat: 30, lng: 120 }], 10),
    /超时/
  )
})
