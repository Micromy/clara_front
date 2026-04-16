<script setup>
import { ref, computed, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
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

function handleTabRemove(name) {
  if (name.startsWith('builder-')) {
    removeBuilderTab(name.replace('builder-', ''))
  } else if (name.startsWith('chart-')) {
    removeChartTab(name.replace('chart-', ''))
  }
}
</script>

<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="header-logo">
        <span class="logo-icon">◈</span>
        <h1>ARIAS</h1>
      </div>
    </header>

    <div class="tab-bar">
      <el-tabs
        :model-value="activeTab"
        type="card"
        @tab-click="handleTabClick"
        @tab-remove="handleTabRemove"
      >
        <el-tab-pane
          v-for="builder in store.builders"
          :key="`builder-${builder.id}`"
          :name="`builder-${builder.id}`"
          :closable="store.builders.length > 1"
        >
          <template #label>
            <input
              v-if="editingTab === `builder-${builder.id}`"
              ref="editInput"
              v-model="editingValue"
              class="tab-edit-input"
              @keyup.enter="commitEdit(`builder-${builder.id}`)"
              @blur="commitEdit(`builder-${builder.id}`)"
              @click.stop
              @keydown.stop
            />
            <span v-else @dblclick.stop="startEdit(`builder-${builder.id}`, builder.name)">{{ builder.name }}</span>
          </template>
        </el-tab-pane>
        <el-tab-pane
          v-for="chart in store.chartTabs"
          :key="`chart-${chart.builderId}`"
          :name="`chart-${chart.builderId}`"
          closable
        >
          <template #label>
            <input
              v-if="editingTab === `chart-${chart.builderId}`"
              ref="editInput"
              v-model="editingValue"
              class="tab-edit-input"
              @keyup.enter="commitEdit(`chart-${chart.builderId}`)"
              @blur="commitEdit(`chart-${chart.builderId}`)"
              @click.stop
              @keydown.stop
            />
            <span v-else @dblclick.stop="startEdit(`chart-${chart.builderId}`, chart.builderName)">Chart: {{ chart.builderName }}</span>
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
  padding: 0 12px;
  flex-shrink: 0;
}

.tab-bar :deep(.el-tabs) {
  flex: 1;
}

.tab-bar :deep(.el-tabs__header) {
  margin: 0;
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

.tab-edit-input {
  font: inherit;
  font-size: 12.5px;
  width: 140px;
  padding: 2px 6px;
  border: 1px solid #409eff;
  border-radius: 3px;
  outline: none;
  background: #fff;
  color: #303133;
}
</style>
