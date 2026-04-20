<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  chartData: { type: Object, required: true }
})

const emit = defineEmits(['row-click', 'row-hover'])

// Comparison state
const comparisonMode  = ref('off')   // 'off' | 'diff'
const referenceCellId = ref(null)
const columnModes     = ref({})      // colKey -> 'diff' | 'ratio' (per-column override)

const COMPARISON_OPTIONS = [
  { label: 'Raw',  value: 'off' },
  { label: 'Diff', value: 'diff' }
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

// effective mode per column: override ?? 'diff' (default when comparison is on)
function effectiveMode(colKey) {
  return columnModes.value[colKey] ?? 'diff'
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

// Operating-condition fields (shared across cell types), shown alongside per-type simulation columns
const META_FIELDS = [
  { key: 'vdd',         label: 'VDD (V)',          digits: 4 },
  { key: 'vth',         label: 'Vth (V)',          digits: 4 },
  { key: 'temperature', label: 'Temperature (°C)', digits: 1 }
]

// Per-tab simulation columns (FF or ICG depending on which Generate Chart was fired from)
const simColumns = computed(() => props.chartData.simulationColumns || [])

function labelFor(key) {
  const labelMap = props.chartData.labelMap || {}
  if (labelMap[key]) return labelMap[key]
  const m = META_FIELDS.find(f => f.key === key)
  if (m) return m.label
  const df = (props.chartData.derivedFormulas || []).find(d => `__df_${d.id}` === key)
  return df ? df.name : key
}

function digitsFor(key) {
  const m = META_FIELDS.find(f => f.key === key)
  if (m) return m.digits
  if (key === 'area') return 1
  return 8
}

// All numeric keys: simulation columns + meta fields + derived formula keys
const numericKeys = computed(() => {
  const sim = simColumns.value.filter(c => c.numeric).map(c => c.prop)
  const meta = META_FIELDS.map(f => f.key)
  const derived = (props.chartData.derivedFormulas || []).map(d => `__df_${d.id}`)
  return [...sim, ...meta, ...derived]
})

// Columns ordered: xAxis, yAxisPrimary, yAxisSecondary, simulation columns, meta fields, derived
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
  simColumns.value.forEach(c => add(c.prop))
  META_FIELDS.forEach(f => add(f.key))
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
  if (mode === 'off' || isRefRow(row)) return { text: formatNumber(v, col.digits), cls: 'cell-num' }
  const colMode = effectiveMode(col.key)
  if (colMode === 'diff') {
    const sign = v > 0 ? '+' : ''
    return { text: `${sign}${formatNumber(v, col.digits)}`, cls: v > 0 ? 'cell-pos' : v < 0 ? 'cell-neg' : '' }
  }
  // ratio — show as percentage
  const pct = (v - 1) * 100
  const pctSign = pct > 0 ? '+' : ''
  return { text: `${pctSign}${formatNumber(pct, 2)}%`, cls: pct > 0 ? 'cell-pos' : pct < 0 ? 'cell-neg' : '' }
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
      @row-click="row => emit('row-click', row.id)"
      @cell-mouse-enter="row => emit('row-hover', row.id)"
      @cell-mouse-leave="() => emit('row-hover', null)"
    >
      <!-- Alias (fixed, 1st) -->
      <el-table-column label="Alias" prop="alias" fixed width="140" sortable :show-overflow-tooltip="{ showAfter: 500 }">
        <template #default="{ row }">
          <span class="cell-alias">{{ row.alias && row.alias !== row.cellName ? row.alias : row.cellName }}</span>
        </template>
      </el-table-column>

      <!-- Cell Name (fixed, 2nd) -->
      <el-table-column label="Cell Name" prop="cellName" fixed width="280" sortable :show-overflow-tooltip="{ showAfter: 500 }">
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
        :prop="col.key"
        min-width="120"
        sortable
        :show-overflow-tooltip="{ showAfter: 500 }"
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
            >{{ effectiveMode(col.key) === 'diff' ? '−' : '÷' }}</el-tag>
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
  margin-bottom: 12px;
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
.table-controls :deep(.el-segmented) {
  border-radius: 8px;
  --el-segmented-item-selected-bg-color: var(--clara-primary);
  --el-segmented-item-selected-color: #fff;
}
.table-controls :deep(.el-segmented .el-segmented__item) {
  border-radius: 6px;
  font-size: 12.5px;
}
.table-controls :deep(.el-segmented .el-segmented__item-selected) {
  border-radius: 6px;
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

.source-data-table :deep(.cell-pos) { color: #67c23a; font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; }
.source-data-table :deep(.cell-neg) { color: #f56c6c; font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; }
.source-data-table :deep(.cell-num) { font-variant-numeric: tabular-nums; text-align: right; }

.source-data-table :deep(.el-table .cell) {
  display: flex;
  align-items: center;
}
.source-data-table :deep(.el-table-column--selection .cell) {
  display: flex;
  justify-content: center;
}
.source-data-table :deep(th .caret-wrapper) {
  height: 20px;
}
.col-header { display: flex; align-items: center; gap: 4px; width: 100%; }
.col-label { font-size: 12px; font-weight: 500; }
.col-mode-tag { cursor: pointer; user-select: none; font-weight: 700; }
.col-mode-tag:hover { opacity: 0.8; }
</style>
