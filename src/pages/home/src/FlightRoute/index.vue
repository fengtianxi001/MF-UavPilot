<template>
  <BasePanel :title="t('飞行起终点')">
    <form class="route-panel" @submit.prevent="submit">
      <div class="point-fields">
        <div class="point-title">
          <i class="start-dot"></i>
          <span style="flex: 1">{{ t('起点') }}</span>
          <Button size="mini" @click="beginPick('start')">
            {{ mapPicker.target === 'start' ? t('取消选点') : t('地图选起点') }}
          </Button>
        </div>
        <div class="coordinate-inputs">
          <label
            >{{ t('经度 ') }}°<InputNumber
              v-model="draft.startLng"
              :aria-label="t('起点经度')"
              :min="-180"
              :max="180"
              :step="0.001"
              :precision="3"
          /></label>
          <label
            >{{ t('纬度 ') }}°<InputNumber
              v-model="draft.startLat"
              :aria-label="t('起点纬度')"
              :min="-85"
              :max="85"
              :step="0.001"
              :precision="3"
          /></label>
        </div>
        <label class="altitude-input"
          >{{ t('初始离地高度 m')
          }}<InputNumber
            v-model="draft.altitude"
            :aria-label="t('初始离地高度')"
            :min="10"
            :max="10000"
            :step="1"
        /></label>
        <div class="point-title">
          <i class="end-dot"></i>
          <span style="flex: 1">{{ t('终点') }}</span>
          <Button size="mini" @click="beginPick('end')">
            {{ mapPicker.target === 'end' ? t('取消选点') : t('地图选终点') }}
          </Button>
        </div>
        <div class="coordinate-inputs">
          <label
            >{{ t('经度 ') }}°<InputNumber
              v-model="draft.endLng"
              :aria-label="t('终点经度')"
              :min="-180"
              :max="180"
              :step="0.001"
              :precision="3"
          /></label>
          <label
            >{{ t('纬度 ') }}°<InputNumber
              v-model="draft.endLat"
              :aria-label="t('终点纬度')"
              :min="-85"
              :max="85"
              :step="0.001"
              :precision="3"
          /></label>
        </div>
      </div>
      <label class="altitude-input"
        >{{ t('终点到达半径 m')
        }}<InputNumber
          v-model="draft.arrivalRadius"
          :aria-label="t('终点到达半径')"
          :min="25"
          :max="1000"
          :step="10"
      /></label>
      <div class="route-summary">
        {{ t('已设航段 ') }}{{ formatDistance(plannedDistance) }}
        {{ t('距目标 ') }}{{ formatDistance(remainingDistance) }}
      </div>
      <div class="route-actions">
        <!-- <Button long type="outline" @click="useCurrentPosition">{{ t('当前位置作起点') }}</Button> -->
        <Button
          long
          type="primary"
          html-type="submit"
          :disabled="params.initializing"
          size="small"
        >
          {{
            params.initializing ? t('正在查询起点地形…') : t('应用并重新开始')
          }}
        </Button>
      </div>
      <!-- <p class="message" :class="{ error: hasError }" role="status">
        {{ message }}
      </p>
      <div class="mission-summary" :aria-label="t('飞行任务统计')">
        <strong>{{ missionStatus }}</strong>
        <div>
          {{ t('模拟耗时 ') }}{{ formatTime(params.elapsedSeconds) }} {{ t(' · 航程') }}
          {{ formatDistance(params.distanceMeters) }}
        </div>
        <div>{{ terrainStatus }}</div>
        <div>{{ t('到达只判定水平范围，不代表降落。地形预警为演示预测。') }}</div>
      </div> -->
      <!-- <p class="route-note">
        {{ t('高度不是离地高度，请避开山体；终点仅作标记，不自动驾驶或降落。') }}
      </p> -->
    </form>
    <MapPointDialog :initial-point="pickerInitialPoint" />
  </BasePanel>
</template>
<script setup lang="ts">
import { computed, reactive, ref, watch, onBeforeUnmount } from 'vue'
import { BasePanel } from '@/components'
import { Button, InputNumber, Tag } from '@arco-design/web-vue'
import { params } from '@/hooks/useUav'
import { useI18n } from '@/i18n'
const { t, locale } = useI18n()
import {
  routePlan,
  routeGeometry,
  applyRoute,
  mapPicker,
} from '@/hooks/routePlan'
import MapPointDialog from './MapPointDialog.vue'

const draft = reactive({
  startLng: routePlan.start.lng,
  startLat: routePlan.start.lat,
  altitude:
    routePlan.start.heightReference === 'agl' ? routePlan.start.altitude : 500,
  arrivalRadius: routePlan.arrivalRadius ?? 100,
  endLng: routePlan.end.lng,
  endLat: routePlan.end.lat,
})
const message = ref('')
const hasError = ref(false)
// 初始提示随语言切换重新生成；用户操作后会被具体消息覆盖。
watch(
  () => locale.value,
  () => {
    if (!message.value)
      message.value = t('修改后点击应用，重置航迹与飞行状态。')
  },
  { immediate: true }
)
const missionStatus = computed(() =>
  params.initializing
    ? t('查询起点地形中')
    : params.initializationError
    ? t('初始化失败，请重试')
    : params.outcome === 'arrived'
    ? t('已到达终点 · 飞行完成')
    : params.outcome === 'crashed'
    ? t('已触地 · 飞行结束')
    : params.paused
    ? t('飞行暂停')
    : t('飞行中')
)
const terrainStatus = computed(() =>
  params.terrainAhead.status === 'risk'
    ? t('前方地形：净空不足')
    : params.terrainAhead.status === 'safe'
    ? t('前方地形：本次采样净空充足')
    : t('前方地形：等待查询 / 数据不可用')
)
const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}${t('分')}${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}${t('秒')}`
watch(
  () => params.initializationError,
  (error) => {
    if (error) {
      hasError.value = true
      message.value = error
    }
  }
)
watch(
  () => params.initializing,
  (loading, previous) => {
    if (previous && !loading && !params.initializationError) {
      hasError.value = false
      message.value = `${t('起点地形 ')}${
        params.groundHeight?.toFixed(1) ?? t('未知')
      } ${t('米，已按离地高度开始飞行。')}`
    }
  }
)
const pickerInitialPoint = computed(() => {
  const isStart = mapPicker.target === 'start'
  const lat = Number(isStart ? draft.startLat : draft.endLat)
  const lng = Number(isStart ? draft.startLng : draft.endLng)
  return Number.isFinite(lat) &&
    Math.abs(lat) <= 85 &&
    Number.isFinite(lng) &&
    Math.abs(lng) <= 180
    ? { lat, lng }
    : { lat: params.lat, lng: params.lng }
})
const beginPick = (target: 'start' | 'end') => {
  mapPicker.target = mapPicker.target === target ? null : target
  hasError.value = false
  message.value = mapPicker.target
    ? t('请在弹窗地图中选点并确认，Esc 可取消。')
    : t('已取消选点，草稿未更改。')
}
watch(
  () => mapPicker.revision,
  () => {
    const selected = mapPicker.selection
    if (!selected) return
    if (selected.target === 'start') {
      draft.startLat = selected.lat
      draft.startLng = selected.lng
    } else {
      draft.endLat = selected.lat
      draft.endLng = selected.lng
    }
    hasError.value = false
    message.value = `${
      selected.target === 'start' ? t('已选起点') : t('已选终点')
    }${t('，点击应用后生效；初始高度保持不变。')}`
  }
)
onBeforeUnmount(() => {
  mapPicker.target = null
})
watch(
  () => mapPicker.target,
  (target, previous) => {
    // 用完整文案比较，避免多语言切换后前缀判断失效。
    if (
      !target &&
      previous &&
      message.value === t('请在弹窗地图中选点并确认，Esc 可取消。')
    ) {
      message.value = t('已取消选点，草稿未更改。')
    }
  }
)
const plannedDistance = computed(
  () => routeGeometry(routePlan.start, routePlan.end).distance
)
const remainingDistance = computed(
  () => routeGeometry(params, routePlan.end).distance
)
const formatDistance = (meters: number) =>
  meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(0)} m`
const useCurrentPosition = () => {
  draft.startLat = params.lat
  draft.startLng = params.lng
  if (params.groundHeight !== null) {
    draft.altitude = Math.max(10, params.altitude - params.groundHeight)
  }
  hasError.value = false
  message.value =
    params.groundHeight === null
      ? t('已填入当前位置；高程未知，离地高度保留原设置。')
      : t('已填入当前位置和离地高度，点击应用后生效。')
}
const submit = () => {
  if (
    Object.values(draft).some(
      (value) =>
        value === null || value === undefined || !Number.isFinite(value)
    )
  ) {
    hasError.value = true
    message.value = t('请完整填写起终点坐标和初始高度。')
    return
  }
  const error = applyRoute({
    start: {
      lat: Number(draft.startLat),
      lng: Number(draft.startLng),
      altitude: Number(draft.altitude),
      heightReference: 'agl',
    },
    end: { lat: Number(draft.endLat), lng: Number(draft.endLng) },
    arrivalRadius: Number(draft.arrivalRadius),
  })
  hasError.value = error !== null
  message.value =
    error ?? t('已应用配置，正在查询起点高程。失败可按 R 或重新应用重试。')
}
</script>
<style lang="scss" scoped>
.route-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  overflow: auto;
  font-size: 11px;
  color: var(--color-text-2);
}
.route-header {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
  strong {
    font-size: 14px;
    color: var(--color-text-1);
  }
  span {
    font-size: 10px;
    color: var(--color-text-3);
  }
}
.point-fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.point-title {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }
}
.start-dot {
  background: #39b98b;
}
.pick-button {
  padding: 2px 6px;
  margin-left: auto;
  font: inherit;
  font-size: 10px;
  color: rgb(var(--primary-6));
  cursor: pointer;
  background: var(--color-fill-2);
  border: 1px solid var(--color-border);
  border-radius: 3px;
}
.end-dot {
  background: #f5ae57;
}
.coordinate-inputs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 5px 6px;
  font: inherit;
  color: var(--color-text-1);
  background: var(--color-fill-2);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  &:focus {
    outline: 1px solid #4080ff;
  }
}
.altitude-input {
  display: grid;
  grid-template-columns: 1fr 85px;
  align-items: center;
}
.route-summary {
  font-size: 10px;
  color: #8eb6ec;
}
.mission-summary {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 8px;
  font-size: 10px;
  line-height: 1.6;
  color: var(--color-text-2);
  background: var(--color-fill-2);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  strong {
    color: rgb(var(--primary-6));
  }
}
.message,
.route-note {
  margin: 0;
  font-size: 10px;
  line-height: 1.6;
}
.message {
  color: #8ddbc4;
  &.error {
    color: #ffba75;
  }
}
.route-note {
  color: var(--color-text-3);
}
</style>
