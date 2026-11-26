<template>
  <div class="heading-overlay" :aria-label="t('顶部真航向指南针')">
    <div ref="tape" class="heading-tape">
      <div class="heading-readout">
        <span>{{ t('真航向') }}</span
        ><strong>{{ heading }}°</strong><b>{{ direction }}</b>
        <span class="target-readout">{{
          targetInRange ? t('目标范围内') : `${t('目标 ')}${targetHeading}°`
        }}</span>
      </div>
      <div class="tape-window">
        <div
          v-for="tick in ticks"
          :key="tick.angle"
          class="tape-tick"
          :class="{ major: tick.major, cardinal: tick.cardinal }"
          :style="{ left: `calc(50% + ${(tick.angle - degrees) * 4}px)` }"
        >
          <span v-if="tick.major">{{ tick.label }}</span
          ><i></i>
        </div>
      </div>
      <div class="center-pointer"></div>
      <div
        v-if="!targetInRange"
        class="target-marker"
        :style="{ left: `calc(50% + ${targetOffset}px)` }"
        :title="`${t('目的地方位 ')}${targetHeading}°，${targetHint}`"
      >
        {{ targetOffscreen ? (targetDelta < 0 ? '◀' : '▶') : '◆' }}
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useInstrumentAttitude } from '@/hooks/useInstrumentAttitude'
import { params } from '@/hooks/useUav'
import { routePlan, routeGeometry } from '@/hooks/routePlan'
import { useI18n } from '@/i18n'
const { t } = useI18n()

const attitude = useInstrumentAttitude()
const tape = ref<HTMLElement>()
const tapeWidth = ref(760)
let resizeObserver: ResizeObserver | undefined
const target = computed(() => routeGeometry(params, routePlan.end))
const targetHeading = computed(() =>
  (Math.round((target.value.bearing * 180) / Math.PI) % 360)
    .toString()
    .padStart(3, '0')
)
const targetInRange = computed(
  () => target.value.distance <= (routePlan.arrivalRadius ?? 100)
)
const targetDelta = computed(() => {
  const delta = target.value.bearing - attitude.heading
  return (Math.atan2(Math.sin(delta), Math.cos(delta)) * 180) / Math.PI
})
const maximumOffset = computed(() => Math.max(0, tapeWidth.value / 2 - 24))
const targetOffset = computed(() =>
  Math.max(
    -maximumOffset.value,
    Math.min(maximumOffset.value, targetDelta.value * 4)
  )
)
const targetOffscreen = computed(
  () => Math.abs(targetDelta.value * 4) > maximumOffset.value
)
const targetHint = computed(() =>
  Math.abs(targetDelta.value) < 1
    ? t('对准目标')
    : `${targetDelta.value < 0 ? t('向左') : t('向右')} ${Math.abs(
        targetDelta.value
      ).toFixed(0)}°`
)
onMounted(() => {
  if (!tape.value) return
  resizeObserver = new ResizeObserver((entries) => {
    tapeWidth.value = entries[0].contentRect.width
  })
  resizeObserver.observe(tape.value)
})
onBeforeUnmount(() => resizeObserver?.disconnect())
const degrees = computed(() => (attitude.heading * 180) / Math.PI)
const normalized = computed(() => ((degrees.value % 360) + 360) % 360)
const heading = computed(() =>
  (Math.round(normalized.value) % 360).toString().padStart(3, '0')
)
const direction = computed(
  () =>
    ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][
      Math.round(normalized.value / 45) % 8
    ]
)
const ticks = computed(() => {
  const center = Math.floor(degrees.value / 5) * 5
  return Array.from({ length: 41 }, (_, index) => {
    const angle = center + (index - 20) * 5
    const value = ((angle % 360) + 360) % 360
    const cardinal = value % 90 === 0
    return {
      angle,
      major: value % 15 === 0,
      cardinal,
      label: cardinal
        ? ['N', 'E', 'S', 'W'][value / 90]
        : String(value).padStart(3, '0'),
    }
  })
})
</script>
<style lang="scss" scoped>
.heading-overlay {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  z-index: 2;
  display: flex;
  justify-content: center;
  padding: 6px 12px 12px;
  pointer-events: none;
  background: linear-gradient(to bottom, rgba(8, 17, 26, 65%), transparent);
}
.heading-tape {
  position: relative;
  width: 760px;
  max-width: 100%;
  height: 58px;
}
.heading-readout {
  position: absolute;
  top: 0;
  left: 50%;
  display: flex;
  gap: 7px;
  align-items: center;

  // align-items: baseline;
  padding: 2px 10px;
  color: #f0f6ff;
  white-space: nowrap;
  background: #2f2f30;

  // background: #4e7df7;

  // border: 1px solid #242424;
  border-radius: 4px;
  transform: translateX(-50%);
  span {
    font-size: 10px;
    color: #b6c8db;
  }
  strong {
    font-family: DincorosBlack, monospace;
    font-size: 19px;
  }
  b {
    font-size: 12px;
    color: #ffd777;
  }
  .target-readout {
    padding-left: 7px;
    color: #70e1e8;
    border-left: 1px solid rgba(151, 188, 219, 40%);
  }
}
.target-marker {
  position: absolute;
  bottom: -3px;
  z-index: 1;
  font-size: 15px;
  line-height: 18px;
  color: #70e1e8;
  text-shadow: 0 1px 3px #000;
  transform: translateX(-50%);
}
.tape-window {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 28px;
  overflow: hidden;
  mask-image: linear-gradient(
    to right,
    transparent,
    #000 12%,
    #000 88%,
    transparent
  );
}
.tape-tick {
  position: absolute;
  bottom: 0;
  width: 1px;
  height: 28px;
  color: #dce8f5;
  span {
    position: absolute;
    top: 0;
    left: 0;
    font-size: 10px;
    text-shadow: 0 1px 3px #000;
    transform: translateX(-50%);
  }
  i {
    position: absolute;
    bottom: 0;
    width: 1px;
    height: 5px;
    background: #dce8f5;
  }
  &.major i {
    height: 10px;
  }
  &.cardinal {
    font-weight: 700;
    color: #8ed4ff;
  }
}
.center-pointer {
  position: absolute;
  bottom: -5px;
  left: calc(50% - 4px);
  border-right: 4px solid transparent;
  border-bottom: 6px solid #ffd777;
  border-left: 4px solid transparent;
}
</style>
