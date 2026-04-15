<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useBuilderStore } from '../stores/builderStore.js'

const router = useRouter()
const route = useRoute()
const store = useBuilderStore()

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
          :label="builder.name"
          :name="`builder-${builder.id}`"
          :closable="store.builders.length > 1"
        />
        <el-tab-pane
          v-for="chart in store.chartTabs"
          :key="`chart-${chart.builderId}`"
          :label="`Chart: ${chart.builderName}`"
          :name="`chart-${chart.builderId}`"
          closable
        />
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
</style>
