<template>
  <div class="container">
    <BasePanel :width="20" :height="18">
      <div
        class="flight-view"
        :class="{ 'has-flight-alert': alerts.length > 0 }"
      >
        <div class="flight-canvas" ref="container"></div>
        <FlightCompass />
        <FlightCamera
          :camera-mode="cameraMode"
          @change="setCameraMode"
          @reset="resetCamera"
        />
        <FlightMission :params="params" @restart="restartFlight" />
        <FlightAlert :alerts="alerts" />
      </div>
    </BasePanel>
    <FlightRoute :width="4" :height="9" />
    <FlightWind :width="4" :height="9" />
    <FlightMap :width="5" :height="6" />
    <FlightParams :width="6" :height="6" />
    <FlightAltitude :width="6" :height="6" />

    <FlightControls :width="3" :height="6" />
    <FlightAttitude :width="4" :height="6" />
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { BasePanel } from '@/components'
import {
  FlightRoute,
  FlightCompass,
  FlightParams,
  FlightAltitude,
  FlightAttitude,
  FlightMap,
  FlightControls,
} from './src'
import FlightMission from './src/FlightMission/index.vue'
import FlightAlert from './src/FlightAlert/index.vue'
import FlightCamera from './src/FlightCamera/index.vue'
import { params, useUav } from '@/hooks/useUav'
import { getFlightAlerts } from '@/hooks/flightAlerts'
import FlightWind from './src/FlightWind/index.vue'

const { container, cameraMode, setCameraMode, resetCamera, restartFlight } =
  useUav()
const alerts = computed(() => getFlightAlerts(params))
</script>
<style lang="scss" scoped>
.container {
  box-sizing: border-box;
  display: grid;
  grid-template-rows: repeat(24, 1fr);
  grid-template-columns: repeat(24, 1fr);
  grid-auto-flow: row dense;
  grid-gap: 10px;
  width: 100%;
  height: 100%;
}
.flight-view {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.flight-canvas {
  width: 100%;
  height: 100%;

  // 仅隐藏品牌图标，不隐藏数据提供方署名与 Data attribution 入口。
  :deep([class~='cesium-credit-logoContainer']) {
    display: none;
  }
}
</style>
