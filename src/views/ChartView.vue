<script setup>
import { computed, ref } from 'vue'
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

function toggleSplit() {
  tableExpanded.value = !tableExpanded.value
}

// ── Export chart as PNG ──────────────────────────────────────────────────────
function exportChartPng() {
  const dataUrl = chartDisplayRef.value?.getChartImage(2)
  if (!dataUrl) return
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `${chartTab.value?.builderName ?? 'chart'}.png`
  a.click()
}

// ── Export table data as CSV ─────────────────────────────────────────────────
function exportCsv() {
  const cells = chartTab.value?.cells
  if (!cells?.length) return

  // Collect all keys across cells (excluding internal __df_ keys → use name from derivedFormulas)
  const derivedFormulas = chartTab.value?.derivedFormulas ?? []
  const baseKeys = ['alias', 'cellName', 'cellType', 'driveStrength', 'library',
                    'feolCorner', 'vdd', 'temp', 'vth', 'gateLength', 'cpp',
                    'iPeak', 'iAvg', 'delay']
  const derivedKeys = derivedFormulas.map(df => `__df_${df.id}`)
  const derivedHeaders = derivedFormulas.map(df => df.name)

  const headers = [...baseKeys, ...derivedHeaders]
  const allKeys  = [...baseKeys, ...derivedKeys]

  const escape = v => {
    if (v == null) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s
  }

  const rows = [
    headers.join(','),
    ...cells.map(c => allKeys.map(k => escape(c[k])).join(','))
  ]

  const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${chartTab.value?.builderName ?? 'data'}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <div class="chart-view" :class="{ expanded: tableExpanded }" v-if="chartTab">
    <!-- Export toolbar -->
    <div class="export-bar">
      <el-button-group size="small">
        <el-button @click="exportChartPng">
          <el-icon style="margin-right:4px"><Picture /></el-icon>Export Chart PNG
        </el-button>
        <el-button @click="exportCsv">
          <el-icon style="margin-right:4px"><Download /></el-icon>Export CSV
        </el-button>
      </el-button-group>
    </div>

    <div class="chart-left">
      <ChartDisplay ref="chartDisplayRef" :chart-data="chartTab" />
    </div>
    <div
      class="chart-splitter"
      :title="tableExpanded ? 'Collapse table' : 'Expand table'"
      @click="toggleSplit"
    >
      <span class="splitter-handle">{{ tableExpanded ? '›' : '‹' }}</span>
    </div>
    <div class="chart-right">
      <SourceDataTable :chart-data="chartTab" />
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

.export-bar {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  background: rgba(255,255,255,0.92);
  border-radius: 6px;
  padding: 4px 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.12);
}

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

.chart-right {
  position: absolute;
  right: 0;
  top: 0;
  width: 30%;
  height: 100%;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: -6px 0 14px rgba(0, 0, 0, 0.08);
  overflow: auto;
  transition: width 0.25s ease;
  z-index: 3;
}

.chart-view.expanded .chart-right {
  width: 70%;
}

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

.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
