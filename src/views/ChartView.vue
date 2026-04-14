<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useBuilderStore } from '../stores/builderStore.js'
import ChartDisplay from '../components/chart/ChartDisplay.vue'
import SourceDataTable from '../components/chart/SourceDataTable.vue'
import html2canvas from 'html2canvas'

const route = useRoute()
const store = useBuilderStore()

const chartTab = computed(() => {
  const builderId = Number(route.params.builderId)
  return store.chartTabs.find(t => t.builderId === builderId)
})

const tableExpanded = ref(false)
const chartDisplayRef = ref(null)
const tableContainerRef = ref(null)

function toggleSplit() {
  tableExpanded.value = !tableExpanded.value
  setTimeout(() => chartDisplayRef.value?.resize(), 260)
}

function exportChartPng() {
  const dataUrl = chartDisplayRef.value?.getChartImage(2)
  if (!dataUrl) return
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `${chartTab.value?.builderName ?? 'chart'}.png`
  a.click()
}

async function exportTablePng() {
  if (!tableContainerRef.value) return
  try {
    const canvas = await html2canvas(tableContainerRef.value, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false
    })
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `${chartTab.value?.builderName ?? 'table'}-data.png`
    a.click()
  } catch (e) {
    console.error('[ChartView] Table PNG export failed:', e)
  }
}
</script>

<template>
  <div class="chart-view" :class="{ expanded: tableExpanded }" v-if="chartTab">

    <!-- Chart panel -->
    <div class="chart-left">
      <el-button
        class="btn-export-chart"
        size="small"
        @click="exportChartPng"
      >PNG</el-button>
      <ChartDisplay ref="chartDisplayRef" :chart-data="chartTab" />
    </div>

    <!-- Splitter -->
    <div
      class="chart-splitter"
      :title="tableExpanded ? 'Collapse table' : 'Expand table'"
      @click="toggleSplit"
    >
      <span class="splitter-handle">{{ tableExpanded ? '›' : '‹' }}</span>
    </div>

    <!-- Table panel -->
    <div class="chart-right">
      <div class="table-panel-header">
        <el-button size="small" @click="exportTablePng">PNG</el-button>
      </div>
      <div ref="tableContainerRef" class="table-panel-body">
        <SourceDataTable :chart-data="chartTab" />
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
  width: 70%;
  height: 100%;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  z-index: 1;
}

.btn-export-chart {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
}

/* ── Table panel ─────────────────────────────────────────────────────────── */
.chart-right {
  position: absolute;
  right: 0;
  top: 0;
  width: 30%;
  height: 100%;
  background: #fff;
  border-radius: 8px;
  box-shadow: -6px 0 14px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  transition: width 0.25s ease;
  z-index: 3;
}

.chart-view.expanded .chart-right {
  width: 70%;
}

.table-panel-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 10px 14px 6px;
}

.table-panel-body {
  flex: 1;
  overflow: auto;
  padding: 0 14px 14px;
}

/* ── Splitter ────────────────────────────────────────────────────────────── */
.chart-splitter {
  position: absolute;
  top: 0;
  height: 100%;
  width: 16px;
  right: 30%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: transparent;
  transition: right 0.25s ease, background 0.15s;
  user-select: none;
  z-index: 4;
}

.chart-view.expanded .chart-splitter {
  right: 70%;
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
