<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useBuilderStore } from '../stores/builderStore.js'
import ChartDisplay from '../components/chart/ChartDisplay.vue'
import SourceDataTable from '../components/chart/SourceDataTable.vue'

const route = useRoute()
const store = useBuilderStore()

const chartTab = computed(() => {
  const builderId = Number(route.params.builderId)
  return store.chartTabs.find(t => t.builderId === builderId)
})

const chartDisplayRef = ref(null)
const chartViewRef = ref(null)
const chartWidthPx = ref(800)
const tableSplitPx = ref(null)
const draggingSplit = ref(false)

const ASPECT_RATIO = 3 / 2

let resizeObserver = null

function updateChartWidth() {
  const el = chartViewRef.value
  if (!el) return
  const h = el.clientHeight
  const w = el.clientWidth
  const ideal = Math.round(h * ASPECT_RATIO)
  const maxPx = Math.round(w * 0.8)
  const minPx = Math.round(w * 0.3)
  chartWidthPx.value = Math.min(maxPx, Math.max(minPx, ideal))
  chartDisplayRef.value?.resize()
}

onMounted(() => {
  updateChartWidth()
  resizeObserver = new ResizeObserver(updateChartWidth)
  if (chartViewRef.value) resizeObserver.observe(chartViewRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

const OVERLAP = 12

const splitLeft = computed(() => {
  return tableSplitPx.value != null ? tableSplitPx.value : chartWidthPx.value - OVERLAP
})

function onSplitMouseDown(e) {
  e.preventDefault()
  const startX = e.clientX
  let moved = false
  const doc = e.target.ownerDocument || document
  function onMove(ev) {
    if (!moved && Math.abs(ev.clientX - startX) < 4) return
    moved = true
    draggingSplit.value = true
    const rect = chartViewRef.value?.getBoundingClientRect()
    if (!rect) return
    const x = ev.clientX - rect.left
    const minX = 40
    const maxX = chartWidthPx.value - OVERLAP
    tableSplitPx.value = Math.max(minX, Math.min(maxX, x))
  }
  function onUp() {
    draggingSplit.value = false
    doc.removeEventListener('mousemove', onMove)
    doc.removeEventListener('mouseup', onUp)
  }
  doc.addEventListener('mousemove', onMove)
  doc.addEventListener('mouseup', onUp)
}

function onSplitDblClick() {
  const minX = chartWidthPx.value * 0.3
  const maxX = chartWidthPx.value - OVERLAP
  const mid = (minX + maxX) / 2
  const current = tableSplitPx.value ?? maxX
  if (current > mid) {
    tableSplitPx.value = minX
  } else {
    tableSplitPx.value = null
  }
}

function onRowHover(cellId) {
  if (cellId) chartDisplayRef.value?.highlightCells([cellId])
  else chartDisplayRef.value?.unhighlightAll()
}

function onRowClick(cellId) {
  chartDisplayRef.value?.highlightCells([cellId])
}
</script>

<template>
  <div ref="chartViewRef" class="chart-view" :class="{ 'is-dragging-split': draggingSplit }" v-if="chartTab">

    <!-- Chart panel -->
    <div class="chart-left" :style="{ width: chartWidthPx + 'px' }">
      <ChartDisplay ref="chartDisplayRef" :chart-data="chartTab" />
    </div>

    <!-- Table panel (left edge is the drag handle) -->
    <div class="chart-right" :style="{ left: splitLeft + 'px', right: 0 }">
      <div class="chart-right-edge" @mousedown="onSplitMouseDown" @dblclick="onSplitDblClick"></div>
      <div class="table-panel-body">
        <SourceDataTable
          :chart-data="chartTab"
          @row-hover="onRowHover"
          @row-click="onRowClick"
        />
      </div>
    </div>

  </div>
  <div v-else class="chart-empty">
    <el-empty description="No chart data. Go to a Builder tab and click 'Generate Chart'." />
  </div>
</template>

<style scoped>
.chart-view {
  position: relative;
  height: 100%;
  min-height: 500px;
  overflow: hidden;
}

/* ── Chart panel ─────────────────────────────────────────────────────────── */
.chart-left {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: #fff;
  border-radius: 8px 0 0 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  z-index: 1;
  transition: width 0.3s ease;
}


/* ── Table panel ─────────────────────────────────────────────────────────── */
.chart-right {
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  background: #fff;
  border-radius: 6px 0 0 6px;
  border-left: 1px solid #e4e7ed;
  box-shadow: -4px 0 8px rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  z-index: 3;
  transition: left 0.25s ease;
}
.is-dragging-split .chart-right {
  transition: none;
}

.chart-right-edge {
  position: absolute;
  left: 0;
  top: 0;
  width: 24px;
  height: 100%;
  cursor: col-resize;
  z-index: 5;
  border-radius: 6px 0 0 6px;
  background: transparent;
}
.chart-right-edge::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 6px;
  transform: translateY(-50%);
  width: 3px;
  height: 48px;
  border-left: 2px solid rgba(0,0,0,0.18);
  border-right: 2px solid rgba(0,0,0,0.18);
  transition: border-color 0.15s ease;
}
.chart-right-edge:hover::after {
  border-left-color: rgba(64,120,192,0.5);
  border-right-color: rgba(64,120,192,0.5);
}

.table-panel-body {
  flex: 1;
  overflow: auto;
  padding: 10px 14px 14px 24px;
}

.chart-view.is-dragging-split {
  cursor: col-resize;
  user-select: none;
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
