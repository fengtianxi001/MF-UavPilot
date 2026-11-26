<template>
  <div
    v-if="
      params.initializing ||
      params.initializationError ||
      params.outcome === 'arrived'
    "
    class="mission-banner"
    :class="{ 'mission-error': params.initializationError }"
    role="status"
  >
    <template v-if="params.initializing">
      {{ t('正在查询起点地形，按离地高度初始化…') }}
    </template>
    <template v-else-if="params.initializationError">
      <strong>{{ t('初始化失败') }}</strong>
      <div>{{ params.initializationError }}</div>
      <div class="mission-action-note">
        {{ t('可点击下方按钮或按 R 重试。') }}
      </div>
    </template>
    <template v-else>
      <strong>{{ t('已到达终点 · 本次飞行完成') }}</strong>
      <div>
        {{ t('耗时 ') }}{{ Math.floor(params.elapsedSeconds / 60) }}{{ t('分')
        }}{{ Math.floor(params.elapsedSeconds % 60) }}{{ t('秒') }}
        {{ t('· 航程 ') }}{{ (params.distanceMeters / 1000).toFixed(2) }} km
      </div>
      <div class="mission-action-note">
        {{ t('点击下方按钮或按 R 重新开始。') }}
      </div>
    </template>
    <Button
      v-if="!params.initializing"
      type="primary"
      size="small"
      @click="$emit('restart')"
    >
      {{ t('重新开始') }}
    </Button>
  </div>
</template>
<script setup lang="ts">
import { Button } from '@arco-design/web-vue'
import { useI18n } from '@/i18n'
import { params } from '@/hooks/useUav'

const { t } = useI18n()

defineEmits<{ restart: [] }>()
</script>
<style lang="scss" scoped>
.mission-banner {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  padding: 24px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--color-text-1);
  text-align: center;
  pointer-events: auto;
  background: #181818b8;
  strong {
    display: block;
    font-size: 18px;
    color: #f0f6ff;
  }
  div {
    color: #c5d4e3;
  }
  &.mission-error {
    background: rgba(91, 19, 26, 82%);
    border: 1px solid #ff7875;
    strong {
      color: #ffd0cd;
    }
  }
}
.mission-action-note {
  font-size: 11px;
}
</style>
