<template>
  <BasePanel :width="width" :height="height">
    <div class="altimeter">
      <div class="chart-toolbar">
        <RadioGroup
          v-model="view"
          type="button"
          size="mini"
          :aria-label="t('高度曲线类型')"
        >
          <Radio value="history">{{ t('历史高度') }}</Radio>
          <Radio value="terrain">{{ t('前方地形') }}</Radio>
        </RadioGroup>
        <span class="chart-status">{{ status }}</span>
      </div>
      <div class="height-chart" ref="container"></div>
    </div>
  </BasePanel>
</template>
<script setup lang="ts">
import { BasePanel } from '@/components'
import { Radio, RadioGroup } from '@arco-design/web-vue'
const props = defineProps<{ width?: number; height?: number }>()
const width = props.width
const height = props.height
import { useEcharts, params } from '@/hooks'
import { useI18n } from '@/i18n'
const { t } = useI18n()
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import type { EChartsOption } from 'echarts'
import { assessTerrain } from '@/hooks/flightMission'
import dayjs from 'dayjs'

const { container, setOption, chart } = useEcharts()
const view = ref<'history' | 'terrain'>('history')
const now = ref(Date.now())
const profileFresh = computed(
  () =>
    params.terrainProfile.status === 'ready' &&
    params.terrainProfile.sampledAt !== null &&
    now.value - params.terrainProfile.sampledAt <= 5000 &&
    !params.initializing &&
    !params.initializationError &&
    params.outcome === 'flying'
)
interface Sample {
  label: string
  agl: number | null
  event?: string
}
const samples: Sample[] = []
let timer: ReturnType<typeof setInterval> | undefined
let resizeObserver: ResizeObserver | undefined
const status = computed(() => {
  if (view.value === 'terrain') {
    if (params.initializing) return t('起点地形查询中')
    if (params.outcome !== 'flying') return t('飞行已结束 · 预测停止')
    if (profileFresh.value)
      return `${t('采样快照 · ')}${Math.max(0, Math.floor((now.value - params.terrainProfile.sampledAt!) / 1000))} ${t('秒前')}`
    if (params.terrainProfile.status === 'ready') return t('数据已过期 · 等待更新')
    return params.terrainProfile.message
  }
  if (params.initializing) return t('起点地形查询中')
  if (params.initializationError) return t('初始化失败 · 未记录')
  if (params.outcome === 'arrived') return t('已到达 · 记录结束')
  if (params.crashed) return t('已触地 · 记录结束')
  if (params.paused) return t('已暂停')
  if (params.groundHeight === null) return t('地形未就绪 · 暂无离地数据')
  return t('每秒采样')
})
const applyOption = (option: EChartsOption) => {
  if (chart.value) chart.value.setOption(option, { notMerge: true })
  else setOption(option)
}
const renderTerrain = () => {
  const data = profileFresh.value ? params.terrainProfile.samples : []
  const risk = assessTerrain(
    data.map((item) => ({
      lat: 0,
      lng: 0,
      seconds: item.seconds,
      projectedAltitude: item.projectedAltitude,
    })),
    data.map((item) => item.height)
  )
  applyOption({
    animation: false,
    grid: { left: 50, right: 12, top: 33, bottom: 32 },
    legend: {
      top: 0,
      itemWidth: 12,
      itemHeight: 5,
      textStyle: { fontSize: 9, color: '#86909c' },
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) =>
        value == null ? t('缺测') : `${Number(value).toFixed(1)} ${t('米')}`,
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: 20,
      name: t('预测秒'),
      nameLocation: 'middle',
      nameGap: 20,
      nameTextStyle: { color: '#86909c', fontSize: 9 },
      axisLabel: { fontSize: 9, color: '#86909c' },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: t('椭球高度(米)'),
      nameLocation: 'middle',
      nameGap: 34,
      nameTextStyle: { color: '#86909c', fontSize: 10 },
      axisLabel: { fontSize: 9, color: '#86909c' },
      splitLine: {
        lineStyle: { color: 'rgba(134,144,156,0.12)', type: 'dashed' },
      },
    },
    graphic: data.length
      ? []
      : [
          {
            type: 'text',
            left: 'center',
            top: 'middle',
            style: { text: status.value, fill: '#86909c', fontSize: 11 },
          },
        ],
    series: [
      {
        name: t('地形'),
        type: 'line',
        showSymbol: false,
        connectNulls: false,
        data: data.map((item) => [item.seconds, item.height]),
        lineStyle: { color: '#ad895c', width: 1.5 },
        itemStyle: { color: '#ad895c' },
        areaStyle: { color: 'rgba(173,137,92,0.22)' },
      },
      {
        name: t('净空参考+100m'),
        type: 'line',
        showSymbol: false,
        connectNulls: false,
        data: data.map((item) => [
          item.seconds,
          item.height === null ? null : item.height + 100,
        ]),
        lineStyle: { color: '#e8a56a', width: 1, type: 'dashed' },
        itemStyle: { color: '#e8a56a' },
      },
      {
        name: t('预计飞行轨迹'),
        type: 'line',
        showSymbol: false,
        data: data.map((item) => [item.seconds, item.projectedAltitude]),
        lineStyle: { color: '#60baff', width: 0.5 },
        itemStyle: { color: '#60baff' },
        markLine: {
          symbol: ['none', 'none'],
          lineStyle: { color: '#f76560', type: 'dashed' },
          label: {
            color: '#f76560',
            fontSize: 9,
            formatter: `${t('风险 ')}${risk.seconds?.toFixed(1)}s`,
            position: 'insideEndTop',
          },
          data: risk.status === 'risk' ? [{ xAxis: risk.seconds! }] : [],
        },
      },
    ],
  })
}
const renderChart = () => {
  if (view.value === 'terrain') return renderTerrain()
  applyOption({
    animation: false,
    grid: { left: 50, right: 14, top: 24, bottom: 24 },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => (value == null ? t('缺测') : `${value} ${t('米')}`),
    },
    xAxis: {
      type: 'category',
      data: samples.map((item) => item.label),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { fontSize: 10, color: '#86909c', hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      name: t('离地高度 AGL (米)'),
      nameLocation: 'middle',
      nameGap: 34,
      nameTextStyle: { color: '#86909c', fontSize: 10 },
      axisLabel: { fontSize: 10, color: '#86909c' },
      splitLine: {
        lineStyle: { color: 'rgba(134,144,156,0.12)', type: 'dashed' },
      },
    },
    series: [
      {
        name: t('离地高度'),
        type: 'line',
        data: samples.map((item) => item.agl),
        connectNulls: false,
        showSymbol: false,
        lineStyle: { width: 0.5, color: '#4080ff' },
        areaStyle: { color: 'rgba(64,128,255,0.10)' },
        itemStyle: { color: '#4080ff' },
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          lineStyle: { type: 'dashed', color: '#e88b64' },
          label: { color: '#e88b64', fontSize: 10, position: 'insideEndTop' },
          data: [
            { yAxis: 100, label: { formatter: t('低空参考 100 m') } },
            ...samples.flatMap((item, index) =>
              item.event
                ? [{ xAxis: index, label: { formatter: item.event } }]
                : []
            ),
          ],
        },
      },
    ],
  })
}
const record = (event?: string) => {
  const height = params.groundHeight
  samples.push({
    label: dayjs().format('HH:mm:ss'),
    agl:
      height === null || !Number.isFinite(height)
        ? null
        : Number((params.altitude - height).toFixed(1)),
    event,
  })
  if (samples.length > 300) samples.splice(0, samples.length - 300)
  renderChart()
}
watch(view, renderChart)
watch(() => params.terrainProfile, renderChart, { deep: true })
watch(profileFresh, renderChart)
watch(
  () => params.flightId,
  () => {
    samples.splice(0)
    record(t('重置'))
  }
)
watch(
  () => params.paused,
  (paused) => {
    if (
      !params.crashed &&
      !params.initializing &&
      !params.initializationError &&
      params.outcome === 'flying'
    )
      record(paused ? t('暂停') : t('继续'))
  }
)
watch(
  () => params.crashed,
  (crashed) => {
    if (crashed) record(t('触地'))
  }
)
watch(
  () => params.outcome,
  (outcome) => {
    if (outcome === 'arrived') record(t('到达'))
  }
)
onMounted(async () => {
  await nextTick()
  resizeObserver = new ResizeObserver(() => chart.value?.resize())
  if (container.value) resizeObserver.observe(container.value)
  requestAnimationFrame(() => record(t('开始')))
  timer = setInterval(() => {
    now.value = Date.now()
    if (
      !params.paused &&
      !params.crashed &&
      !params.initializing &&
      !params.initializationError &&
      params.outcome === 'flying' &&
      !document.hidden
    )
      record()
    else if (view.value === 'terrain') renderChart()
  }, 1000)
})
onBeforeUnmount(() => {
  if (timer !== undefined) clearInterval(timer)
  resizeObserver?.disconnect()
  chart.value?.dispose()
})
</script>
<style lang="scss" scoped>
.altimeter {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  border: 1px solid var(--color-border);
}
.chart-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px 0;
}
.height-tabs {
  display: flex;
  gap: 4px;
  button {
    padding: 3px 6px;
    font: inherit;
    font-size: 10px;
    color: var(--color-text-3);
    cursor: pointer;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 3px;
    &.active {
      color: #7eacff;
      background: rgba(64, 128, 255, 12%);
      border-color: rgba(64, 128, 255, 45%);
    }
  }
}
.chart-status {
  font-size: 10px;
  color: var(--color-text-3);
}
.height-chart {
  flex: 1;
  width: 100%;
  min-height: 0;
}
</style>
