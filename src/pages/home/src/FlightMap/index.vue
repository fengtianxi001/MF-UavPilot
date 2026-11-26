<template>
  <BasePanel>
    <div class="location-panel">
      <div class="map-container" ref="container"></div>
      <div class="map-switches">
        <Checkbox v-model="following" size="small">{{
          t('跟随飞机')
        }}</Checkbox>
        <Checkbox v-model="headingUp" size="small">{{
          t('航向朝上')
        }}</Checkbox>
      </div>
      <!-- <div class="coordinates">
        <div>
          {{ params.lat.toFixed(5) }}° N · {{ params.lng.toFixed(5) }}° E
        </div>
        <div>
          地形
          {{
            params.groundHeight === null
              ? t('待加载')
              : `${params.groundHeight.toFixed(1)} m`
          }}
          · <span>●</span> 起点
        </div>
      </div> -->
    </div>
  </BasePanel>
</template>
<script setup lang="ts">
import { Checkbox } from '@arco-design/web-vue'
import { BasePanel } from '@/components'
import { useLeaflet, params } from '@/hooks'
import { useI18n } from '@/i18n'

const { t } = useI18n()
const { container, following, headingUp } = useLeaflet()
</script>
<style lang="scss" scoped>
.location-panel {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.map-container {
  width: 100%;
  height: 100%;
}
.map-switches,
.coordinates {
  position: absolute;
  z-index: 500;
  padding: 4px 7px;
  font-size: 10px;
  line-height: 1.6;
  color: #e2edf7;
  background: #242424;
  border: 1px solid rgba(148, 183, 209, 25%);
  border-radius: 2px;
}
.map-switches {
  right: 6px;
  bottom: 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;

  // align-items: center;w
  label {
    display: flex;
    gap: 5px;
    align-items: center;
    cursor: pointer;
  }
}
.coordinates {
  bottom: 20px;
  left: 6px;
  pointer-events: none;
  span {
    color: #39b98b;
  }
}
:deep(.heading-arrow) {
  width: 28px;
  height: 28px;
  transform-origin: center;
}
:deep(.leaflet-control-attribution) {
  font-size: 9px;
  color: #d3e2ef;
  background: #000;
  a {
    color: #8ecbff;
  }
}
</style>
