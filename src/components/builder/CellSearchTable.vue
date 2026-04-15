<script setup>
import { ref, computed, watch } from 'vue'
import { useBuilderStore, CELL_TYPE_OPTIONS } from '../../stores/builderStore.js'
import ColumnFilterDropdown from './ColumnFilterDropdown.vue'

const emit = defineEmits(['expand'])
defineProps({
  showExpandButton: { type: Boolean, default: true }
})

const store = useBuilderStore()

const currentPage = ref(1)
const pageSize = ref(10)
const tableRef = ref(null)

// Bind inputs to pending state
const pendingCellType = computed({
  get: () => store.pendingSearch.cellType,
  set: v => store.setPendingCellType(v)
})
const pendingQuery = computed({
  get: () => store.pendingSearch.query,
  set: v => store.setPendingQuery(v)
})

// Reset to first page whenever a new search is applied
watch(() => store.appliedSearch, () => { currentPage.value = 1 }, { deep: true })

const rows = computed(() => store.filteredCells)
const totalCells = computed(() => rows.value.length)
const pagedCells = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return rows.value.slice(start, start + pageSize.value)
})
const totalSelected = computed(() => store.activeBuilder?.selectedCellIds.length || 0)

const hasSearched = computed(() => !!store.appliedSearch.cellType)

function runSearch() {
  if (!store.canSearch) return
  store.applySearch()
}

function handleSelectionChange(selected) {
  const pageIds = pagedCells.value.map(c => c.id)
  const selectedIds = selected.map(r => r.id)
  const toDeselect = pageIds.filter(id => !selectedIds.includes(id))
  store.deselectCells(toDeselect)
  store.selectCells(selectedIds)
}
</script>

<template>
  <div class="cell-search-table">
    <div class="table-header">
      <div class="search-controls">
        <el-select
          v-model="pendingCellType"
          placeholder="Cell Type *"
          style="width: 130px"
          clearable
        >
          <el-option
            v-for="opt in CELL_TYPE_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>

        <el-input
          v-model="pendingQuery"
          placeholder="Search by Cell Name…"
          clearable
          prefix-icon="Search"
          style="width: 320px"
          @keyup.enter="runSearch"
        />

        <el-button
          type="primary"
          :icon="'Search'"
          :disabled="!store.canSearch"
          @click="runSearch"
        >
          Search
        </el-button>

        <el-tag
          v-if="store.searchDirty && hasSearched"
          type="warning"
          size="small"
          effect="plain"
        >
          Pending changes
        </el-tag>
      </div>

      <div class="right-controls">
        <span class="selected-count">
          Selected: <strong>{{ totalSelected }}</strong>
        </span>
        <el-button
          v-if="showExpandButton"
          :icon="'FullScreen'"
          circle
          size="small"
          title="Expand"
          @click="emit('expand')"
        />
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
      :empty-text="hasSearched ? 'No matching cells' : 'Select a Cell Type and press Search'"
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
      >
        <template #header>
          <span class="col-header">
            <span>{{ col.label }}</span>
            <ColumnFilterDropdown :column-key="col.key" :label="col.label" />
          </span>
        </template>
      </el-table-column>
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
  gap: 12px;
  flex-wrap: wrap;
}

.search-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.right-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selected-count {
  font-size: 13px;
  color: #606266;
}

.col-header {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.table-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
