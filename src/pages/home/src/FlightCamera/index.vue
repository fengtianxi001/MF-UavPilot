<template>
  <div class="camera-toolbar" role="group" :aria-label="t('镜头模式')">
    <RadioGroup
      :model-value="cameraMode"
      type="button"
      size="small"
      :aria-label="t('镜头模式')"
      @change="(value) => emit('change', value as CameraMode)"
    >
      <Radio v-for="item in modes" :key="item.value" :value="item.value">
        {{ item.label }}
      </Radio>
    </RadioGroup>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { Radio, RadioGroup } from '@arco-design/web-vue'
import { useI18n } from '@/i18n'

const { t } = useI18n()
export type CameraMode = 'chase' | 'cockpit' | 'free'

const props = defineProps<{
  cameraMode: CameraMode
}>()
const emit = defineEmits<{
  change: [mode: CameraMode]
  reset: []
}>()

// 使用 computed，切换语言时按钮标签随之更新。
const modes = computed<{ value: CameraMode; label: string }[]>(() => [
  { value: 'chase', label: t('后上方跟随') },
  { value: 'cockpit', label: t('座舱视角') },
  { value: 'free', label: t('自由观察') },
])
</script>
<style lang="scss" scoped>
.camera-toolbar {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 6;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
  max-width: calc(100% - 24px);

  //   padding: 6px;
  background: #242425;

  //   border: 1px solid rgba(148, 183, 209, 25%);
  border-radius: 2px;
  span {
    font-size: 10px;
    color: #afc2d5;
  }
}
</style>
