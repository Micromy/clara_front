<script setup>
import { computed, ref, watch } from 'vue'
import { useBuilderStore } from '../../stores/builderStore.js'

const props = defineProps({
  columnKey: { type: String, required: true },
  label: { type: String, default: '' },
  inPopup: { type: Boolean, default: false }
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

watch(popoverVisible, (v) => {
  if (v) {
    const vals = store.pendingSearch.columnFilters[props.columnKey]
    localSelection.value = vals ? [...vals] : []
    searchText.value = ''
    dragState.value = null
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

// ── Drag-to-toggle selection ──
// Excel-style: pointerdown on an item decides action (check or uncheck based
// on opposite of current state), then pointer enter on other items applies
// the same action. Each value is processed at most once per drag.
const dragState = ref(null)  // { action: 'check' | 'uncheck', processed: Set<string> }

function applyAction(value, action) {
  const set = new Set(localSelection.value)
  if (action === 'check') set.add(value)
  else set.delete(value)
  localSelection.value = Array.from(set)
}

function itemValueFromEvent(e) {
  const el = e.target.closest('[data-filter-value]')
  return el ? el.dataset.filterValue : null
}

function onPointerDown(e) {
  if (e.button !== 0) return
  const value = itemValueFromEvent(e)
  if (value == null) return
  const willCheck = !localSelection.value.includes(value)
  dragState.value = {
    action: willCheck ? 'check' : 'uncheck',
    processed: new Set([value])
  }
  applyAction(value, dragState.value.action)
  e.preventDefault()
}

function onPointerEnter(e) {
  if (!dragState.value) return
  const value = itemValueFromEvent(e)
  if (value == null) return
  if (dragState.value.processed.has(value)) return
  dragState.value.processed.add(value)
  applyAction(value, dragState.value.action)
}

function endDrag() {
  dragState.value = null
}

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
    :teleported="!inPopup"
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

      <div
        class="filter-list"
        :class="{ dragging: dragState }"
        @pointerdown="onPointerDown"
        @pointerover="onPointerEnter"
        @pointerup="endDrag"
        @pointerleave="endDrag"
        @pointercancel="endDrag"
      >
        <div
          v-for="opt in filteredOptions"
          :key="opt"
          :data-filter-value="opt"
          class="filter-item"
          :class="{ selected: localSelection.includes(opt) }"
        >
          <span class="check-box">
            <el-icon v-if="localSelection.includes(opt)" :size="12"><Check /></el-icon>
          </span>
          <span class="label">{{ opt }}</span>
        </div>
        <div v-if="filteredOptions.length === 0" class="empty">No values</div>
      </div>

      <div class="filter-hint">Tip: click &amp; drag to select multiple</div>

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
  user-select: none;
  touch-action: none;
}
.filter-list.dragging { cursor: grabbing; }

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  font-size: 13px;
  color: #303133;
  cursor: pointer;
  border-radius: 2px;
}
.filter-item:hover { background: #f5f7fa; }
.filter-item.selected { background: rgba(64, 158, 255, 0.08); color: var(--clara-primary, #409eff); }

.check-box {
  width: 14px;
  height: 14px;
  border: 1px solid #dcdfe6;
  border-radius: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  flex-shrink: 0;
}
.filter-item.selected .check-box {
  background: var(--clara-primary, #409eff);
  border-color: var(--clara-primary, #409eff);
  color: #fff;
}

.label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty {
  text-align: center;
  color: #c0c4cc;
  font-size: 12px;
  padding: 12px 0;
}

.filter-hint {
  font-size: 11px;
  color: #c0c4cc;
  text-align: center;
}

.filter-footer {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
</style>
