<script setup>
import { computed } from 'vue'

const props = defineProps({
  chartData: { type: Object, required: true }
})

// Per-point fields (nested inside ivData[])
const POINT_FIELDS = ['voltage', 'currentMA', 'currentUA']

// Per-cell scalar simulation results
const SCALAR_SIM_FIELDS = [
  { key: 'iPeak', label: 'iPeak (μA)', digits: 2 },
  { key: 'iAvg', label: 'iAvg (μA)', digits: 2 },
  { key: 'delay', label: 'Delay (ps)', digits: 1 }
]

// Per-cell scalar test conditions (can also appear as axis choices)
const SCALAR_META_FIELDS = [
  { key: 'vdd', label: 'VDD (V)', digits: 2 },
  { key: 'vth', label: 'Vth (V)', digits: 2 },
  { key: 'temp', label: 'Temp (°C)', digits: 1 }
]

const LABELS = {
  voltage: 'Voltage (V)',
  currentMA: 'Current (mA)',
  currentUA: 'Current (μA)',
  temp: 'Temp (°C)',
  vdd: 'VDD (V)',
  vth: 'Vth (V)',
  iPeak: 'iPeak (μA)',
  iAvg: 'iAvg (μA)',
  delay: 'Delay (ps)'
}

function labelFor(key) {
  return LABELS[key] || key
}

function typeFor(key) {
  return POINT_FIELDS.includes(key) ? 'point' : 'scalar'
}

function formatNumber(v, digits = 2) {
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
  return `${formatNumber(mn, 3)} ~ ${formatNumber(mx, 3)} (${vals.length} pts)`
}

function scalar(cell, key, digits) {
  return formatNumber(cell?.[key], digits ?? 2)
}

const cells = computed(() => props.chartData.cells || [])

// Columns — ordered per user spec:
//   1. xAxis field
//   2. yAxisPrimary field
//   3. yAxisSecondary field (if present)
//   4+. remaining sim/metadata fields in natural order
// No "X-axis / Y-axis" prefix labels — just the plain field label.
const columns = computed(() => {
  const cfg = props.chartData.config || {}
  const axisOrder = [cfg.xAxis, cfg.yAxisPrimary, cfg.yAxisSecondary].filter(Boolean)
  const out = []
  const seen = new Set()

  function add(key, type, label, digits) {
    if (seen.has(key)) return
    seen.add(key)
    out.push({ key, type, label, digits })
  }

  axisOrder.forEach(key => add(key, typeFor(key), labelFor(key)))
  POINT_FIELDS.forEach(key => add(key, 'point', labelFor(key)))
  SCALAR_SIM_FIELDS.forEach(({ key, label, digits }) => add(key, 'scalar', label, digits))
  SCALAR_META_FIELDS.forEach(({ key, label, digits }) => add(key, 'scalar', label, digits))
  add('__pts', 'pts', 'Data Points')

  return out
})

function cellValue(cell, col) {
  if (col.type === 'pts') return `${cell.ivData?.length || 0} pts`
  if (col.type === 'point') return rangeForPoints(cell, col.key)
  if (col.type === 'scalar') return scalar(cell, col.key, col.digits)
  return ''
}
</script>

<template>
  <div class="source-data-table">
    <h3 class="panel-title">Source Data</h3>
    <el-table
      :data="cells"
      border
      stripe
      size="small"
      max-height="480"
    >
      <el-table-column label="Cell" fixed width="160" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="cell-id">{{ row.alias || row.cellName }}</span>
        </template>
      </el-table-column>
      <el-table-column
        v-for="col in columns"
        :key="col.key"
        :label="col.label"
        min-width="140"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ cellValue(row, col) }}
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

.cell-id {
  font-weight: 600;
  color: #1f2d3d;
}
</style>
