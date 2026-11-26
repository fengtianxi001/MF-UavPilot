import * as Cesium from 'cesium'
import type { RoutePoint } from './routePlan'

/** 查询失败、超时、缺测一律拒绝，不能把未知高程当作零米地面。 */
export async function queryTerrainHeights(
  provider: Cesium.TerrainProvider,
  points: readonly RoutePoint[],
  timeoutMs = 8000
): Promise<number[]> {
  if (provider instanceof Cesium.EllipsoidTerrainProvider) {
    throw new Error('当前仅有椭球地形，请配置可用的真实地形服务后重试。')
  }
  const positions = points.map((point) =>
    Cesium.Cartographic.fromDegrees(point.lng, point.lat)
  )
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const request = provider.availability
      ? Cesium.sampleTerrainMostDetailed(provider, positions)
      : Cesium.sampleTerrain(provider, 12, positions)
    const samples = await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('地形查询超时，请检查网络或地形服务后重试。')),
          timeoutMs
        )
      }),
    ])
    return samples.map((sample) => {
      if (!Number.isFinite(sample.height))
        throw new Error('地形高程缺测，暂不能安全初始化。')
      // 地表高程合理范围约 -500 m（死海/矿区）至 8849 m；网络异常时地形服务可能返回异常值。
      if (sample.height < -500 || sample.height > 9000) {
        throw new Error(
          `地形高程 ${sample.height.toFixed(
            0
          )} m 超出合理范围，请检查地形服务。`
        )
      }
      return sample.height
    })
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
