import { reactive } from 'vue'
import type { WindSettings } from './wind'

export type WeatherPresetId = 'clear' | 'overcast' | 'storm' | 'fog'

export interface WeatherPreset {
  id: WeatherPresetId
  label: string
  description: string
  /** 场景雾密度，Cesium 默认约 2e-4。 */
  fogDensity: number
  /** 地面大气亮度偏移，-1 至 1。 */
  brightness: number
  /** 地面大气饱和度偏移，-1 至 1。 */
  saturation: number
  /** 太阳光强度，Cesium 默认 2。 */
  lightIntensity: number
  /** 软阴影暗度，0 至 1，越大阴影越浅。 */
  shadowDarkness: number
  /** 能见度说明，仅用于界面展示。 */
  visibility: string
  /** 雨滴数量，0 表示不绘制雨幕。 */
  rainCount: number
  /** 雨滴下落速度倍率。 */
  rainSpeed: number
  /** 雨幕不透明度。 */
  rainOpacity: number
  /** 雾幕不透明度，0 表示不绘制雾团。 */
  fogOpacity: number
  /** 预设风场参数。 */
  wind: Omit<WindSettings, 'enabled'>
}

/**
 * 演示用天气预设。并非真实气象数据，也不会改变气动力或失速判据，
 * 只影响渲染与风场设置，以免不同天气下飞行手感不可解释。
 */
export const WEATHER_PRESETS: readonly WeatherPreset[] = [
  {
    id: 'clear',
    label: '晴空',
    description: '能见度良好，轻风',
    fogDensity: 2e-4,
    brightness: 0,
    saturation: 0,
    lightIntensity: 2,
    shadowDarkness: 0.25,
    visibility: '良好',
    rainCount: 0,
    rainSpeed: 1,
    rainOpacity: 0,
    fogOpacity: 0,
    wind: { fromDegrees: 250, speed: 6, gustSpeed: 3, gustPeriodSeconds: 11 },
  },
  {
    id: 'overcast',
    label: '阴天',
    description: '漫射光照，阴影变浅',
    fogDensity: 7e-4,
    brightness: -0.04,
    saturation: -0.3,
    lightIntensity: 1.35,
    shadowDarkness: 0.55,
    visibility: '中等',
    rainCount: 0,
    rainSpeed: 1,
    rainOpacity: 0,
    fogOpacity: 0.1,
    wind: { fromDegrees: 230, speed: 8, gustSpeed: 4, gustPeriodSeconds: 12 },
  },
  {
    id: 'storm',
    label: '雷雨',
    description: '能见度低，强阵风',
    fogDensity: 2.2e-3,
    brightness: -0.2,
    saturation: -0.55,
    lightIntensity: 0.75,
    shadowDarkness: 0.75,
    visibility: '低',
    rainCount: 1100,
    rainSpeed: 1.9,
    rainOpacity: 0.72,
    fogOpacity: 0.22,
    wind: { fromDegrees: 210, speed: 16, gustSpeed: 10, gustPeriodSeconds: 7 },
  },
  {
    id: 'fog',
    label: '浓雾',
    description: '能见度很低，风较弱',
    fogDensity: 4e-3,
    brightness: 0.12,
    saturation: -0.5,
    lightIntensity: 1.5,
    shadowDarkness: 0.6,
    visibility: '很低',
    rainCount: 0,
    rainSpeed: 1,
    rainOpacity: 0,
    fogOpacity: 0.72,
    wind: { fromDegrees: 260, speed: 3, gustSpeed: 1.5, gustPeriodSeconds: 15 },
  },
]

export const weatherSettings = reactive<{
  preset: WeatherPresetId
}>({ preset: 'clear' })

export function getWeatherPreset(id: WeatherPresetId): WeatherPreset {
  return (
    WEATHER_PRESETS.find((preset) => preset.id === id) ?? WEATHER_PRESETS[0]
  )
}

/** 返回可直接赋给 Cesium 场景的渲染参数。 */
export function weatherRenderParams(id: WeatherPresetId) {
  const preset = getWeatherPreset(id)
  return {
    fogDensity: preset.fogDensity,
    brightness: preset.brightness,
    saturation: preset.saturation,
    lightIntensity: preset.lightIntensity,
    shadowDarkness: preset.shadowDarkness,
  }
}

/** 雨幕参数；rainCount 为 0 表示当前天气不下雨。 */
export function rainParams(id: WeatherPresetId) {
  const preset = getWeatherPreset(id)
  return {
    count: preset.rainCount,
    speed: preset.rainSpeed,
    opacity: preset.rainOpacity,
  }
}

/** 雾幕参数；opacity 为 0 表示当前天气不绘制雾团。 */
export function fogParams(id: WeatherPresetId) {
  const preset = getWeatherPreset(id)
  return {
    opacity: preset.fogOpacity,
    // 浓雾缓慢飘动，雷雨时雾团被风吹得更快。
    speed: preset.id === 'fog' ? 0.22 : 0.45,
    scale: preset.id === 'fog' ? 2.6 : 3.4,
  }
}
