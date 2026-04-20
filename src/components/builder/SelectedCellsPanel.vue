<script setup>
import { ref, computed, watch } from 'vue'
import { useBuilderStore } from '../../stores/builderStore.js'
import { useDragSelect } from '../../composables/useDragSelect.js'

const store = useBuilderStore()
const selectedTableRef = ref(null)
const { onCellMouseEnter: onSelCellMouseEnter } = useDragSelect(selectedTableRef)

const displayMode    = ref('metadata')  // 'metadata' | 'simulation'
const comparisonMode = ref('off')       // 'off' | 'diff'
const referenceCellId = ref(null)
const columnModes    = ref({})          // colProp -> 'diff' | 'ratio' (per-column override)
const checkedCellIds = ref([])

function handleSelectionChange(selected) {
  checkedCellIds.value = selected.map(r => r.id)
}
function removeChecked() {
  store.deselectCells(checkedCellIds.value)
  checkedCellIds.value = []
}

defineExpose({ getCheckedCellIds: () => [...checkedCellIds.value], removeChecked })

const COMPARISON_OPTIONS = [
  { label: 'Raw',  value: 'off' },
  { label: 'Diff', value: 'diff' }
]

function updateAlias(cellId, value) { store.setCellAlias(store.activeBuilder.id, cellId, value) }
function getAlias(cellId)           { return store.getCellAlias(store.activeBuilder.id, cellId) }
function removeCell(cellId)         { store.toggleCellSelection(cellId) }

// Reset column overrides when global mode changes
watch(comparisonMode, () => { columnModes.value = {} })
watch(displayMode, (mode) => {
  if (mode !== 'simulation') comparisonMode.value = 'off'
})

// Auto-pick reference
watch([comparisonMode, () => store.selectedCells], ([mode, cells]) => {
  if (mode === 'off') return
  if (!cells.some(c => c.id === referenceCellId.value)) {
    referenceCellId.value = cells.length > 0 ? cells[0].id : null
  }
}, { immediate: true })

const referenceOptions = computed(() =>
  store.selectedCells.map(c => {
    const alias = getAlias(c.id)
    return { value: c.id, label: alias ? `${alias} (${c.cellName})` : c.cellName }
  })
)

// All columns in simulation mode
const simColumns = computed(() => [
  ...store.selectedCellsSimulationColumns,
  ...store.derivedSimColumns
])

const numericKeys = computed(() => simColumns.value.filter(c => c.numeric).map(c => c.prop))

// Effective mode per column: override ?? 'diff' (default subtraction when comparison on)
function effectiveMode(colKey) {
  return columnModes.value[colKey] ?? 'diff'
}

function toggleColumnMode(colKey) {
  const cur = effectiveMode(colKey)
  columnModes.value = { ...columnModes.value, [colKey]: cur === 'diff' ? 'ratio' : 'diff' }
}

const tableRows = computed(() => {
  const cells = store.selectedCells
  if (displayMode.value !== 'simulation' || comparisonMode.value === 'off') return cells
  const refCell = cells.find(c => c.id === referenceCellId.value)
  if (!refCell) return cells
  return cells.map(c => {
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
  return displayMode.value === 'simulation' &&
    comparisonMode.value !== 'off' &&
    row.id === referenceCellId.value
}
function rowClassName({ row }) { return isRefRow(row) ? 'is-ref-row' : '' }

// Digits per column prop — defaults to 4 since most FF/ICG metrics are small decimals (ns).
function digitsFor(prop) {
  if (prop === 'area') return 1
  if (prop === 'temperature') return 1
  if (prop === 'vdd') return 2
  return 8
}

function formatNum(v, digits) {
  if (v == null || Number.isNaN(v)) return '—'
  if (Number.isInteger(v)) return String(v)
  return Number(v).toFixed(digits)
}

function simCellInfo(row, col) {
  const v = row[col.prop]
  const digits = digitsFor(col.prop)
  if (v === null || v === undefined) return { text: '—', cls: '' }
  if (typeof v !== 'number') return { text: String(v), cls: '' }
  if (comparisonMode.value === 'off' || displayMode.value !== 'simulation' || isRefRow(row)) {
    return { text: formatNum(v, digits), cls: 'cell-num' }
  }
  const mode = effectiveMode(col.prop)
  if (mode === 'diff') {
    const sign = v > 0 ? '+' : ''
    return { text: `${sign}${formatNum(v, digits)}`, cls: v > 0 ? 'cell-pos' : v < 0 ? 'cell-neg' : '' }
  }
  const pct = (v - 1) * 100
  const sign = pct > 0 ? '+' : ''
  return { text: `${sign}${formatNum(pct, 2)}%`, cls: pct > 0 ? 'cell-pos' : pct < 0 ? 'cell-neg' : '' }
}
</script>

<template>
  <div class="selected-cells-panel">
    <div class="panel-header">
      <div class="panel-title-group">
        <h3 class="panel-title">Selected Cells</h3>
        <el-button
          v-if="checkedCellIds.length > 0"
          size="small"
          class="remove-btn"
          style="padding: 2px 8px; font-size: 11px;"
          @click="removeChecked"
        >Remove {{ checkedCellIds.length }}</el-button>
      </div>
      <div class="panel-controls">
        <el-switch
          v-model="displayMode"
          active-value="simulation"
          inactive-value="metadata"
          active-text="Simulation"
          inactive-text="Metadata"
          inline-prompt
          :disabled="store.selectedCells.length === 0"
        />
        <template v-if="displayMode === 'simulation'">
          <el-segmented
            v-model="comparisonMode"
            :options="COMPARISON_OPTIONS"
            size="small"
            :disabled="store.selectedCells.length < 2"
          />
          <el-select
            v-if="comparisonMode !== 'off'"
            v-model="referenceCellId"
            placeholder="Reference"
            size="small"
            style="width: 200px"
          >
            <el-option v-for="opt in referenceOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </template>
      </div>
    </div>

    <el-table
      ref="selectedTableRef"
      :data="tableRows"
      :row-class-name="rowClassName"
      border stripe size="small" max-height="580"
      :show-overflow-tooltip="{ showAfter: 500 }"
      empty-text="No cells selected. Select cells from the table above."
      @selection-change="handleSelectionChange"
      @cell-mouse-enter="onSelCellMouseEnter"
    >
      <!-- Selection checkbox (fixed 1st) -->
      <el-table-column type="selection" width="38" fixed align="center" />

      <!-- Alias input (fixed 2nd) -->
      <el-table-column label="Alias" width="140" fixed>
        <template #default="{ row }">
          <el-input
            :model-value="getAlias(row.id)"
            @update:model-value="val => updateAlias(row.id, val)"
            size="small" :placeholder="row.cellName"
          />
        </template>
      </el-table-column>

      <!-- Cell Name (fixed 2nd) -->
      <el-table-column label="Cell Name" width="320" :show-overflow-tooltip="{ showAfter: 500 }" fixed>
        <template #default="{ row }">
          <el-tag v-if="isRefRow(row)" size="small" type="primary" style="margin-right:4px;vertical-align:middle">REF</el-tag>
          <span>{{ row.cellName }}</span>
        </template>
      </el-table-column>

      <!-- Metadata columns -->
      <template v-if="displayMode === 'metadata'">
        <el-table-column
          v-for="col in store.selectedCellsMetadataColumns"
          :key="col.prop" :prop="col.prop" :label="col.label" :min-width="col.autoWidth || col.width"
        />
      </template>

      <!-- Simulation + derived columns -->
      <template v-else>
        <el-table-column
          v-for="col in simColumns"
          :key="col.prop" :min-width="col.width || 110"
        >
          <template #header>
            <div class="col-header">
              <span class="col-label">{{ col.label }}</span>
              <div class="col-header-badges">
                <el-tag v-if="col.isDerived" size="small" type="info">f(x)</el-tag>
                <el-tag
                  v-if="comparisonMode !== 'off'"
                  size="small"
                  :type="effectiveMode(col.prop) === 'diff' ? 'primary' : 'warning'"
                  class="col-mode-tag"
                  @click.stop="toggleColumnMode(col.prop)"
                >{{ effectiveMode(col.prop) === 'diff' ? '−' : '÷' }}</el-tag>
              </div>
            </div>
          </template>
          <template #default="{ row }">
            <span :class="simCellInfo(row, col).cls">{{ simCellInfo(row, col).text }}</span>
          </template>
        </el-table-column>
      </template>

    </el-table>
  </div>
</template>

<style scoped>
.panel-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 10px; gap: 12px; flex-wrap: wrap;
}
.panel-title-group { display: flex; align-items: center; gap: 10px; }
.panel-title { font-size: 14px; font-weight: 600; color: #303133; margin: 0; }
.panel-controls { display: flex; gap: 12px; align-items: center; }
.remove-btn:hover {
  color: #f56c6c !important;
  border-color: #f56c6c !important;
  background: rgba(245, 108, 108, 0.06) !important;
}

.panel-controls :deep(.el-switch .el-switch__inner .is-text) {
  font-size: 12.5px;
}
.panel-controls :deep(.el-segmented) {
  border-radius: 8px;
  --el-segmented-item-selected-bg-color: var(--clara-primary);
  --el-segmented-item-selected-color: #fff;
}
.panel-controls :deep(.el-segmented .el-segmented__item) {
  font-size: 12.5px;
  border-radius: 6px;
}
.panel-controls :deep(.el-segmented .el-segmented__item-selected) {
  border-radius: 6px;
}

.col-header {
  display: flex; flex-direction: column; gap: 2px; align-items: flex-start;
}
.col-label { font-size: 12px; font-weight: 500; }
.col-header-badges { display: flex; gap: 3px; align-items: center; }
.col-mode-tag { cursor: pointer; user-select: none; font-weight: 700; }
.col-mode-tag:hover { opacity: 0.8; }

.selected-cells-panel :deep(.is-ref-row) td { background-color: #ecf5ff !important; font-weight: 600; }
.selected-cells-panel :deep(.cell-pos) { color: #67c23a; font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; }
.selected-cells-panel :deep(.cell-neg) { color: #f56c6c; font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; }
.selected-cells-panel :deep(.cell-num) { font-variant-numeric: tabular-nums; text-align: right; }
</style>
