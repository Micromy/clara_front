<script setup>
import { ref, computed, watch, nextTick, inject } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useBuilderStore, CELL_TYPE_OPTIONS } from '../../stores/builderStore.js'
import ColumnFilterDropdown from './ColumnFilterDropdown.vue'
import { useDragSelect } from '../../composables/useDragSelect.js'

const emit = defineEmits(['expand'])
const props = defineProps({
  showExpandButton: { type: Boolean, default: true },
  inPopup: { type: Boolean, default: false }
})

const store = useBuilderStore()
// Popup window body is provided by usePopupWindow when the component is
// mounted inside a popup sub-app; null in the main window.
const popupBody = inject('popupBody', null)

const currentPage = ref(1)
const pageSize = ref(10)
const tableRef = ref(null)
const { onCellMouseEnter } = useDragSelect(tableRef)

const pendingCellType = computed({
  get: () => store.pendingSearch.cellType,
  set: async v => {
    if (!v) return
    const prev = store.pendingSearch.cellType
    const selectedCount = store.activeBuilder?.selectedCellIds.length || 0

    if (prev && prev !== v && selectedCount > 0) {
      try {
        await ElMessageBox.confirm(
          `Changing cell type will clear ${selectedCount} selected cell${selectedCount > 1 ? 's' : ''}. Continue?`,
          'Switch Cell Type',
          { confirmButtonText: 'Continue', cancelButtonText: 'Cancel', type: 'warning' }
        )
      } catch {
        store.setPendingCellType(prev)
        return
      }
    }

    if (prev && prev !== v) {
      store.clearSelection(v)
      store.resetSearch()
    }

    store.setPendingCellType(v)

    if (prev && prev !== v) {
      await nextTick()
      tableRef.value?.clearSelection()
    }
  }
})
let queryDebounceTimer = null
const pendingQuery = computed({
  get: () => store.pendingSearch.query,
  set: v => {
    store.pendingSearch.query = v
    clearTimeout(queryDebounceTimer)
    queryDebounceTimer = setTimeout(() => store.applySearch(), 300)
  }
})

const pendingPdk = computed({
  get: () => store.pendingSearch.pdk,
  set: v => {
    store.setPendingPdk(v)
  }
})

const pendingLibraries = computed({
  get: () => store.pendingSearch.libraries,
  set: v => store.setPendingLibraries(v)
})

// When PDK changes, reset library selection (cascading)
watch(pendingPdk, () => {
  pendingLibraries.value = []
})

function getCheckedIds() {
  const tbl = tableRef.value
  if (!tbl) return []
  const selected = tbl.getSelectionRows ? tbl.getSelectionRows() : []
  return selected.map(r => r.id)
}

function clearChecks() {
  tableRef.value?.clearSelection()
}

defineExpose({ getCheckedIds, clearChecks })

watch(() => store.appliedSearch, () => { currentPage.value = 1 }, { deep: true })

const rows = computed(() => store.filteredCells)
const totalCells = computed(() => rows.value.length)
const pagedCells = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return rows.value.slice(start, start + pageSize.value)
})
const totalSelected = computed(() => store.activeBuilder?.selectedCellIds.length || 0)
const hasSearched = computed(() =>
  !!store.appliedSearch.cellType &&
  !!store.appliedSearch.pdk &&
  store.appliedSearch.libraries.length > 0
)

const paginationLayout = computed(() => 'total, sizes, prev, pager, next')
</script>

<template>
  <div class="cell-search-table">
    <div class="table-header">
      <div class="search-controls">
        <el-select
          v-model="pendingCellType"
          placeholder="Cell Type *"
          style="width: 130px"
          :teleported="!inPopup"
        >
          <el-option
            v-for="opt in CELL_TYPE_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>

        <el-select
          v-model="pendingPdk"
          placeholder="PDK"
          clearable
          style="width: 360px"
          :teleported="!inPopup"
        >
          <el-option
            v-for="opt in store.pdkOptions"
            :key="opt"
            :label="opt"
            :value="opt"
          />
        </el-select>

        <el-select
          v-model="pendingLibraries"
          placeholder="Library"
          multiple
          collapse-tags
          collapse-tags-tooltip
          clearable
          style="width: 200px"
          :teleported="!inPopup"
        >
          <el-option
            v-for="opt in store.libraryOptions"
            :key="opt"
            :label="opt"
            :value="opt"
          />
        </el-select>

        <el-input
          v-model="pendingQuery"
          placeholder="Search by Cell Name…"
          clearable
          prefix-icon="Search"
          style="width: 320px"
        />
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
      :row-key="row => row.id"
      :empty-text="hasSearched ? 'No matching cells' : 'Select Cell Type, PDK, and Library to search'"
      @cell-mouse-enter="onCellMouseEnter"
    >
      <el-table-column type="selection" width="45" :reserve-selection="true" />
      <el-table-column
        v-for="col in store.searchTableColumns"
        :key="col.key"
        :prop="col.key"
        :label="col.label"
        :min-width="col.width"
        sortable
        show-overflow-tooltip
      >
        <template #header>
          <div class="col-header">
            <span class="col-label">{{ col.label }}</span>
            <div class="col-icons">
              <ColumnFilterDropdown
                :column-key="col.key"
                :label="col.label"
                :in-popup="inPopup"
                :popup-body="popupBody"
              />
            </div>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div class="table-footer">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="totalCells"
        :page-sizes="[10, 20, 50, 100]"
        :layout="paginationLayout"
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
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-height: 36px;
}
.col-label {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: normal;
  overflow-wrap: normal;
  white-space: normal;
}
.col-icons {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

/* Position Element Plus sort caret next to filter icon */
.cell-search-table :deep(.el-table .cell) {
  display: flex;
  align-items: center;
}
.cell-search-table :deep(th .caret-wrapper) {
  height: 20px;
}

.table-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
