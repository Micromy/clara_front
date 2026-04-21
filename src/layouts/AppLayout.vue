<script setup>
import { ref, computed, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useBuilderStore } from '../stores/builderStore.js'

const router = useRouter()
const route = useRoute()
const store = useBuilderStore()

// ── Active state ──
const activeSetId = computed(() => {
  const id = route.name === 'Chart'
    ? Number(route.params.builderId)
    : Number(route.params.id || store.activeBuilder?.id || 1)
  return id
})

const activeSubTab = computed(() => {
  return route.name === 'Chart' ? 'chart' : 'builder'
})

function hasChart(builderId) {
  return store.chartTabs.some(c => c.builderId === builderId)
}

function selectSet(builder) {
  const idx = store.builders.findIndex(b => b.id === builder.id)
  if (idx !== -1) store.activeBuilderIndex = idx
  if (activeSubTab.value === 'chart' && hasChart(builder.id)) {
    router.push(`/chart/${builder.id}`)
  } else {
    router.push(`/builder/${builder.id}`)
  }
}

function switchSubTab(val) {
  const id = activeSetId.value
  if (val === 'chart') {
    router.push(`/chart/${id}`)
  } else {
    router.push(`/builder/${id}`)
  }
}

function activateSet(builderId, tab) {
  const idx = store.builders.findIndex(b => b.id === builderId)
  if (idx !== -1) store.activeBuilderIndex = idx
  if (tab === 'chart') {
    router.push(`/chart/${builderId}`)
  } else {
    router.push(`/builder/${builderId}`)
  }
}

// ── Tab editing ──
const editingTab = ref(null)
const editingValue = ref('')
const editInput = ref(null)

function startEdit(builderId, currentName) {
  editingTab.value = builderId
  editingValue.value = currentName
  nextTick(() => {
    editInput.value?.focus()
    editInput.value?.select()
  })
}

function commitEdit(builderId) {
  const val = editingValue.value.trim()
  if (!val) { editingTab.value = null; return }
  const b = store.builders.find(b => b.id === builderId)
  if (b) b.name = val
  editingTab.value = null
}

// ── Tab drag reorder ──
const dragId = ref(null)
const dropTarget = ref(null)
const dropSide = ref(null)

function onDragStart(e, builderId) {
  dragId.value = builderId
  e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e, builderId) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  if (builderId === dragId.value) { dropTarget.value = null; dropSide.value = null; return }
  dropTarget.value = builderId
  const rect = e.currentTarget.getBoundingClientRect()
  dropSide.value = (e.clientX - rect.left) < rect.width / 2 ? 'left' : 'right'
}

function onDrop(e, targetId) {
  e.preventDefault()
  if (!dragId.value || dragId.value === targetId) { clearDrag(); return }
  const arr = store.builders
  const srcIdx = arr.findIndex(b => b.id === dragId.value)
  const tgtIdx = arr.findIndex(b => b.id === targetId)
  if (srcIdx === -1 || tgtIdx === -1) { clearDrag(); return }
  const [item] = arr.splice(srcIdx, 1)
  const insertIdx = dropSide.value === 'right' ? tgtIdx + (srcIdx < tgtIdx ? 0 : 1) : tgtIdx + (srcIdx < tgtIdx ? -1 : 0)
  arr.splice(Math.max(0, insertIdx), 0, item)
  clearDrag()
}

function clearDrag() {
  dragId.value = null
  dropTarget.value = null
  dropSide.value = null
}

// ── Add / Remove ──
function addNewBuilder() {
  store.addBuilder()
  const newBuilder = store.builders[store.builders.length - 1]
  router.push(`/builder/${newBuilder.id}`)
}

async function closeSet(builder) {
  const count = builder.selectedCellIds?.length || 0
  if (store.builders.length <= 1) return
  try {
    await ElMessageBox.confirm(
      count > 0
        ? `"${builder.name}" has ${count} selected cell${count > 1 ? 's' : ''}. Close?`
        : `Close "${builder.name}"?`,
      'Close',
      { confirmButtonText: 'Close', cancelButtonText: 'Cancel', type: 'warning' }
    )
  } catch { return }
  const idx = store.builders.findIndex(b => b.id === builder.id)
  store.removeChartTab(builder.id)
  store.removeBuilder(idx)
  router.push(`/builder/${store.activeBuilder.id}`)
}

// ── Context menu ──
const ctxMenu = ref({ visible: false, x: 0, y: 0, builder: null })

function showCtxMenu(e, builder) {
  e.preventDefault()
  e.stopPropagation()
  ctxMenu.value = { visible: true, x: e.clientX, y: e.clientY, builder }
  document.addEventListener('click', hideCtxMenu, { once: true })
}

function hideCtxMenu() { ctxMenu.value.visible = false }

function ctxRename() {
  const b = ctxMenu.value.builder
  if (b) startEdit(b.id, b.name)
  hideCtxMenu()
}

const loadChartDialogVisible = ref(false)

async function ctxSave() {
  const builder = ctxMenu.value.builder
  hideCtxMenu()
  if (!builder) return

  let name = builder.name

  // Check duplicates and append suffix
  const existing = store.savedCharts.map(c => c.name)
  if (existing.includes(name)) {
    let i = 2
    while (existing.includes(`${name} (${i})`)) i++
    name = `${name} (${i})`
  }

  try {
    await ElMessageBox.confirm(
      `Save as "${name}"?`,
      'Save Chart',
      { confirmButtonText: 'Save', cancelButtonText: 'Cancel', type: 'info' }
    )
  } catch { return }

  store.saveChart(name)
  ElMessage.success(`Chart "${name}" saved.`)
}

function onLoadChart(chartId) {
  const chartTab = store.restoreChart(chartId)
  loadChartDialogVisible.value = false
  if (chartTab) {
    router.push(`/chart/${chartTab.builderId}`)
  } else {
    router.push(`/builder/${store.activeBuilder.id}`)
  }
  ElMessage.success('Chart loaded.')
}

async function onDeleteChart(chart) {
  try {
    await ElMessageBox.confirm(
      `Delete saved chart "${chart.name}"?`,
      'Delete',
      { confirmButtonText: 'Delete', cancelButtonText: 'Cancel', type: 'warning' }
    )
    store.deleteSavedChart(chart.id)
    ElMessage.info('Chart deleted.')
  } catch {}
}

function ctxClose() {
  closeSet(ctxMenu.value.builder)
  hideCtxMenu()
}
</script>

<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="header-logo">
        <h1>ARIAS</h1>
      </div>
    </header>

    <!-- Tab bar: two-level -->
    <div class="tab-bar">
      <div class="set-tabs">
        <div
          v-for="builder in store.builders"
          :key="builder.id"
          class="set-group"
          :class="{
            active: activeSetId === builder.id,
            'drop-left': dropTarget === builder.id && dropSide === 'left',
            'drop-right': dropTarget === builder.id && dropSide === 'right',
            'is-dragging': dragId === builder.id
          }"
          draggable="true"
          @dragstart="onDragStart($event, builder.id)"
          @dragover="onDragOver($event, builder.id)"
          @drop="onDrop($event, builder.id)"
          @dragend="clearDrag"
        >
          <!-- Top: name -->
          <div class="set-name" @click="selectSet(builder)" @contextmenu="showCtxMenu($event, builder)">
            <span v-if="editingTab === builder.id" class="set-tab-edit" @click.stop>
              <input
                ref="editInput"
                v-model="editingValue"
                class="tab-edit-input"
                @keyup.enter="commitEdit(builder.id)"
                @keydown.stop
              />
              <el-icon class="tab-btn-confirm" @click="commitEdit(builder.id)"><Check /></el-icon>
            </span>
            <span v-else class="set-tab-label">
              {{ builder.name }}
              <span class="tab-more" @click.stop="showCtxMenu($event, builder)">⋯</span>
            </span>
          </div>
          <!-- Bottom: sub-tabs -->
          <div class="set-sub" :class="{ 'set-sub-hidden': activeSetId !== builder.id }">
            <div
              class="sub-tab"
              :class="{ active: activeSetId === builder.id && activeSubTab === 'builder' }"
              @click="activateSet(builder.id, 'builder')"
            >Builder</div>
            <div
              class="sub-tab"
              :class="{ active: activeSetId === builder.id && activeSubTab === 'chart', disabled: !hasChart(builder.id) }"
              @click="hasChart(builder.id) && activateSet(builder.id, 'chart')"
            >Chart</div>
          </div>
        </div>
      </div>
      <div class="tab-bar-actions">
        <button class="tab-action-btn" @click="loadChartDialogVisible = true">Load</button>
        <button class="tab-action-btn tab-action-primary" @click="addNewBuilder">+ New</button>
      </div>
    </div>

    <!-- Load Chart Dialog -->
    <el-dialog v-model="loadChartDialogVisible" title="Load Chart" width="600px" :close-on-click-modal="true">
      <el-table :data="store.savedCharts" size="small" border stripe max-height="400" empty-text="No saved charts.">
        <el-table-column prop="name" label="Name" min-width="150" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="Created" width="140" />
        <el-table-column prop="createdBy" label="By" width="100">
          <template #default="{ row }">{{ row.createdBy || '—' }}</template>
        </el-table-column>
        <el-table-column label="" width="130" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="onLoadChart(row.id)">Load</el-button>
            <el-button size="small" type="danger" link @click="onDeleteChart(row)">Delete</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- Context menu -->
    <Teleport to="body">
      <div
        v-if="ctxMenu.visible"
        class="tab-ctx-menu"
        :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
      >
        <div class="ctx-item" @click="ctxRename">Rename</div>
        <div class="ctx-item" :class="{ 'ctx-item-disabled': !hasChart(ctxMenu.builder?.id) }" @click="hasChart(ctxMenu.builder?.id) && ctxSave()">Save</div>
        <div v-if="store.builders.length > 1" class="ctx-item ctx-item-danger" @click="ctxClose">Close</div>
      </div>
    </Teleport>

    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.app-header {
  height: var(--clara-header-height);
  background: var(--clara-header-bg);
  display: flex;
  align-items: center;
  padding: 0 20px 0 28px;
  flex-shrink: 0;
}

.header-logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-logo h1 {
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 2px;
}

/* ── Tab bar: two-level ──────────────────────────────────── */
.tab-bar {
  display: flex;
  align-items: stretch;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  padding: 0 20px;
  flex-shrink: 0;
}

.set-tabs {
  display: flex;
  flex: 1;
  gap: 0;
  margin-left: 1px;
}

.set-group {
  position: relative;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #ebeef5;
  border-left: 1px solid #ebeef5;
  margin-left: -1px;
  user-select: none;
  transition: background 0.15s;
}
.set-group:hover { background: #f9f9f9; }
.set-group.active { background: #fff; }
.set-group.is-dragging { opacity: 0.5; }

.set-group.drop-left::before,
.set-group.drop-right::after {
  content: '';
  position: absolute;
  top: 4px;
  bottom: 4px;
  width: 2px;
  background: var(--clara-primary);
  border-radius: 1px;
  z-index: 1;
}
.set-group.drop-left::before { left: 0; }
.set-group.drop-right::after { right: 0; }

.set-name {
  display: flex;
  align-items: center;
  padding: 0 32px 0 14px;
  height: 30px;
  font-size: 13px;
  color: #909399;
  cursor: pointer;
  border-bottom: 1px solid #ebeef5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}
.set-group.active .set-name {
  color: #303133;
  font-weight: 500;
  box-shadow: inset 0 -2px 0 var(--clara-primary);
}

.set-sub {
  display: flex;
}
.set-sub-hidden .sub-tab {
  color: #c0c4cc;
}
.set-sub-hidden .sub-tab:hover {
  color: #909399;
}

.set-tab-label {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.set-tab-edit {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tab-more {
  position: absolute;
  right: 10px;
  font-size: 14px;
  color: #c0c4cc;
  opacity: 0.9;
  cursor: pointer;
  letter-spacing: 1px;
}
.set-tab:hover .tab-more { opacity: 1; color: #909399; }

.tab-edit-input {
  font: inherit;
  font-size: 13px;
  width: 100px;
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--clara-primary);
  border-radius: 3px;
  outline: none;
  background: #fff;
  color: #303133;
}

.tab-btn-confirm {
  position: absolute;
  right: 10px;
  font-size: 14px;
  color: var(--clara-primary);
  cursor: pointer;
}
.tab-btn-confirm:hover { background: var(--clara-primary); color: #fff; border-radius: 2px; }

.tab-bar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-left: 12px;
}

.tab-action-btn {
  border: none;
  background: none;
  font-size: 12px;
  color: #909399;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.tab-action-btn:hover {
  background: rgba(0,0,0,0.04);
  color: #606266;
}
.tab-action-primary {
  color: var(--clara-primary, #4078C0);
  font-weight: 600;
}
.tab-action-primary:hover {
  background: rgba(64,120,192,0.08);
  color: var(--clara-primary, #4078C0);
}

.sub-tab {
  padding: 0 14px;
  height: 26px;
  line-height: 26px;
  font-size: 11.5px;
  color: #909399;
  cursor: pointer;
  user-select: none;
  transition: color 0.15s;
}
.sub-tab:hover { color: #606266; }
.sub-tab.active {
  color: #303133;
  font-weight: 500;
  box-shadow: inset 0 -2px 0 var(--clara-primary);
}
.sub-tab.disabled {
  color: #c0c4cc;
  cursor: not-allowed;
}

.app-main {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

/* ── Context menu ──────────────────────────────────────── */
.tab-ctx-menu {
  position: fixed;
  z-index: 9999;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 4px 0;
  min-width: 120px;
}
.ctx-item {
  padding: 8px 16px;
  font-size: 13px;
  color: #303133;
  cursor: pointer;
  user-select: none;
}
.ctx-item:hover { background: #f5f7fa; }
.ctx-item-danger { color: #f56c6c; }
.ctx-item-danger:hover { background: rgba(245, 108, 108, 0.08); }
.ctx-item-disabled { color: #c0c4cc; cursor: not-allowed; }
.ctx-item-disabled:hover { background: transparent; }
</style>
