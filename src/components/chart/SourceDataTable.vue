<script setup>
import { computed } from 'vue'

const props = defineProps({
  chartData: { type: Object, required: true }
})

const AXIS_LABELS = {
  voltage: 'Voltage (V)',
  currentMA: 'Current (mA)',
  currentUA: 'Current (μA)',
  temp: 'Temperature (°C)',
  vdd: 'VDD (V)'
}

function axisLabel(key) {
  return AXIS_LABELS[key] || key
}

function formatNumber(v, digits = 3) {
  if (v == null || Number.isNaN(v)) return '—'
  if (Number.isInteger(v)) return String(v)
  return Number(v).toFixed(digits)
}

function rangeForPoints(cell, key) {
  const vals = (cell.ivData || [])
    .map(p => p?.[key])
    .filter(v => typeof v === 'number')
  if (!vals.length) return '—'
  const mn = Math.min(...vals)
  const mx = Math.max(...vals)
  return `${formatNumber(mn)} ~ ${formatNumber(mx)} (${vals.length} pts)`
}

function scalar(cell, key, digits = 2) {
  return formatNumber(cell?.[key], digits)
}

const cells = computed(() => props.chartData.cells || [])

// Leftmost column = the value types used when building the chart (axes),
// followed by every simulation scalar we know about. Each column after the
// leftmost represents one cell selected for the chart.
const rows = computed(() => {
  const cfg = props.chartData.config || {}
  const cs = cells.value
  const result = []

  const axisRows = [
    { cfgKey: 'xAxis', title: 'X-axis' },
    { cfgKey: 'yAxisPrimary', title: 'Y-axis (primary)' },
    { cfgKey: 'yAxisSecondary', title: 'Y-axis (secondary)' }
  ]

  axisRows.forEach(({ cfgKey, title }) => {
    const key = cfg[cfgKey]
    if (!key) return
    const row = {
      metric: `${title}: ${axisLabel(key)}`,
      group: 'chart',
      isAxis: true
    }
    cs.forEach(cell => {
      row[`cell_${cell.id}`] = rangeForPoints(cell, key)
    })
    result.push(row)
  })

  const simScalars = [
    { key: 'iPeak', label: 'iPeak (μA)', digits: 2 },
    { key: 'iAvg', label: 'iAvg (μA)', digits: 2 },
    { key: 'delay', label: 'Delay (ps)', digits: 1 }
  ]
  simScalars.forEach(({ key, label, digits }) => {
    const row = { metric: label, group: 'sim', isAxis: false }
    cs.forEach(cell => {
      row[`cell_${cell.id}`] = scalar(cell, key, digits)
    })
    result.push(row)
  })

  const pointsRow = { metric: 'Data Points', group: 'sim', isAxis: false }
  cs.forEach(cell => {
    pointsRow[`cell_${cell.id}`] = `${cell.ivData?.length || 0} pts`
  })
  result.push(pointsRow)

  return result
})

function rowClass({ row }) {
  return row.isAxis ? 'axis-row' : ''
}
</script>

<template>
  <div class="source-data-table">
    <h3 class="panel-title">Source Data</h3>
    <el-table
      :data="rows"
      :row-class-name="rowClass"
      border
      stripe
      size="small"
      max-height="480"
    >
      <el-table-column
        prop="metric"
        label="Metric"
        fixed
        width="200"
        show-overflow-tooltip
      />
      <el-table-column
        v-for="cell in cells"
        :key="cell.id"
        :label="cell.alias || cell.cellName"
        min-width="140"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ row[`cell_${cell.id}`] }}
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.panel-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #303133;
}

.source-data-table :deep(.axis-row) {
  background-color: #f2f6fc !important;
}

.source-data-table :deep(.axis-row td) {
  font-weight: 600;
  color: #1f2d3d;
}
</style>
