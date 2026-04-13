<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  chartData: { type: Object, required: true }
})

// Comparison state
const comparisonMode  = ref('off')   // 'off' | 'diff' | 'ratio'
const referenceCellId = ref(null)
const columnModes     = ref({})      // colKey -> 'diff' | 'ratio' (overrides global)

const COMPARISON_OPTIONS = [
  { label: 'Off',   value: 'off' },
  { label: 'Diff',  value: 'diff' },
  { label: 'Ratio', value: 'ratio' }
]

const cells = computed(() => props.chartData.cells || [])

// Reset column overrides when global mode changes
watch(comparisonMode, () => { columnModes.value = {} })

// Auto-pick reference when mode changes or cells change
watch([comparisonMode, cells], ([mode, cs]) => {
  if (mode === 'off') return
  const stillExists = cs.some(c => c.id === referenceCellId.value)
  if (!stillExists) {
    referenceCellId.value = cs.length > 0 ? cs[0].id : null
  }
}, { immediate: true })

function effectiveMode(colKey) {
  return columnModes.value[colKey] ?? comparisonMode.value
}
function toggleColumnMode(colKey) {
  const cur = effectiveMode(colKey)
  columnModes.value = { ...columnModes.value, [colKey]: cur === 'diff' ? 'ratio' : 'diff' }
}

// Reference options: show "alias (cellName)" when alias differs from cellName
const referenceOptions = computed(() =>
  cells.value.map(c => ({
    value: c.id,
    label: c.alias && c.alias !== c.cellName ? `${c.alias} (${c.cellName})` : c.cellName
  }))
)

// Base scalar fields for diff/ratio
const SCALAR_SIM_FIELDS = [
  { key: 'iPeak', label: 'iPeak (μA)',  digits: 2 },
  { key: 'iAvg',  label: 'iAvg (μA)',   digits: 2 },
  { key: 'delay', label: 'Delay (ps)',  digits: 1 }
]
const SCALAR_META_FIELDS = [
  { key: 'vdd',  label: 'VDD (V)',    digits: 2 },
  { key: 'vth',  label: 'Vth (V)',    digits: 2 },
  { key: 'temp', label: 'Temp (°C)',  digits: 1 }
]
const ALL_FIELDS = [...SCALAR_SIM_FIELDS, ...SCALAR_META_FIELDS]

const AXIS_LABELS = {
  vdd: 'VDD (V)', temp: 'Temperature (°C)', vth: 'Vth (V)',
  gateLength: 'Gate Length', cpp: 'CPP',
  iPeak: 'I_peak (μA)', iAvg: 'I_avg (μA)', delay: 'Delay (ps)'
}

function labelFor(key) {
  if (AXIS_LABELS[key]) return AXIS_LABELS[key]
  const f = ALL_FIELDS.find(f => f.key === key)
  if (f) return f.label
  // Derived formula label from chartData
  const df = (props.chartData.derivedFormulas || []).find(d => `__df_${d.id}` === key)
  return df ? df.name : key
}

function digitsFor(key) {
  return ALL_FIELDS.find(f => f.key === key)?.digits ?? 2
}

// All numeric keys: base fields + derived formula keys
const numericKeys = computed(() => {
  const base = ALL_FIELDS.map(f => f.key)
  const derived = (props.chartData.derivedFormulas || []).map(d => `__df_${d.id}`)
  return [...base, ...derived]
})

// Columns ordered: xAxis, yAxisPrimary, yAxisSecondary, remaining scalars, derived
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
  ;(props.chartData.derivedFormulas || []).forEach(d => add(`__df_${d.id}`))

  return out
})

// Apply diff/ratio to displayRows
const displayRows = computed(() => {
  const cs = cells.value
  if (comparisonMode.value === 'off') return cs
  const refCell = cs.find(c => c.id === referenceCellId.value)
  if (!refCell) return cs
  return cs.map(c => {
    if (c.id === refCell.id) return c
    const copy = { ...c }
    for (const key of numericKeys.value) {
      const a = c[key], b = refCell[key]
      if (typeof a === 'number' && typeof b === 'number') {
        const mode = effectiveMode(key)
        if (mode === 'diff') {
          copy[key] = Math.round((a - b) * 10000) / 10000
        } else {
          copy[key] = b === 0 ? null : Math.round((a / b) * 10000) / 10000
        }
      }
    }
    return copy
  })
})

function isRefRow(row) {
  return comparisonMode.value !== 'off' && row.id === referenceCellId.value
}

function rowClassName({ row }) {
  return isRefRow(row) ? 'is-ref-row' : ''
}

function formatNumber(v, digits = 2) {
  if (v == null || Number.isNaN(v)) return '—'
  if (Number.isInteger(v)) return String(v)
  return Number(v).toFixed(digits)
}

function cellInfo(row, col) {
  const v = row[col.key]
  const mode = comparisonMode.value

  if (v === null || v === undefined) return { text: '—', cls: '' }
  if (typeof v !== 'number') return { text: String(v), cls: '' }
  if (mode === 'off' || isRefRow(row)) return { text: formatNumber(v, col.digits), cls: '' }
  const colMode = effectiveMode(col.key)
  if (colMode === 'diff') {
    const sign = v > 0 ? '+' : ''
    return { text: `${sign}${formatNumber(v, col.digits)}`, cls: v > 0 ? 'cell-pos' : v < 0 ? 'cell-neg' : '' }
  }
  // ratio
  return { text: `×${formatNumber(v, col.digits)}`, cls: v > 1 ? 'cell-pos' : v < 1 ? 'cell-neg' : '' }
}
</script>

<template>
  <div class="source-data-table">
    <!-- Header + comparison controls -->
    <div class="table-header">
      <h3 class="panel-title">Source Data</h3>
      <div class="table-controls">
        <el-segmented
          v-model="comparisonMode"
          :options="COMPARISON_OPTIONS"
          size="small"
          :disabled="cells.length < 2"
        />
        <el-select
          v-if="comparisonMode !== 'off'"
          v-model="referenceCellId"
          placeholder="Reference"
          size="small"
          style="width: 200px"
        >
          <el-option
            v-for="opt in referenceOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </div>
    </div>

    <el-table
      :data="displayRows"
      :row-class-name="rowClassName"
      border
      stripe
      size="small"
      max-height="480"
    >
      <!-- Alias (fixed, 1st) -->
      <el-table-column label="Alias" fixed width="140" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="cell-alias">{{ row.alias && row.alias !== row.cellName ? row.alias : '—' }}</span>
        </template>
      </el-table-column>

      <!-- Cell Name (fixed, 2nd) -->
      <el-table-column label="Cell Name" fixed width="150" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="cell-id">
            <el-tag v-if="isRefRow(row)" size="small" type="primary" style="margin-right:4px;vertical-align:middle">REF</el-tag>
            {{ row.cellName }}
          </span>
        </template>
      </el-table-column>

      <!-- Data columns -->
      <el-table-column
        v-for="col in columns"
        :key="col.key"
        min-width="120"
        show-overflow-tooltip
      >
        <template #header>
          <div class="col-header">
            <span class="col-label">{{ col.label }}</span>
            <el-tag
              v-if="comparisonMode !== 'off'"
              size="small"
              :type="effectiveMode(col.key) === 'diff' ? 'primary' : 'warning'"
              class="col-mode-tag"
              @click.stop="toggleColumnMode(col.key)"
            >{{ effectiveMode(col.key) === 'diff' ? 'Δ' : '×' }}</el-tag>
          </div>
        </template>
        <template #default="{ row }">
          <span :class="cellInfo(row, col).cls">{{ cellInfo(row, col).text }}</span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  gap: 12px;
  flex-wrap: wrap;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.table-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.cell-alias {
  color: #606266;
}

.cell-id {
  font-weight: 600;
  color: #1f2d3d;
}

.source-data-table :deep(.is-ref-row) td {
  background-color: #ecf5ff !important;
  font-weight: 600;
}

.source-data-table :deep(.cell-pos) { color: #67c23a; font-weight: 600; }
.source-data-table :deep(.cell-neg) { color: #f56c6c; font-weight: 600; }

.col-header { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; }
.col-label { font-size: 12px; font-weight: 500; }
.col-mode-tag { cursor: pointer; user-select: none; }
.col-mode-tag:hover { opacity: 0.8; }
</style>
