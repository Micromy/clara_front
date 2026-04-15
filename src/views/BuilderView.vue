<script setup>
import CellSearchTable from '../components/builder/CellSearchTable.vue'
import SelectedCellsPanel from '../components/builder/SelectedCellsPanel.vue'
import ChartConfigPanel from '../components/builder/ChartConfigPanel.vue'
import { ref } from 'vue'

const bottomCollapsed = ref(false)
const expanded = ref(false)
</script>

<template>
  <div class="builder-view">
    <div class="top-section" v-show="!expanded">
      <CellSearchTable @expand="expanded = true" />
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

    <el-dialog
      v-model="expanded"
      title="Cell Search"
      width="90%"
      top="4vh"
      append-to-body
      destroy-on-close
      class="cell-search-dialog"
    >
      <div class="dialog-body">
        <CellSearchTable :show-expand-button="false" />
      </div>
    </el-dialog>
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

.dialog-body {
  height: 80vh;
  display: flex;
  flex-direction: column;
}
</style>

<style>
.cell-search-dialog .el-dialog__body {
  padding: 16px 20px;
}
</style>
