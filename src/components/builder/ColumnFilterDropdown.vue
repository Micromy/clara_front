<script setup>
import { computed, ref, watch } from 'vue'
import { useBuilderStore } from '../../stores/builderStore.js'

const props = defineProps({
  columnKey: { type: String, required: true },
  label: { type: String, default: '' }
})

const store = useBuilderStore()
const popoverVisible = ref(false)
const localSelection = ref([])
const searchText = ref('')

const options = computed(() => store.columnFilterOptions(props.columnKey))
const filteredOptions = computed(() => {
  const q = searchText.value.toLowerCase().trim()
  if (!q) return options.value
  return options.value.filter(v => v.toLowerCase().includes(q))
})

const activeCount = computed(() => {
  const vals = store.pendingSearch.columnFilters[props.columnKey]
  return vals ? vals.length : 0
})
const isActive = computed(() => activeCount.value > 0)

// Sync popover-local selection with store's pending filter whenever popover opens
watch(popoverVisible, (v) => {
  if (v) {
    const vals = store.pendingSearch.columnFilters[props.columnKey]
    localSelection.value = vals ? [...vals] : []
    searchText.value = ''
  }
})

const allFilteredChecked = computed({
  get() {
    if (filteredOptions.value.length === 0) return false
    return filteredOptions.value.every(v => localSelection.value.includes(v))
  },
  set(checked) {
    if (checked) {
      const set = new Set(localSelection.value)
      filteredOptions.value.forEach(v => set.add(v))
      localSelection.value = Array.from(set)
    } else {
      const filtered = new Set(filteredOptions.value)
      localSelection.value = localSelection.value.filter(v => !filtered.has(v))
    }
  }
})

function apply() {
  store.setPendingColumnFilter(props.columnKey, localSelection.value)
  popoverVisible.value = false
}

function clear() {
  localSelection.value = []
  store.clearPendingColumnFilter(props.columnKey)
  popoverVisible.value = false
}

function onTriggerClick(e) {
  e.stopPropagation()
  popoverVisible.value = !popoverVisible.value
}
</script>

<template>
  <el-popover
    v-model:visible="popoverVisible"
    placement="bottom-start"
    :width="240"
    trigger="manual"
    popper-class="column-filter-popper"
  >
    <template #reference>
      <span
        class="filter-trigger"
        :class="{ active: isActive }"
        :title="isActive ? `${activeCount} selected` : 'Filter'"
        @click="onTriggerClick"
      >
        <el-icon :size="12"><Filter /></el-icon>
        <span v-if="isActive" class="badge">{{ activeCount }}</span>
      </span>
    </template>

    <div class="filter-panel" @click.stop>
      <div class="filter-header">
        <span class="filter-title">{{ label || columnKey }}</span>
        <el-input
          v-model="searchText"
          placeholder="Search values…"
          size="small"
          clearable
        />
      </div>

      <div class="filter-toolbar">
        <el-checkbox v-model="allFilteredChecked" size="small">
          Select all{{ searchText ? ' (filtered)' : '' }}
        </el-checkbox>
        <span class="count-hint">{{ localSelection.length }} / {{ options.length }}</span>
      </div>

      <div class="filter-list">
        <el-checkbox-group v-model="localSelection">
          <el-checkbox
            v-for="opt in filteredOptions"
            :key="opt"
            :label="opt"
            size="small"
          >{{ opt }}</el-checkbox>
        </el-checkbox-group>
        <div v-if="filteredOptions.length === 0" class="empty">No values</div>
      </div>

      <div class="filter-footer">
        <el-button size="small" @click="clear">Clear</el-button>
        <el-button size="small" type="primary" @click="apply">Apply</el-button>
      </div>
    </div>
  </el-popover>
</template>

<style scoped>
.filter-trigger {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: 4px;
  padding: 2px 4px;
  border-radius: 3px;
  color: #909399;
  cursor: pointer;
  vertical-align: middle;
  line-height: 1;
}
.filter-trigger:hover { color: var(--clara-primary, #409eff); background: rgba(64, 158, 255, 0.08); }
.filter-trigger.active { color: var(--clara-primary, #409eff); background: rgba(64, 158, 255, 0.12); }
.badge {
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
}

.filter-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.filter-header { display: flex; flex-direction: column; gap: 6px; }
.filter-title { font-size: 12px; font-weight: 600; color: #303133; }
.filter-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #ebeef5;
  padding-top: 6px;
}
.count-hint { font-size: 11px; color: #909399; }
.filter-list {
  max-height: 220px;
  overflow-y: auto;
  border-top: 1px solid #ebeef5;
  border-bottom: 1px solid #ebeef5;
  padding: 4px 0;
}
.filter-list :deep(.el-checkbox) {
  display: flex;
  width: 100%;
  margin-right: 0;
  padding: 2px 4px;
}
.empty {
  text-align: center;
  color: #c0c4cc;
  font-size: 12px;
  padding: 12px 0;
}
.filter-footer {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
</style>
