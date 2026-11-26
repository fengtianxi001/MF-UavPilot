<template>
  <BasePanel>
    <div class="instrument" :aria-label="t('姿态仪')">
      <div class="dial">
        <div class="bank-scale">
          <span
            v-for="angle in [-60, -45, -30, -15, 0, 15, 30, 45, 60]"
            :key="angle"
            :style="{ transform: `rotate(${angle}deg)` }"
          ></span>
        </div>
        <div class="horizon-window">
          <div
            class="rotating-world"
            :style="{ transform: `rotate(${-degrees(attitude.roll)}deg)` }"
          >
            <div
              class="world"
              :style="{
                transform: `translateY(${degrees(attitude.pitch) * 1.6}px)`,
              }"
            >
              <div class="horizon-line"></div>
              <div
                v-for="angle in [-30, -20, -10, 10, 20, 30]"
                :key="angle"
                class="pitch-line"
                :style="{ top: `calc(50% - ${angle * 1.6}px)` }"
              >
                <span>{{ Math.abs(angle) }}</span
                ><i></i><span>{{ Math.abs(angle) }}</span>
              </div>
            </div>
          </div>
          <div class="aircraft-reference"><i></i><b></b><i></i></div>
        </div>
        <div
          class="bank-pointer"
          :style="{ transform: `rotate(${-degrees(attitude.roll)}deg)` }"
        >
          ▼
        </div>
      </div>
      <div class="readout">
        {{ t('俯仰角') }} {{ degrees(attitude.pitch).toFixed(1) }}° · {{ t('坡度') }}
        {{ degrees(attitude.roll).toFixed(1) }}°
      </div>
      <div v-if="params.stalled || params.crashed" class="warning">
        {{ params.crashed ? t('已触地') : t('失速警告') }}
      </div>
    </div>
  </BasePanel>
</template>
<script setup lang="ts">
import { BasePanel } from '@/components'
import { params } from '@/hooks/useUav'
import { useI18n } from '@/i18n'

const { t } = useI18n()
import { useInstrumentAttitude } from '@/hooks/useInstrumentAttitude'
const attitude = useInstrumentAttitude()
const degrees = (value: number) => (value * 180) / Math.PI
</script>
<style lang="scss" scoped>
.instrument {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.dial {
  position: relative;
  flex-shrink: 0;
  width: 154px;
  height: 154px;
  background: #2f2f30;
  border: 1px solid #536173;
  border-radius: 50%;
}
.horizon-window {
  position: absolute;
  inset: 14px;
  overflow: hidden;
  border: 1px solid #738093;
  border-radius: 50%;
}
.rotating-world {
  position: absolute;
  inset: 0;
}
.world {
  position: absolute;
  inset: -150px;
  background: linear-gradient(
    to bottom,
    #286599 0%,
    #5598bd 49.8%,
    #946b40 50%,
    #513820 100%
  );
}
.horizon-line {
  position: absolute;
  top: 50%;
  width: 100%;
  height: 2px;
  background: #eff8ff;
}
.pitch-line {
  position: absolute;
  left: 50%;
  display: flex;
  gap: 5px;
  align-items: center;
  color: #fff;
  transform: translate(-50%, -50%);
  span {
    font-size: 9px;
  }
  i {
    width: 32px;
    border-top: 1px solid #fff;
  }
}
.aircraft-reference {
  position: absolute;
  inset: 0;
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  i {
    width: 29px;
    height: 8px;
    border-top: 3px solid #ffd777;
    border-right: 3px solid #ffd777;
  }
  i:last-child {
    border-right: 0;
    border-left: 3px solid #ffd777;
  }
  b {
    width: 6px;
    height: 6px;
    background: #ffd777;
    border-radius: 50%;
  }
}
.bank-scale {
  position: absolute;
  inset: 3px;
  span {
    position: absolute;
    left: calc(50% - 1px);
    width: 1px;
    height: 7px;
    background: #d3deeb;
    transform-origin: 1px 73px;
  }
}
.bank-pointer {
  position: absolute;
  inset: 9px;
  font-size: 10px;
  color: #ffd777;
  text-align: center;
}
.readout {
  font-size: 10px;
  color: var(--color-text-2);
}
.warning {
  position: absolute;
  bottom: 21px;
  padding: 2px 6px;
  font-size: 11px;
  color: #ffba75;
  background: #261b16;
  border-radius: 3px;
}
</style>
