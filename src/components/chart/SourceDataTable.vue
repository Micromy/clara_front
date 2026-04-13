<script setup>
import { computed } from 'vue'

const props = defineProps({
  chartData: { type: Object, required: true }
})

const SCALAR_SIM_FIELDS = [
  { key: 'iPeak', label: 'iPeak (μA)', digits: 2 },
  { key: 'iAvg', label: 'iAvg (μA)', digits: 2 },
  { key: 'delay', label: 'Delay (ps)', digits: 1 }
]

const SCALAR_META_FIELDS = [
  { key: 'vdd', label: 'VDD (V)', digits: 2 },
  { key: 'vth', label: 'Vth (V)', digits: 2 },
  { key: 'temp', label: 'Temp (°C)', digits: 1 }
]

const ALL_FIELDS = [...SCALAR_SIM_FIELDS, ...SCALAR_META_FIELDS]

const AXIS_LABELS = {
  vdd: 'VDD (V)',
  temp: 'Temperature (°C)',
  vth: 'Vth (V)',
  gateLength: 'Gate Length',
  cpp: 'CPP',
  iPeak: 'I_peak (μA)',
  iAvg: 'I_avg (μA)',
  delay: 'Delay (ps)'
}

function labelFor(key) {
  return AXIS_LABELS[key] || ALL_FIELDS.find(f => f.key === key)?.label || key
}

function digitsFor(key) {
  return ALL_FIELDS.find(f => f.key === key)?.digits ?? 2
}

function formatNumber(v, digits = 2) {
  if (v == null || Number.isNaN(v)) return '—'
  if (Number.isInteger(v)) return String(v)
  return Number(v).toFixed(digits)
}

const cells = computed(() => props.chartData.cells || [])

// Columns: xAxis, yAxisPrimary, yAxisSecondary first, then remaining scalars
const columns = computed(() => {
  const cfg = props.chartData.config || {}
  const axisOrder = [cfg.xAxis, cfg.yAxisPrimary, cfg.yAxisSecondary].filter(Boolean)
  const out = []
  const seen = new Set()

  function add(key) {
    if (seen.has(key)) return
    seen.add(key)
    out.push({ key, label: labelFor(key), digits: digitsFor(key) })
  }

  axisOrder.forEach(add)
  ALL_FIELDS.forEach(f => add(f.key))

  return out
})
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
        min-width="120"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ formatNumber(row[col.key], col.digits) }}
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
