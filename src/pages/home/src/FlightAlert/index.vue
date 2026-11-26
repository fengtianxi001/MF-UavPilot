<template>
  <div class="flight-alert-layer">
    <div
      v-if="alerts.length"
      class="flight-alert-frame"
      aria-hidden="true"
    ></div>
    <div
      v-if="alerts.length"
      class="flight-alert-region"
      role="alert"
      aria-atomic="true"
    >
      <div class="flight-alert-banner">
        <div v-for="alert in alerts" :key="alert.id" class="flight-alert-item">
          <span class="alert-icon" aria-hidden="true">!</span>
          <div>
            <strong>{{ t(alert.title) }}</strong>
            <p>{{ alert.message }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { FlightAlert } from '@/hooks/flightAlerts'
import { useI18n } from '@/i18n'
const { t } = useI18n()
defineProps<{ alerts: FlightAlert[] }>()
</script>
<style lang="scss" scoped>
.flight-alert-frame {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  border: 3px solid #ff4d4f;
  box-shadow: inset 0 0 28px 20px rgba(245, 34, 45, 28%);
}
.flight-alert-region {
  position: absolute;
  top: 82px;
  left: 50%;
  z-index: 5;
  width: 440px;
  max-width: calc(100% - 32px);
  pointer-events: none;
  transform: translateX(-50%);
}
.flight-alert-banner {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 14px;
  color: #fff0f0;
  background: rgba(91, 19, 26, 50%);
  border-radius: 2px;
}
.flight-alert-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  strong {
    font-size: 14px;
    color: #ffd0cd;
  }
  p {
    margin: 3px 0 0;
    font-size: 12px;
    line-height: 1.6;
  }
}
.alert-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-weight: 700;
  color: #fff;
  background: #d9363e;
  border: 1px solid #ffb3af;
  border-radius: 50%;
}
</style>
