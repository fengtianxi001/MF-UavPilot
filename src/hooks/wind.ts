import { reactive } from 'vue'

export interface WindSettings {
  enabled: boolean
  /** 气象风向：风的来向，正北 0°，顺时针增加。 */
  fromDegrees: number
  /** 稳定风或平均风速，m/s。 */
  speed: number
  /** 阵风峰值幅度，m/s。 */
  gustSpeed: number
  /** 主要阵风周期，秒。 */
  gustPeriodSeconds: number
}

export interface WindVector {
  /** 风矢量指去的北方分量，m/s。 */
  north: number
  /** 风矢量指去的东方分量，m/s。 */
  east: number
  speed: number
  fromDegrees: number
  /** 当前阵风相对平均风的增量，m/s。 */
  gust: number
}

// 默认轻风，便于观察真空速与地速差异；可在界面关闭。
export const windSettings = reactive<WindSettings>({
  enabled: true,
  fromDegrees: 250,
  speed: 6,
  gustSpeed: 3,
  gustPeriodSeconds: 11,
})

const finite = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback

/**
 * 稳定风叠加双正弦阵风。纯函数：同一参数与时间返回相同风场，
 * 不依赖随机数，暂停恢复后不会跳变。并非真实气象模型。
 */
export function windAt(settings: WindSettings, seconds: number): WindVector {
  if (!settings.enabled) {
    return { north: 0, east: 0, speed: 0, fromDegrees: 0, gust: 0 }
  }
  const t = Math.max(0, finite(seconds))
  const period = Math.max(2, finite(settings.gustPeriodSeconds, 11))
  const gustAmplitude = Math.max(0, finite(settings.gustSpeed))
  // 两个互不整除的周期减少重复感；加权后峰值不超过设定幅度。
  const gust =
    gustAmplitude *
    (0.62 * Math.sin((2 * Math.PI * t) / period) +
      0.38 * Math.sin((2 * Math.PI * t) / (period * 0.37) + 1.3))
  const baseSpeed = Math.max(0, finite(settings.speed))
  const speed = Math.max(0, baseSpeed + gust)
  const fromDegrees =
    finite(settings.fromDegrees) +
    (gustAmplitude > 0 ? 8 * (gust / gustAmplitude) : 0)
  const from = (fromDegrees * Math.PI) / 180
  // 来向 θ 的风吹向 θ+180°，因此南北/东西分量取反。
  return {
    north: -Math.cos(from) * speed,
    east: -Math.sin(from) * speed,
    speed,
    fromDegrees: ((fromDegrees % 360) + 360) % 360,
    gust,
  }
}
