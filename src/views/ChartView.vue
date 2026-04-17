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

const tableExpanded = ref(false)
const chartDisplayRef = ref(null)
const chartViewRef = ref(null)
const showLabels = ref(false)
const chartWidthPx = ref(800)

const ASPECT_RATIO = 4 / 3

let resizeObserver = null

function updateChartWidth() {
  const el = chartViewRef.value
  if (!el) return
  const h = el.clientHeight
  const w = el.clientWidth
  const ideal = Math.round(h * ASPECT_RATIO)
  const maxPx = Math.round(w * 0.7)
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

function toggleSplit() {
  tableExpanded.value = !tableExpanded.value
  setTimeout(() => chartDisplayRef.value?.resize(), 260)
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
  <div ref="chartViewRef" class="chart-view" :class="{ expanded: tableExpanded }" v-if="chartTab">

    <!-- Chart panel -->
    <div class="chart-left" :style="{ width: chartWidthPx + 'px' }">
      <div class="chart-top-bar">
        <el-switch
          v-model="showLabels"
          active-text="Labels"
          inactive-text="Labels"
          inline-prompt
          size="small"
        />
      </div>
      <ChartDisplay ref="chartDisplayRef" :chart-data="chartTab" :show-labels="showLabels" />
    </div>

    <!-- Splitter -->
    <div
      class="chart-splitter"
      :style="{ left: (tableExpanded ? '30%' : chartWidthPx + 'px') }"
      :title="tableExpanded ? 'Collapse table' : 'Expand table'"
      @click="toggleSplit"
    >
      <span class="splitter-handle">{{ tableExpanded ? '›' : '‹' }}</span>
    </div>

    <!-- Table panel -->
    <div class="chart-right" :style="{ left: (tableExpanded ? '30%' : chartWidthPx + 'px'), right: 0 }">
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
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  z-index: 1;
  transition: width 0.3s ease;
}

.chart-top-bar {
  position: absolute;
  top: 6px;
  right: 220px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Table panel ─────────────────────────────────────────────────────────── */
.chart-right {
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  background: #fff;
  border-radius: 8px;
  box-shadow: -6px 0 14px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  z-index: 3;
  transition: left 0.3s ease;
}


.table-panel-body {
  flex: 1;
  overflow: auto;
  padding: 10px 14px 14px;
}

/* ── Splitter ────────────────────────────────────────────────────────────── */
.chart-splitter {
  position: absolute;
  top: 0;
  height: 100%;
  width: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: transparent;
  transition: left 0.3s ease, background 0.15s;
  user-select: none;
  z-index: 4;
}


.chart-splitter:hover {
  background: rgba(144, 147, 153, 0.18);
}

.splitter-handle {
  font-size: 16px;
  color: #909399;
  line-height: 1;
  padding: 6px 2px;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
