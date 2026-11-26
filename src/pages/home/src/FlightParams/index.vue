<template>
  <BasePanel :width="width" :height="height">
    <div class="params-container">
      <div
        v-for="item in sources"
        :key="item.label"
        :class="['param-item', { 'param-alert': item.alert }]"
      >
        <div :class="['param-label', { 'value-alert': item.alert }]">
          {{ item.label }}
        </div>
        <div class="param-value">
          <span :class="['value-number', { 'value-alert': item.alert }]">{{
            item.value
          }}</span>
          <span :class="['value-unit', { 'value-alert': item.alert }]">{{
            item.unit
          }}</span>
        </div>
      </div>
    </div>
  </BasePanel>
</template>
<script setup lang="ts">
const props = defineProps<{ width?: number; height?: number }>()
const width = props.width
const height = props.height
import { computed } from 'vue'
import { BasePanel } from '@/components'
import { params } from '@/hooks'
import { useI18n } from '@/i18n'

const { t } = useI18n()

const sources = computed(() => [
  {
    label: t('真空速 TAS'),
    value: params.speed.toFixed(1),
    unit: 'km/h',
    alert: params.stalled,
  },
  {
    label: t('地速 GS'),
    value: params.groundSpeed.toFixed(1),
    unit: 'km/h',
    alert: params.groundSpeed < 45,
  },
  {
    label: t('离地高度 AGL'),
    value:
      params.groundHeight === null
        ? '—'
        : (params.altitude - params.groundHeight).toFixed(1),
    unit: t('米'),
    alert:
      params.groundHeight !== null &&
      params.altitude - params.groundHeight < 100,
  },
  {
    label: t('升降率'),
    value: params.verticalSpeed.toFixed(1),
    unit: 'm/s',
    alert: params.verticalSpeed < -8,
  },
  {
    label: t('航向'),
    value: (Math.round((params.heading * 180) / Math.PI) % 360)
      .toString()
      .padStart(3, '0'),
    unit: '°',
  },
  {
    label: t('俯仰角'),
    value: (params.pitch * (180 / Math.PI)).toFixed(2),
    unit: t('度'),
    alert: Math.abs((params.pitch * 180) / Math.PI) > 20,
  },
  {
    label: t('滚转角'),
    value: (params.roll * (180 / Math.PI)).toFixed(2),
    unit: t('度'),
    alert: Math.abs((params.roll * 180) / Math.PI) > 45,
  },
  {
    label: t('迎角 AoA'),
    value: ((params.angleOfAttack * 180) / Math.PI).toFixed(1),
    unit: '°',
    alert:
      params.stalled || Math.abs((params.angleOfAttack * 180) / Math.PI) >= 15,
  },
  { label: t('油门'), value: (params.throttle * 100).toFixed(0), unit: '%' },
  { label: t('推力'), value: params.thrust.toFixed(0), unit: 'N' },
  {
    label: t('气动过载'),
    value: params.loadFactor.toFixed(2),
    unit: 'g',
    alert: params.loadFactor < 0.5 || params.loadFactor > 2,
  },
  {
    label: t('风 / 漂移'),
    value: params.windSpeed.toFixed(1),
    unit: `m/s · ${((params.driftAngle * 180) / Math.PI).toFixed(0)}°`,
    alert: Math.abs((params.driftAngle * 180) / Math.PI) > 15,
  },
])
</script>
<style lang="scss" scoped>
.params-container {
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: center;
  width: 100%;
  height: 100%;

  // border: 1px solid var(--color-border);
}
.param-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 100%;
  padding: 0 6px;
  text-align: center;
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  &.param-alert {
    background: rgba(245, 63, 63, 12%);
    border-color: rgba(245, 63, 63, 35%);
  }
  &:nth-child(4n) {
    border-right: none;
  }
  &:nth-child(n + 9) {
    border-bottom: none;
  }
}
.param-label {
  font-size: 12px;
  color: var(--color-neutral-6);
}
.param-value {
  margin-top: 4px;
  font-size: 16px;
  white-space: nowrap;
}
.value-number {
  font-family: DincorosBlack;
}
.value-unit {
  margin-left: 6px;
  font-size: 12px;
  color: var(--color-neutral-6);
}
.value-alert {
  color: #f53f3f;
}
</style>
