<script setup>
import CellSearchTable from '../components/builder/CellSearchTable.vue'
import SelectedCellsPanel from '../components/builder/SelectedCellsPanel.vue'
import ChartConfigPanel from '../components/builder/ChartConfigPanel.vue'
import { ref } from 'vue'
import { usePopupWindow } from '../composables/usePopupWindow.js'

const bottomCollapsed = ref(false)
const { popupRoot, isOpen, open, close } = usePopupWindow()

function openPopup() {
  open({
    title: 'Cell Search — ARIAS',
    width: 1400,
    height: 900,
    onClose: () => { /* handled by isOpen flipping false */ }
  })
}
</script>

<template>
  <div class="builder-view">
    <div class="top-section" v-show="!isOpen">
      <CellSearchTable @expand="openPopup" />
    </div>

    <div v-if="isOpen" class="popup-placeholder">
      <el-icon :size="18"><InfoFilled /></el-icon>
      <span>Cell search is open in a separate window.</span>
      <el-button size="small" type="primary" @click="close">Close popup</el-button>
    </div>

    <div class="section-divider" @click="bottomCollapsed = !bottomCollapsed">
      <el-icon><component :is="bottomCollapsed ? 'ArrowDown' : 'ArrowUp'" /></el-icon>
      <span>{{ bottomCollapsed ? 'Show' : 'Hide' }} Selected Cells & Chart Config</span>
    </div>

    <div v-show="!bottomCollapsed" class="bottom-section">
      <div class="bottom-left">
        <SelectedCellsPanel />
      </div>
      <div class="bottom-right">
        <ChartConfigPanel />
      </div>
    </div>

    <Teleport v-if="popupRoot" :to="popupRoot">
      <div class="popup-shell">
        <CellSearchTable :show-expand-button="false" in-popup />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.builder-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 0;
}

.top-section {
  flex: 1;
  min-height: 300px;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.popup-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 120px;
  background: #fff;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  padding: 16px;
  color: #606266;
  font-size: 13px;
}

.section-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 0;
  cursor: pointer;
  color: #909399;
  font-size: 12px;
  user-select: none;
}

.section-divider:hover {
  color: var(--clara-primary);
}

.bottom-section {
  display: flex;
  gap: 16px;
  min-height: 680px;
  align-items: stretch;
}

.bottom-left {
  flex: 1;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.bottom-right {
  width: 360px;
  flex-shrink: 0;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  max-height: 800px;
}
</style>

<style>
.popup-shell {
  padding: 16px;
  height: 100vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: #fff;
}
</style>
