<template>
  <BasePanel :title="t('操作提示')">
    <div class="control-help">
      <dl class="shortcut-list">
        <div v-for="item in shortcuts" :key="item.label" class="shortcut-row">
          <dt>
            <kbd v-for="key in item.keys" :key="key">{{ key }}</kbd>
          </dt>
          <dd>{{ item.label }}</dd>
        </div>
      </dl>
    </div>
  </BasePanel>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { BasePanel } from '@/components'
import { useI18n } from '@/i18n'

const { t } = useI18n()

// 使用 computed，切换语言时标签随之更新。
const shortcuts = computed(() => [
  { keys: ['W', 'S'], label: t('抬头 / 低头') },
  { keys: ['A', 'D'], label: t('左 / 右压坡度') },
  { keys: ['Q', 'E'], label: t('增加 / 减少油门') },
  { keys: ['P', t('空格')], label: t('暂停 / 继续') },
  { keys: ['R'], label: t('按已设起点重开') },
  { keys: ['C'], label: t('切换镜头视角') },
  { keys: ['T'], label: t('切换天气') },
])
</script>
<style lang="scss" scoped>
.control-help {
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
}
.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 0 0 7px;
}
.shortcut-row {
  display: flex;
  gap: 8px;
  align-items: center;
  dt {
    display: flex;
    flex-shrink: 0;
    gap: 4px;

    // width: 49px;
  }
  dd {
    margin: 0;
    font-size: 11px;
    color: var(--color-text-2);
  }
}
kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  // width: 21px;
  height: 19px;
  padding: 0 10px;
  font-family: monospace;
  font-size: 11px;
  font-weight: 600;

  // color: #a7ceff;
  // background: rgba(64, 128, 255, 10%);
  // border: 1px solid rgba(126, 172, 255, 30%);
  color: #4e7df6;
  background: #232c47;
  border-radius: 2px;
}
</style>
