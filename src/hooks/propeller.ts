// 原 GLB 动画每 1/3 秒绕局部 -Z 轴一圈；沿用其视觉转速，非真实发动机 RPM。
export const PROPELLER_VISUAL_RPS = 3

export function advancePropeller(angle: number, throttle: number, dt: number) {
  if (!Number.isFinite(dt) || dt <= 0 || !Number.isFinite(throttle))
    return angle
  const power = Math.max(0, Math.min(1, throttle))
  return (
    (angle - 2 * Math.PI * PROPELLER_VISUAL_RPS * power * dt) % (2 * Math.PI)
  )
}
