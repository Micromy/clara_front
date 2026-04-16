<script setup>
import CellSearchTable from '../components/builder/CellSearchTable.vue'
import CellSearchPopupRoot from '../components/builder/CellSearchPopupRoot.vue'
import SelectedCellsPanel from '../components/builder/SelectedCellsPanel.vue'
import ChartConfigPanel from '../components/builder/ChartConfigPanel.vue'
import { ref, computed, onBeforeUnmount } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { usePopupWindow } from '../composables/usePopupWindow.js'
import { useBuilderStore } from '../stores/builderStore.js'

const store = useBuilderStore()
const { isOpen, open, close } = usePopupWindow()
const containerRef = ref(null)
const topHeight = ref(500)
const dragging = ref(false)

const selectedCount = computed(() => store.activeBuilder?.selectedCellIds.length || 0)

async function applyBulkAlias() {
  if (selectedCount.value === 0) return
  try {
    const { value } = await ElMessageBox.prompt(
      `Apply the same alias to ${selectedCount.value} selected cell${selectedCount.value > 1 ? 's' : ''}.`,
      'Set Alias',
      {
        confirmButtonText: 'Apply',
        cancelButtonText: 'Cancel',
        inputPlaceholder: 'Enter alias (group name)',
        inputValidator: v => (v && v.trim()) ? true : 'Alias cannot be empty'
      }
    )
    const alias = value.trim()
    const builderId = store.activeBuilder.id
    store.activeBuilder.selectedCellIds.forEach(cellId => {
      store.setCellAlias(builderId, cellId, alias)
    })
    ElMessage.success(`Alias "${alias}" applied to ${selectedCount.value} cells.`)
  } catch { /* canceled */ }
}

function openPopup() {
  open({
    title: 'Cell Search — ARIAS',
    width: 1400,
    height: 900,
    component: CellSearchPopupRoot
  })
}

function onMouseDown(e) {
  e.preventDefault()
  dragging.value = true
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e) {
  if (!dragging.value || !containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  const newHeight = e.clientY - rect.top
  topHeight.value = Math.max(200, newHeight)
}

function onMouseUp() {
  dragging.value = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
})
</script>

<template>
  <div ref="containerRef" class="builder-view" :class="{ dragging }">
    <div class="top-section" :style="{ height: topHeight + 'px' }" v-show="!isOpen">
      <CellSearchTable @expand="openPopup" />
    </div>

    <div v-if="isOpen" class="popup-placeholder">
      <el-icon :size="18"><InfoFilled /></el-icon>
      <span>Cell search is open in a separate window.</span>
      <el-button size="small" type="primary" @click="close">Close popup</el-button>
    </div>

    <div class="splitter" @mousedown="onMouseDown">
      <div class="splitter-handle"></div>
      <button
        class="splitter-action"
        :disabled="selectedCount === 0"
        @mousedown.stop
        @click.stop="applyBulkAlias"
      >
        ↓ Set Alias
        <span v-if="selectedCount > 0" class="splitter-action-count">{{ selectedCount }}</span>
      </button>
      <div class="splitter-handle"></div>
    </div>

    <div class="bottom-section">
      <div class="bottom-left">
        <SelectedCellsPanel />
      </div>
      <div class="bottom-right">
        <ChartConfigPanel />
      </div>
    </div>
  </div>
</template>

<style scoped>
.builder-view {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  gap: 0;
}

.builder-view.dragging {
  cursor: row-resize;
  user-select: none;
}

.top-section {
  flex-shrink: 0;
  min-height: 200px;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: auto;
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

.splitter {
  flex-shrink: 0;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  cursor: row-resize;
  position: relative;
  z-index: 5;
}

.splitter-handle {
  width: 64px;
  height: 4px;
  border-radius: 2px;
  background: #c0c4cc;
  transition: background 0.15s, width 0.15s;
}

.splitter:hover .splitter-handle,
.builder-view.dragging .splitter-handle {
  background: #409eff;
  width: 80px;
}

.splitter-action {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 12.5px;
  font-weight: 500;
  background: #fff;
  color: #303133;
  border: 1px solid #dcdfe6;
  border-radius: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  transition: all 0.15s;
  user-select: none;
}
.splitter-action:not(:disabled):hover {
  background: #409eff;
  color: #fff;
  border-color: #409eff;
}
.splitter-action:disabled {
  cursor: not-allowed;
  color: #c0c4cc;
  background: #fafafa;
}
.splitter-action-count {
  display: inline-block;
  min-width: 18px;
  padding: 0 5px;
  background: #409eff;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  border-radius: 9px;
  line-height: 16px;
  text-align: center;
}
.splitter-action:hover .splitter-action-count {
  background: #fff;
  color: #409eff;
}

.bottom-section {
  display: flex;
  gap: 16px;
  min-height: 200px;
  align-items: stretch;
  overflow: hidden;
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
}
</style>
