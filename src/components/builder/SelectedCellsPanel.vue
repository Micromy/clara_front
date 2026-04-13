<script setup>
import { ref, computed, watch } from 'vue'
import { useBuilderStore } from '../../stores/builderStore.js'

const store = useBuilderStore()

const displayMode = ref('metadata')      // 'metadata' | 'simulation'
const comparisonMode = ref('off')        // 'off' | 'diff' | 'ratio'
const referenceCellId = ref(null)

const COMPARISON_OPTIONS = [
  { label: 'Off',   value: 'off' },
  { label: 'Diff',  value: 'diff' },
  { label: 'Ratio', value: 'ratio' }
]

function updateAlias(cellId, value) {
  store.setCellAlias(store.activeBuilder.id, cellId, value)
}

function getAlias(cellId) {
  return store.getCellAlias(store.activeBuilder.id, cellId)
}

function removeCell(cellId) {
  store.toggleCellSelection(cellId)
}

// Reset comparison when leaving simulation mode
watch(displayMode, (mode) => {
  if (mode !== 'simulation') comparisonMode.value = 'off'
})

// Auto-pick / repair reference when comparison is on
watch([comparisonMode, () => store.selectedCells], ([mode, cells]) => {
  if (mode === 'off') return
  const stillExists = cells.some(c => c.id === referenceCellId.value)
  if (!stillExists) {
    referenceCellId.value = cells.length > 0 ? cells[0].id : null
  }
}, { immediate: true })

// Reference selector: show "alias (cellName)" when alias is set
const referenceOptions = computed(() =>
  store.selectedCells.map(c => {
    const alias = getAlias(c.id)
    return {
      value: c.id,
      label: alias ? `${alias} (${c.cellName})` : c.cellName
    }
  })
)

// All columns in simulation mode: base + derived
const simColumns = computed(() => [
  ...store.selectedCellsSimulationColumns,
  ...store.derivedSimColumns
])

// All numeric keys for diff/ratio
const numericKeys = computed(() =>
  simColumns.value.filter(c => c.numeric).map(c => c.prop)
)

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
        if (comparisonMode.value === 'diff') {
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

function rowClassName({ row }) {
  return isRefRow(row) ? 'is-ref-row' : ''
}

// Returns formatted text and CSS class for a simulation cell value
function simCellInfo(row, col) {
  const v = row[col.prop]
  if (v === null || v === undefined) return { text: '—', cls: '' }
  if (typeof v !== 'number') return { text: String(v), cls: '' }

  const mode = comparisonMode.value
  if (mode === 'off' || displayMode.value !== 'simulation' || isRefRow(row)) {
    return { text: String(v), cls: '' }
  }
  if (mode === 'diff') {
    const sign = v > 0 ? '+' : ''
    return { text: `${sign}${v}`, cls: v > 0 ? 'cell-pos' : v < 0 ? 'cell-neg' : '' }
  }
  // ratio
  return { text: `×${v}`, cls: v > 1 ? 'cell-pos' : v < 1 ? 'cell-neg' : '' }
}
</script>

<template>
  <div class="selected-cells-panel">
    <div class="panel-header">
      <h3 class="panel-title">Selected Cells</h3>
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
            <el-option
              v-for="opt in referenceOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </template>
      </div>
    </div>

    <el-table
      :data="tableRows"
      :row-class-name="rowClassName"
      border
      stripe
      size="small"
      max-height="580"
      empty-text="No cells selected. Select cells from the table above."
    >
      <!-- Alias input (fixed, 1st) -->
      <el-table-column label="Alias" width="140" fixed>
        <template #default="{ row }">
          <el-input
            :model-value="getAlias(row.id)"
            @update:model-value="val => updateAlias(row.id, val)"
            size="small"
            :placeholder="row.cellName"
          />
        </template>
      </el-table-column>

      <!-- Cell Name (fixed, 2nd) -->
      <el-table-column prop="cellName" label="Cell Name" width="150" show-overflow-tooltip fixed />

      <!-- Metadata columns -->
      <template v-if="displayMode === 'metadata'">
        <el-table-column
          v-for="col in store.selectedCellsMetadataColumns"
          :key="col.prop"
          :prop="col.prop"
          :label="col.label"
          :width="col.width"
        />
      </template>

      <!-- Simulation + derived columns with diff/ratio coloring -->
      <template v-else>
        <el-table-column
          v-for="col in simColumns"
          :key="col.prop"
          :label="col.label"
          :width="col.width"
          min-width="100"
        >
          <template #header>
            <span>{{ col.label }}</span>
            <el-tag v-if="col.isDerived" size="small" type="info" style="margin-left:4px">f(x)</el-tag>
          </template>
          <template #default="{ row }">
            <template v-if="isRefRow(row)">
              <el-tag size="small" type="primary" style="margin-right:4px;vertical-align:middle">REF</el-tag>
              <span>{{ row[col.prop] ?? '—' }}</span>
            </template>
            <template v-else>
              <span :class="simCellInfo(row, col).cls">{{ simCellInfo(row, col).text }}</span>
            </template>
          </template>
        </el-table-column>
      </template>

      <!-- Remove button -->
      <el-table-column label="" width="50" fixed="right">
        <template #default="{ row }">
          <el-button type="danger" link size="small" @click="removeCell(row.id)">✕</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.panel-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.selected-cells-panel :deep(.is-ref-row) td {
  background-color: #ecf5ff !important;
  font-weight: 600;
}

.selected-cells-panel :deep(.cell-pos) {
  color: #67c23a;
  font-weight: 600;
}

.selected-cells-panel :deep(.cell-neg) {
  color: #f56c6c;
  font-weight: 600;
}
</style>
