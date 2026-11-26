import { onMounted, onBeforeUnmount, reactive, watch } from 'vue'
import { params } from './useUav'

// 仅平滑显示，绝不改变物理状态和告警；跨越 0/360° 沿最短路径旋转。
export function useInstrumentAttitude() {
  const attitude = reactive({
    heading: params.heading,
    pitch: params.pitch,
    roll: params.roll,
  })
  let frame = 0
  let previous: number | undefined
  const reset = () => {
    Object.assign(attitude, {
      heading: params.heading,
      pitch: params.pitch,
      roll: params.roll,
    })
    previous = undefined
  }
  watch(() => params.flightId, reset)
  const render = (now: number) => {
    const dt =
      previous === undefined ? 0 : Math.min((now - previous) / 1000, 0.1)
    previous = now
    const factor = 1 - Math.exp(-dt / 0.09)
    const delta = Math.atan2(
      Math.sin(params.heading - attitude.heading),
      Math.cos(params.heading - attitude.heading)
    )
    attitude.heading += delta * factor
    attitude.pitch += (params.pitch - attitude.pitch) * factor
    attitude.roll += (params.roll - attitude.roll) * factor
    frame = requestAnimationFrame(render)
  }
  onMounted(() => {
    frame = requestAnimationFrame(render)
  })
  onBeforeUnmount(() => cancelAnimationFrame(frame))
  return attitude
}
