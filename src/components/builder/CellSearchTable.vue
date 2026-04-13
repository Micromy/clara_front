<script setup>
import { ref, computed } from 'vue'
import { useBuilderStore } from '../../stores/builderStore.js'

const store = useBuilderStore()

const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const tableRef = ref(null)

const filteredCells = computed(() => {
  if (!searchQuery.value) return store.allCells
  const q = searchQuery.value.toLowerCase()
  return store.allCells.filter(cell =>
    cell.cellName.toLowerCase().includes(q) ||
    cell.cellType.toLowerCase().includes(q) ||
    cell.library.toLowerCase().includes(q)
  )
})

const totalCells = computed(() => filteredCells.value.length)

const pagedCells = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredCells.value.slice(start, start + pageSize.value)
})

const totalSelected = computed(() => store.activeBuilder?.selectedCellIds.length || 0)

function handleSelectionChange(rows) {
  const pageIds = pagedCells.value.map(c => c.id)
  const selectedIds = rows.map(r => r.id)

  // Deselect cells on this page that are no longer selected
  const toDeselect = pageIds.filter(id => !selectedIds.includes(id))
  store.deselectCells(toDeselect)

  // Select newly selected cells
  store.selectCells(selectedIds)
}

function isRowSelected(row) {
  return store.activeBuilder?.selectedCellIds.includes(row.id)
}
</script>

<template>
  <div class="cell-search-table">
    <div class="table-header">
      <el-input
        v-model="searchQuery"
        placeholder="Search by Cell Name..."
        clearable
        prefix-icon="Search"
        style="width: 320px"
        @input="currentPage = 1"
      />
      <div class="selected-count">
        Total Selected Cells: <strong>{{ totalSelected }}</strong>
      </div>
    </div>

    <el-table
      ref="tableRef"
      :data="pagedCells"
      border
      stripe
      size="small"
      height="100%"
      style="width: 100%; flex: 1"
      @selection-change="handleSelectionChange"
      :row-key="row => row.id"
    >
      <el-table-column type="selection" width="45" :reserve-selection="true" />
      <el-table-column
        v-for="col in store.searchTableColumns"
        :key="col.key"
        :prop="col.key"
        :label="col.label"
        :width="col.width"
        sortable
        show-overflow-tooltip
      />
    </el-table>

    <div class="table-footer">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="totalCells"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        small
      />
    </div>
  </div>
</template>

<style scoped>
.cell-search-table {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
}

.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.selected-count {
  font-size: 13px;
  color: #606266;
}

.table-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
