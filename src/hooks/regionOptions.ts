/**
 * 中国省 / 市 / 区县级联数据。
 * 数据来源：https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json
 * 仅为选点快速定位用途，不保证行政区划边界或名称长期有效。
 */
export interface RegionOption {
  value: number
  label: string
  /** 区域中心点，用于地图快速定位。 */
  center: [number, number]
  level: string
  isLeaf: boolean
}

const endpoint = (adcode: number) =>
  `https://geo.datav.aliyun.com/areas_v3/bound/${adcode}_full.json`

const cache = new Map<number, RegionOption[]>()

/** 仅保留可直接定位的省级；港澳台等缺少中心点或层级的条目跳过。 */
export async function fetchRegions(
  adcode: number,
  signal?: AbortSignal
): Promise<RegionOption[]> {
  const cached = cache.get(adcode)
  if (cached) return cached
  const response = await fetch(endpoint(adcode), { signal })
  if (!response.ok)
    throw new Error(`行政区划数据加载失败（HTTP ${response.status}）`)
  const data = await response.json()
  const features: any[] = Array.isArray(data?.features) ? data.features : []
  const options = features
    .map((feature) => {
      const properties = feature?.properties ?? {}
      const center = properties.center
      if (!Array.isArray(center) || center.length !== 2) return null
      if (!Number.isFinite(center[0]) || !Number.isFinite(center[1]))
        return null
      if (
        center[0] < -180 ||
        center[0] > 180 ||
        center[1] < -85 ||
        center[1] > 85
      )
        return null
      return {
        value: Number(properties.adcode),
        label: String(properties.name ?? '未命名'),
        center: [Number(center[0]), Number(center[1])] as [number, number],
        level: String(properties.level ?? ''),
        // childrenNum 大于 0 才允许继续展开，避免请求 404。
        isLeaf: !(Number(properties.childrenNum) > 0),
      }
    })
    .filter((option): option is RegionOption => option !== null)
  cache.set(adcode, options)
  return options
}

export async function fetchProvinces(signal?: AbortSignal) {
  return fetchRegions(100000, signal)
}
