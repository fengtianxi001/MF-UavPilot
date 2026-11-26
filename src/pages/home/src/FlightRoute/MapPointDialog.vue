<template>
  <Modal
    :visible="mapPicker.target !== null"
    :title="`${t('地图选择')}${
      mapPicker.target === 'start' ? t('起点') : t('终点')
    }`"
    :width="940"
    :modal-style="{ maxWidth: '94vw' }"
    :body-style="{ padding: '10px' }"
    :mask-closable="false"
    :unmount-on-close="true"
    :ok-button-props="{ disabled: !selected }"
    :on-before-ok="confirm"
    :ok-text="t('确认选点')"
    :cancel-text="t('取消')"
    @open="resizeMap"
    @cancel="cancel"
    @keydown.stop
    @keyup.stop
  >
    <div style="position: relative" @keydown.stop @keyup.stop>
      <div class="picker-search">
        <Cascader
          v-model="regionPath"
          :options="regionOptions"
          :load-more="loadMoreRegions"
          path-mode
          :placeholder="t('按省 / 市 / 区县快速定位')"
          allow-search
          allow-clear
          size="small"
          popup-container="body"
        />
        <!-- <span v-if="regionLoading" class="region-status">行政区划加载中…</span>
        <span v-else-if="regionError" class="pick-error" role="alert">{{
          regionError
        }}</span> -->
      </div>
      <!-- <p class="picker-description">
        {{ t('可点击地图放置标记，也可按行政区快速定位；确认后仅填入坐标。') }}
      </p> -->
      <div ref="mapContainer" class="picker-map"></div>
      <!-- <div class="selection-info">
        <span>{{
          selected
            ? `经度 ${selected.lng.toFixed(6)}° · 纬度 ${selected.lat.toFixed(
                6
              )}°`
            : t('请点击地图选择位置')
        }}</span>
        <span v-if="error" class="pick-error" role="alert">{{ error }}</span>
      </div> -->
    </div>
  </Modal>
</template>
<script setup lang="ts">
import * as L from 'leaflet'
import { onBeforeUnmount, ref, watch } from 'vue'
import { Cascader, Modal } from '@arco-design/web-vue'
import type { CascaderOption } from '@arco-design/web-vue'
import { useI18n } from '@/i18n'

const { t } = useI18n()
import {
  fetchProvinces,
  fetchRegions,
  type RegionOption,
} from '@/hooks/regionOptions'
import { mapPicker, selectMapPoint, type RoutePoint } from '@/hooks/routePlan'

const props = defineProps<{ initialPoint: RoutePoint }>()
const mapContainer = ref<HTMLElement>()
const selected = ref<RoutePoint | null>(null)
const error = ref('')
const regionPath = ref<number[]>([])
const regionOptions = ref<RegionOption[]>([])
const regionLoading = ref(false)
const regionError = ref('')
let regionLoaded = false
let regionController: AbortController | undefined
let map: L.Map | undefined
let marker: L.CircleMarker | undefined
let observer: ResizeObserver | undefined

const destroyMap = () => {
  observer?.disconnect()
  observer = undefined
  map?.remove()
  map = undefined
  marker = undefined
}
const cancel = () => {
  mapPicker.target = null
}
const confirm = () => {
  if (!selected.value) return false
  if (!selectMapPoint(selected.value)) {
    error.value = t('该位置超出支持范围，请重新选点。')
    return false
  }
  return true
}

watch(
  () => mapPicker.target,
  () => {
    destroyMap()
    selected.value = null
    error.value = ''
  }
)

const resizeMap = () => {
  map?.invalidateSize()
}

const loadProvinces = async () => {
  if (regionLoaded || regionLoading.value) return
  regionLoading.value = true
  regionError.value = ''
  regionController = new AbortController()
  try {
    regionOptions.value = await fetchProvinces(regionController.signal)
    regionLoaded = true
  } catch (cause) {
    if ((cause as Error)?.name === 'AbortError') return
    regionError.value = t('行政区划加载失败，可继续在地图上点击选点。')
  } finally {
    regionLoading.value = false
  }
}

// Arco Cascader 懒加载：只有 childrenNum > 0 的节点才会继续请求。
const loadMoreRegions = (
  option: CascaderOption,
  done: (children?: CascaderOption[]) => void
) => {
  const adcode = Number(option.value)
  if (!Number.isFinite(adcode)) {
    done([])
    return
  }
  regionLoading.value = true
  regionError.value = ''
  fetchRegions(adcode)
    .then((children) => {
      // 同步写入本地选项树，便于按 adcode 反查中心点。
      option.children = children
      done(children)
    })
    .catch(() => {
      regionError.value = t('下级行政区加载失败，请重试。')
      done([])
    })
    .finally(() => {
      regionLoading.value = false
    })
}

// 监听 v-model 路径而非 change 事件，兼容 Arco 懒加载下的值结构。
watch(regionPath, (value) => locateRegion(value), { deep: true })

const markPoint = (point: RoutePoint) => {
  if (!map) return
  selected.value = point
  if (marker) marker.setLatLng([point.lat, point.lng])
  else
    marker = L.circleMarker([point.lat, point.lng], {
      radius: 8,
      color: 'rgb(var(--primary-6))',
      fillOpacity: 0.45,
      weight: 3,
    }).addTo(map)
  map.setView([point.lat, point.lng], map.getZoom(), { animate: true })
}

// 按 adcode 或名称路径在已加载选项中查找中心点。
const findRegion = (
  options: RegionOption[],
  path: (number | string)[]
): RegionOption | undefined => {
  const [head, ...rest] = path
  if (head === undefined) return undefined
  const match = options.find(
    (option) => option.value === Number(head) || option.label === String(head)
  )
  if (!match || rest.length === 0) return match
  const children = (match as RegionOption & { children?: RegionOption[] })
    .children
  return children ? findRegion(children, rest) : undefined
}

const locateRegion = (value: unknown) => {
  const path = (Array.isArray(value) ? value : [value]).filter(
    (item) => item !== undefined && item !== null && item !== ''
  ) as (number | string)[]
  if (!path.length) return
  const target = findRegion(regionOptions.value, path)
  if (!target) return
  const [lng, lat] = target.center
  error.value = ''
  markPoint({ lat, lng })
}

// 容器挂载后初始化，过渡结束后再校正尺寸；不依赖隐藏标签页的动画帧。
const initializeMap = () => {
  if (!mapPicker.target || !mapContainer.value) return
  destroyMap()
  // 独立北向地图，不与小地图的旋转、跟随设置互相影响。
  map = L.map(mapContainer.value, {
    // 选点弹窗不显示缩放和旋转按钮，保留滚轮缩放与点击选点。
    zoomControl: false,
    rotateControl: false,
    doubleClickZoom: false,
  }).setView([props.initialPoint.lat, props.initialPoint.lng], 13)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 10,
  }).addTo(map)
  map.on('click', (event: L.LeafletMouseEvent) => {
    const point = event.latlng.wrap()
    if (Math.abs(point.lat) > 85) {
      error.value = t('纬度须在 -85° 至 85° 之间，请重新选点。')
      return
    }
    error.value = ''
    markPoint({ lat: point.lat, lng: point.lng })
  })
  observer = new ResizeObserver(() => map?.invalidateSize())
  observer.observe(mapContainer.value)
  map.invalidateSize()
  void loadProvinces()
}
watch(
  mapContainer,
  (element) => {
    if (element && mapPicker.target) {
      setTimeout(() => initializeMap(), 500)
    }
  },
  { flush: 'post' }
)
onBeforeUnmount(() => {
  regionController?.abort()
  destroyMap()
})
</script>
<style lang="scss" scoped>
.picker-search {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 9999;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  background-color: var(--color-bg-3);
  .arco-cascader {
    width: 280px;
    max-width: 100%;
  }
}
.region-status {
  font-size: 11px;
  color: var(--color-text-3);
}
.picker-description {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--color-text-3);
}
.picker-map {
  width: 100%;
  height: min(55vh, 500px);
  cursor: crosshair;
}
.selection-info {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  padding-top: 12px;
  font-size: 12px;
}
.pick-error {
  color: #ffba75;
}
</style>
