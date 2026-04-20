<script setup>
import CellSearchTable from '../components/builder/CellSearchTable.vue'
import CellSearchPopupRoot from '../components/builder/CellSearchPopupRoot.vue'
import SelectedCellsPanel from '../components/builder/SelectedCellsPanel.vue'
import ChartConfigPanel from '../components/builder/ChartConfigPanel.vue'
import { ref } from 'vue'
import { usePopupWindow } from '../composables/usePopupWindow.js'

const DEFAULT_HEIGHT = 500
const EXPANDED_HEIGHT = 800
const MIN_HEIGHT = 200

const { isOpen, open, close } = usePopupWindow()
const containerRef = ref(null)
const topHeight = ref(DEFAULT_HEIGHT)
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
  const startY = e.clientY
  let moved = false
  function onMove(ev) {
    if (!moved && Math.abs(ev.clientY - startY) < 4) return
    moved = true
    dragging.value = true
    if (!containerRef.value) return
    const rect = containerRef.value.getBoundingClientRect()
    const newHeight = ev.clientY - rect.top
    topHeight.value = Math.max(MIN_HEIGHT, newHeight)
  }
  function onUp() {
    dragging.value = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function onDblClick() {
  const nearDefault = Math.abs(topHeight.value - DEFAULT_HEIGHT) < 80
  if (nearDefault) {
    topHeight.value = EXPANDED_HEIGHT
  } else {
    topHeight.value = DEFAULT_HEIGHT
  }
}
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

    <div class="splitter" @mousedown="onMouseDown" @dblclick="onDblClick">
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
.builder-view.dragging .top-section {
  transition: none;
}

.top-section {
  flex-shrink: 0;
  min-height: 200px;
  transition: height 0.25s ease;
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

.splitter-area {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

.splitter {
  width: 100%;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: row-resize;
  position: relative;
  z-index: 5;
}

.splitter-handle {
  width: 72px;
  height: 7px;
  position: relative;
}
.splitter-handle::before,
.splitter-handle::after {
  content: '';
  position: absolute;
  left: 0;
  width: 100%;
  height: 2px;
  border-radius: 1px;
  background: rgba(0,0,0,0.2);
  transition: background 0.15s ease;
}
.splitter:hover .splitter-handle::before,
.splitter:hover .splitter-handle::after {
  background: rgba(64,120,192,0.5);
}
.splitter-handle::before { top: 0; }
.splitter-handle::after { bottom: 0; }

.action-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 4px 0;
}

.action-checked-count {
  font-size: 13px;
  color: #606266;
  margin-left: auto;
}
.action-checked-count strong {
  color: #303133;
}

.action-icon-btn {
  color: #909399;
  font-size: 16px;
}
.action-icon-btn:hover {
  color: #606266;
  background: rgba(0, 0, 0, 0.04);
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
  padding: 16px 16px 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
</style>
