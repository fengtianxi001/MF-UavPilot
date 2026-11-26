<template>
  <BasePanel :title="t('天气与风场')">
    <div class="wind-panel">
      <div class="weather-select">
        <label>{{ t('天气预设') }}</label>
        <Select
          v-model="params.weatherPreset"
          :aria-label="t('天气预设')"
          size="small"
          popup-container="body"
          :popup-visible="weatherPopupVisible"
          @popup-visible-change="weatherPopupVisible = $event"
        >
          <Option
            v-for="item in WEATHER_PRESETS"
            :key="item.id"
            :value="item.id"
          >
            {{ t(item.label) }} · {{ t(item.description) }}
          </Option>
        </Select>
        <!-- <p class="weather-note">
          {{ t('能见度 ') }}{{ t(currentWeather.visibility) }} ·
          {{ t('只影响画面与风场，不改变气动力。') }}
        </p> -->
      </div>
      <label class="wind-toggle">{{ t('风场状态') }}</label>
      <Select
        :model-value="params.windEnabled ? 'enabled' : 'disabled'"
        :aria-label="t('风场状态')"
        size="small"
        popup-container="body"
        @update:model-value="params.windEnabled = $event === 'enabled'"
      >
        <Option value="enabled">{{ t('启用风场') }}</Option>
        <Option value="disabled">{{ t('关闭风场') }}</Option>
      </Select>
      <div class="wind-values">
        <div>
          <span>{{ t('风向（来向）') }}</span>
          <span>{{ windDirection }}°</span>
        </div>
        <div>
          <span>{{ t('当前风速') }}</span>
          <span>{{ params.windSpeed.toFixed(1) }} m/s</span>
        </div>
      </div>
      <div class="wind-inputs">
        <!-- <label>
          {{ t('来向 °') }}
          <Select
            v-model="params.windFromDegrees"
            aria-label="风来向角度"
            size="small"
            popup-container="body"
          >
            <Option :value="0">{{ t('北风 · 000°') }}</Option>
            <Option :value="45">{{ t('东北风 · 045°') }}</Option>
            <Option :value="90">{{ t('东风 · 090°') }}</Option>
            <Option :value="135">{{ t('东南风 · 135°') }}</Option>
            <Option :value="180">{{ t('南风 · 180°') }}</Option>
            <Option :value="225">{{ t('西南风 · 225°') }}</Option>
            <Option :value="270">{{ t('西风 · 270°') }}</Option>
            <Option :value="315">{{ t('西北风 · 315°') }}</Option>
          </Select>
        </label> -->
        <label>
          {{ t('平均风速 m/s') }}
          <InputNumber
            v-model="params.windBaseSpeed"
            :aria-label="t('平均风速')"
            :min="0"
            :max="30"
            :step="0.5"
            :disabled="!params.windEnabled"
            size="small"
          />
        </label>
        <label>
          {{ t('阵风幅度 m/s') }}
          <InputNumber
            v-model="params.windGustSpeed"
            :aria-label="t('阵风幅度')"
            :min="0"
            :max="15"
            :step="0.5"
            :disabled="!params.windEnabled"
            size="small"
          />
        </label>
        <label>
          {{ t('阵风周期 s') }}
          <InputNumber
            v-model="params.windGustPeriod"
            :aria-label="t('阵风周期')"
            :min="2"
            :max="60"
            :step="1"
            :disabled="!params.windEnabled"
            size="small"
          />
        </label>
      </div>
      <!-- <p class="wind-note">
        {{ t('风只改变地速与航迹，不改变真空速和气动力。稳定风叠加双正弦阵风，') }}
        {{ t('属演示模型，不是真实气象数据。') }}
      </p> -->
    </div>
  </BasePanel>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { InputNumber, Select, Option, Tag } from '@arco-design/web-vue'
import { BasePanel } from '@/components'
import { params } from '@/hooks/useUav'
import { WEATHER_PRESETS, getWeatherPreset } from '@/hooks/weather'
import { useI18n } from '@/i18n'
const { t } = useI18n()

const currentWeather = computed(() => getWeatherPreset(params.weatherPreset))
const weatherPopupVisible = ref(false)
const windDirection = computed(() =>
  (((Math.round(params.windFromDegrees) % 360) + 360) % 360)
    .toString()
    .padStart(3, '0')
)
</script>
<style lang="scss" scoped>
.wind-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  height: 100%;
  overflow: visible;
  font-size: 11px;
  color: #d3e2ef;
}
.wind-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(148, 183, 209, 25%);
  strong {
    font-size: 13px;
    color: #f0f6ff;
  }
  span {
    font-size: 10px;
    color: #8ddbc4;
  }
}
.wind-toggle {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 20px;
  cursor: pointer;
}
.weather-select {
  display: flex;
  flex-direction: column;
  gap: 5px;
  label {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  select {
    box-sizing: border-box;
    width: 100%;
    padding: 4px 5px;
    font: inherit;
    color: #f0f6ff;
    cursor: pointer;
    background: rgba(8, 17, 26, 70%);
    border: 1px solid rgba(148, 183, 209, 30%);
    border-radius: 3px;
  }
}
.weather-note {
  margin: 0;
  font-size: 10px;
  line-height: 1.5;
  color: #afc2d5;
}
.wind-values {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
  div {
    display: flex;
    justify-content: space-between;
    padding: 7px 12px;
    color: var(--color-text-1);
    background-color: #353535;
    border-radius: var(--border-radius-small);
  }
  strong {
    font-family: DincorosBlack, monospace;

    // color: rgb(var(--primary-6));
  }
}
.wind-inputs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
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
    padding: 3px 5px;
    font: inherit;
    color: #f0f6ff;
    background: rgba(8, 17, 26, 70%);
    border: 1px solid rgba(148, 183, 209, 30%);
    border-radius: 3px;
    &:disabled {
      opacity: 0.45;
    }
  }
}
.wind-note {
  margin: 0;
  font-size: 10px;
  line-height: 1.6;
  color: #afc2d5;
}
</style>
