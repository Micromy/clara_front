<script setup>
import { ref, computed, watch } from 'vue'
import { useBuilderStore } from '../../stores/builderStore.js'

const store = useBuilderStore()

const displayMode = ref('metadata')      // 'metadata' | 'simulation'
const comparisonMode = ref('off')        // 'off' | 'diff' | 'ratio'
const referenceCellId = ref(null)

const COMPARISON_OPTIONS = [
  { label: 'Off', value: 'off' },
  { label: 'Diff', value: 'diff' },
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
  if (mode !== 'simulation') {
    comparisonMode.value = 'off'
  }
})

// Auto-pick / repair reference when comparison is on
watch([comparisonMode, () => store.selectedCells], ([mode, cells]) => {
  if (mode === 'off') return
  const stillExists = cells.some(c => c.id === referenceCellId.value)
  if (!stillExists) {
    referenceCellId.value = cells.length > 0 ? cells[0].id : null
  }
}, { immediate: true })

const referenceOptions = computed(() =>
  store.selectedCells.map(c => ({
    value: c.id,
    label: getAlias(c.id) || c.cellName
  }))
)

const tableRows = computed(() => {
  const cells = store.selectedCells
  if (displayMode.value !== 'simulation' || comparisonMode.value === 'off') return cells
  const ref = cells.find(c => c.id === referenceCellId.value)
  if (!ref) return cells
  const numericFields = store.numericSimFields
  return cells.map(c => {
    if (c.id === ref.id) return c
    const copy = { ...c }
    for (const key of numericFields) {
      const a = c[key], b = ref[key]
      if (typeof a === 'number' && typeof b === 'number') {
        if (comparisonMode.value === 'diff') {
          copy[key] = Math.round((a - b) * 1000) / 1000
        } else {
          copy[key] = b === 0 ? null : Math.round((a / b) * 10000) / 10000
        }
      }
    }
    return copy
  })
})

function rowClassName({ row }) {
  if (
    displayMode.value === 'simulation' &&
    comparisonMode.value !== 'off' &&
    row.id === referenceCellId.value
  ) {
    return 'is-ref-row'
  }
  return ''
}

function formatSimCell({ row, column, cellValue }) {
  if (cellValue === null || cellValue === undefined) return '—'
  if (typeof cellValue !== 'number') return cellValue
  const isRef = row.id === referenceCellId.value
  const mode = comparisonMode.value
  if (mode === 'off' || isRef) return cellValue
  if (mode === 'diff') {
    const sign = cellValue > 0 ? '+' : ''
    return `${sign}${cellValue}`
  }
  // ratio
  return `×${cellValue}`
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
            style="width: 160px"
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
      max-height="240"
      empty-text="No cells selected. Select cells from the table above."
    >
      <el-table-column label="Alias" width="140">
        <template #default="{ row }">
          <el-input
            :model-value="getAlias(row.id)"
            @update:model-value="val => updateAlias(row.id, val)"
            size="small"
            :placeholder="row.cellName"
          />
        </template>
      </el-table-column>
      <el-table-column prop="cellName" label="Cell Name" width="150" show-overflow-tooltip />

      <template v-if="displayMode === 'metadata'">
        <el-table-column
          v-for="col in store.selectedCellsMetadataColumns"
          :key="col.prop"
          :prop="col.prop"
          :label="col.label"
          :width="col.width"
        />
      </template>
      <template v-else>
        <el-table-column
          v-for="col in store.selectedCellsSimulationColumns"
          :key="col.prop"
          :prop="col.prop"
          :label="col.label"
          :width="col.width"
          :formatter="col.numeric ? formatSimCell : undefined"
        />
      </template>

      <el-table-column label="" width="50" fixed="right">
        <template #default="{ row }">
          <el-button
            type="danger"
            link
            size="small"
            @click="removeCell(row.id)"
          >✕</el-button>
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
</style>
