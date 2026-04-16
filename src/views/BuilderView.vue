<script setup>
import CellSearchTable from '../components/builder/CellSearchTable.vue'
import CellSearchPopupRoot from '../components/builder/CellSearchPopupRoot.vue'
import SelectedCellsPanel from '../components/builder/SelectedCellsPanel.vue'
import ChartConfigPanel from '../components/builder/ChartConfigPanel.vue'
import { ref, onBeforeUnmount } from 'vue'
import { usePopupWindow } from '../composables/usePopupWindow.js'

const { isOpen, open, close } = usePopupWindow()
const containerRef = ref(null)
const topHeight = ref(500)
const dragging = ref(false)

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
  height: 100%;
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
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: row-resize;
  position: relative;
  z-index: 5;
}

.splitter-handle {
  width: 48px;
  height: 4px;
  border-radius: 2px;
  background: #c0c4cc;
  transition: background 0.15s, width 0.15s;
}

.splitter:hover .splitter-handle,
.builder-view.dragging .splitter-handle {
  background: #409eff;
  width: 64px;
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
