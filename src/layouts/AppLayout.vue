<script setup>
import { ref, computed, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useBuilderStore } from '../stores/builderStore.js'

const router = useRouter()
const route = useRoute()
const store = useBuilderStore()

const editingTab = ref(null)
const editingValue = ref('')
const editInput = ref(null)

function startEdit(tabName, currentLabel) {
  editingTab.value = tabName
  editingValue.value = currentLabel
  nextTick(() => {
    editInput.value?.focus()
    editInput.value?.select()
  })
}

function commitEdit(tabName) {
  const val = editingValue.value.trim()
  if (!val) { editingTab.value = null; return }
  if (tabName.startsWith('builder-')) {
    const id = Number(tabName.replace('builder-', ''))
    const b = store.builders.find(b => b.id === id)
    if (b) b.name = val
  } else if (tabName.startsWith('chart-')) {
    const builderId = Number(tabName.replace('chart-', ''))
    const c = store.chartTabs.find(t => t.builderId === builderId)
    if (c) c.builderName = val
  }
  editingTab.value = null
}

const activeTab = computed(() => {
  if (route.name === 'Chart') return `chart-${route.params.builderId}`
  return `builder-${route.params.id || 1}`
})

function handleTabClick(tab) {
  const name = tab.paneName || tab.props?.name
  if (!name) return
  if (name.startsWith('builder-')) {
    const id = name.split('-')[1]
    const idx = store.builders.findIndex(b => b.id === Number(id))
    if (idx !== -1) store.activeBuilderIndex = idx
    router.push(`/builder/${id}`)
  } else if (name.startsWith('chart-')) {
    const builderId = name.split('-')[1]
    router.push(`/chart/${builderId}`)
  }
}

// ── Unified tab order (builders + charts mixed freely) ──
const tabOrder = ref([])

const allTabs = computed(() => {
  const bTabs = store.builders.map(b => ({ key: `builder-${b.id}`, type: 'builder', data: b }))
  const cTabs = store.chartTabs.map(c => ({ key: `chart-${c.builderId}`, type: 'chart', data: c }))
  const all = [...bTabs, ...cTabs]

  if (tabOrder.value.length) {
    const map = new Map(all.map(t => [t.key, t]))
    const ordered = tabOrder.value.filter(k => map.has(k)).map(k => map.get(k))
    all.forEach(t => { if (!tabOrder.value.includes(t.key)) ordered.push(t) })
    return ordered
  }
  return all
})

function syncTabOrder() {
  tabOrder.value = allTabs.value.map(t => t.key)
}

// ── Tab drag reorder ──
const dragTabName = ref(null)
const dropTarget = ref(null)
const dropSide = ref(null)

function onDragStart(e, tabName) {
  dragTabName.value = tabName
  e.dataTransfer.effectAllowed = 'move'
  syncTabOrder()
}

function onDragOver(e, tabName) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  if (tabName === dragTabName.value) {
    dropTarget.value = null
    dropSide.value = null
    return
  }
  dropTarget.value = tabName
  const rect = e.currentTarget.getBoundingClientRect()
  dropSide.value = (e.clientX - rect.left) < rect.width / 2 ? 'left' : 'right'
}

function onDrop(e, targetName) {
  e.preventDefault()
  const src = dragTabName.value
  if (!src || src === targetName) { clearDrag(); return }

  const order = [...tabOrder.value]
  const srcIdx = order.indexOf(src)
  if (srcIdx === -1) { clearDrag(); return }
  order.splice(srcIdx, 1)

  let tgtIdx = order.indexOf(targetName)
  if (tgtIdx === -1) { clearDrag(); return }
  if (dropSide.value === 'right') tgtIdx++
  order.splice(tgtIdx, 0, src)
  tabOrder.value = order
  clearDrag()
}

function clearDrag() {
  dragTabName.value = null
  dropTarget.value = null
  dropSide.value = null
}

function addNewBuilder() {
  store.addBuilder()
  const newBuilder = store.builders[store.builders.length - 1]
  router.push(`/builder/${newBuilder.id}`)
}

function removeBuilderTab(id) {
  const idx = store.builders.findIndex(b => b.id === Number(id))
  if (idx !== -1) {
    store.removeBuilder(idx)
    router.push(`/builder/${store.activeBuilder.id}`)
  }
}

function removeChartTab(builderId) {
  store.removeChartTab(Number(builderId))
  router.push(`/builder/${store.activeBuilder.id}`)
}

async function handleTabRemove(name) {
  const isBuilder = name.startsWith('builder-')
  if (isBuilder) {
    const id = Number(name.replace('builder-', ''))
    const b = store.builders.find(b => b.id === id)
    const count = b?.selectedCellIds?.length || 0
    try {
      await ElMessageBox.confirm(
        count > 0
          ? `"${b.name}" has ${count} selected cell${count > 1 ? 's' : ''}. Close this builder?`
          : `Close "${b.name}"?`,
        'Close Builder',
        { confirmButtonText: 'Close', cancelButtonText: 'Cancel', type: 'warning' }
      )
    } catch { return }
    removeBuilderTab(name.replace('builder-', ''))
  } else {
    removeChartTab(name.replace('chart-', ''))
  }
}

// ── Context menu ──
const ctxMenu = ref({ visible: false, x: 0, y: 0, tabKey: null, tabType: null })

function showCtxMenu(e, tabKey, tabType) {
  e.preventDefault()
  e.stopPropagation()
  ctxMenu.value = { visible: true, x: e.clientX, y: e.clientY, tabKey, tabType }
  document.addEventListener('click', hideCtxMenu, { once: true })
}

function hideCtxMenu() {
  ctxMenu.value.visible = false
}

function ctxRename() {
  const { tabKey, tabType } = ctxMenu.value
  if (tabType !== 'builder') return
  const id = Number(tabKey.replace('builder-', ''))
  const b = store.builders.find(b => b.id === id)
  if (b) startEdit(tabKey, b.name)
  hideCtxMenu()
}

function ctxClose() {
  handleTabRemove(ctxMenu.value.tabKey)
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

    <div class="tab-bar">
      <el-tabs
        :model-value="activeTab"
        type="card"
        @tab-click="handleTabClick"
      >
        <el-tab-pane
          v-for="tab in allTabs"
          :key="tab.key"
          :name="tab.key"
        >
          <template #label>
            <!-- Builder editing -->
            <span v-if="tab.type === 'builder' && editingTab === tab.key" class="tab-custom" @click.stop>
              <input
                ref="editInput"
                v-model="editingValue"
                class="tab-edit-input"
                @keyup.enter="commitEdit(tab.key)"
                @keydown.stop
              />
              <el-icon class="tab-btn tab-btn-confirm" @click="commitEdit(tab.key)"><Check /></el-icon>
            </span>
            <!-- Normal state -->
            <span
              v-else
              class="tab-custom"
              :class="{
                'drop-left': dropTarget === tab.key && dropSide === 'left',
                'drop-right': dropTarget === tab.key && dropSide === 'right',
                'is-dragging': dragTabName === tab.key
              }"
              draggable="true"
              @dragstart="onDragStart($event, tab.key)"
              @dragover="onDragOver($event, tab.key)"
              @drop="onDrop($event, tab.key)"
              @dragend="clearDrag"
              @contextmenu="showCtxMenu($event, tab.key, tab.type)"
            >
              <span class="tab-text">{{ tab.type === 'chart' ? 'Chart: ' : '' }}{{ tab.type === 'builder' ? tab.data.name : tab.data.builderName }}</span>
              <span class="tab-more" @click.stop="showCtxMenu($event, tab.key, tab.type)">⋯</span>
            </span>
          </template>
        </el-tab-pane>
      </el-tabs>
      <el-button
        class="add-builder-btn"
        size="small"
        @click="addNewBuilder"
      >
        + New Builder
      </el-button>
    </div>

    <!-- Context menu -->
    <Teleport to="body">
      <div
        v-if="ctxMenu.visible"
        class="tab-ctx-menu"
        :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
      >
        <div v-if="ctxMenu.tabType === 'builder'" class="ctx-item" @click="ctxRename">Rename</div>
        <div
          v-if="ctxMenu.tabType === 'chart' || store.builders.length > 1"
          class="ctx-item ctx-item-danger"
          @click="ctxClose"
        >Close</div>
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
  padding: 0 20px;
  flex-shrink: 0;
}

.header-logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  font-size: 24px;
  color: #60a5fa;
}

.header-logo h1 {
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 2px;
}

.tab-bar {
  display: flex;
  align-items: center;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  padding: 0 20px;
  flex-shrink: 0;
}

.tab-bar :deep(.el-tabs) {
  flex: 1;
}

.tab-bar :deep(.el-tabs__header) {
  margin: 0;
}
.tab-bar :deep(.el-tabs__item) {
  padding: 0 32px 0 16px !important;
  height: 40px;
  line-height: 40px;
  font-size: 14px;
}

.add-builder-btn {
  margin-left: 8px;
  flex-shrink: 0;
}

.app-main {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

/* ── Custom tab content ────────────────────────────────── */
.tab-custom {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
}

.tab-custom[draggable="true"] {
  cursor: grab;
}
.tab-custom.is-dragging {
  opacity: 0.5;
  cursor: grabbing;
}
.tab-custom.drop-left::before,
.tab-custom.drop-right::after {
  content: '';
  position: absolute;
  top: -2px;
  bottom: -2px;
  width: 2px;
  background: var(--clara-primary);
  border-radius: 1px;
  box-shadow: 0 0 6px rgba(64, 158, 255, 0.5);
}
.tab-custom.drop-left::before {
  left: -16px;
}
.tab-custom.drop-right::after {
  right: -32px;
}

.tab-text {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-more {
  position: absolute;
  right: -24px;
  font-size: 14px;
  color: #c0c4cc;
  cursor: pointer;
  padding: 0 2px;
  border-radius: 2px;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
  user-select: none;
  line-height: 1;
  letter-spacing: 1px;
}
.tab-custom:hover .tab-more {
  opacity: 1;
}
.tab-more:hover {
  color: var(--clara-primary);
  background: rgba(64, 158, 255, 0.1);
}

.tab-btn-confirm {
  position: absolute;
  right: -24px;
  font-size: 15px;
  color: var(--clara-primary);
  cursor: pointer;
  border-radius: 2px;
  padding: 2px;
  transition: color 0.15s, background 0.15s;
}
.tab-btn-confirm:hover {
  color: #fff;
  background: var(--clara-primary);
}

/* ── Context menu ──────────────────────────────────── */
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
.ctx-item:hover {
  background: #f5f7fa;
}
.ctx-item-danger {
  color: #f56c6c;
}
.ctx-item-danger:hover {
  background: rgba(245, 108, 108, 0.08);
}

.tab-edit-input {
  font: inherit;
  font-size: 13px;
  width: 90px;
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--clara-primary);
  border-radius: 3px;
  outline: none;
  background: #fff;
  color: #303133;
}
</style>
