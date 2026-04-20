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

function ctxSave() {
  // TODO: implement chart save
  ElMessage.info('Chart save coming soon.')
  hideCtxMenu()
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

    <!-- Top row: chart set tabs -->
    <div class="tab-bar-top">
      <div class="set-tabs">
        <div
          v-for="builder in store.builders"
          :key="builder.id"
          class="set-tab"
          :class="{
            active: activeSetId === builder.id,
            'drop-left': dropTarget === builder.id && dropSide === 'left',
            'drop-right': dropTarget === builder.id && dropSide === 'right',
            'is-dragging': dragId === builder.id
          }"
          draggable="true"
          @click="selectSet(builder)"
          @dragstart="onDragStart($event, builder.id)"
          @dragover="onDragOver($event, builder.id)"
          @drop="onDrop($event, builder.id)"
          @dragend="clearDrag"
          @contextmenu="showCtxMenu($event, builder)"
        >
          <!-- Editing -->
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
          <!-- Normal -->
          <span v-else class="set-tab-label">
            {{ builder.name }}
            <span class="tab-more" @click.stop="showCtxMenu($event, builder)">⋯</span>
          </span>
        </div>
      </div>
      <div class="tab-bar-actions">
        <el-button size="small" @click="addNewBuilder">+ New</el-button>
      </div>
    </div>

    <!-- Bottom row: Builder | Chart sub-tab -->
    <div class="tab-bar-sub">
      <el-segmented
        :model-value="activeSubTab"
        :options="[
          { label: 'Builder', value: 'builder' },
          { label: 'Chart', value: 'chart', disabled: !hasChart(activeSetId) }
        ]"
        size="small"
        @change="switchSubTab"
      />
    </div>

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

/* ── Top tab row: chart sets ────────────────────────────── */
.tab-bar-top {
  display: flex;
  align-items: stretch;
  background: #fafafa;
  border-bottom: 1px solid #e4e7ed;
  padding: 0 20px;
  flex-shrink: 0;
}

.set-tabs {
  display: flex;
  flex: 1;
  gap: 0;
}

.set-tab {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 32px 0 16px;
  height: 38px;
  font-size: 13.5px;
  color: #909399;
  cursor: pointer;
  border-right: 1px solid #e4e7ed;
  user-select: none;
  transition: color 0.15s, background 0.15s;
}
.set-tab:hover { color: #606266; background: #f0f0f0; }
.set-tab.active {
  color: #303133;
  background: #fff;
  font-weight: 500;
  border-bottom: 2px solid var(--clara-primary);
  margin-bottom: -1px;
}
.set-tab.is-dragging { opacity: 0.5; }

.set-tab.drop-left::before,
.set-tab.drop-right::after {
  content: '';
  position: absolute;
  top: 4px;
  bottom: 4px;
  width: 2px;
  background: var(--clara-primary);
  border-radius: 1px;
}
.set-tab.drop-left::before { left: 0; }
.set-tab.drop-right::after { right: 0; }

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
  gap: 8px;
  padding-left: 12px;
}

/* ── Bottom sub-tab row ─────────────────────────────────── */
.tab-bar-sub {
  display: flex;
  align-items: center;
  padding: 6px 20px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
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
