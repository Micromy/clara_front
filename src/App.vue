<script setup>
import { onMounted } from 'vue'
import { useBuilderStore } from './stores/builderStore.js'
import AppLayout from './layouts/AppLayout.vue'

const store = useBuilderStore()

onMounted(() => {
  store.init()
})
</script>

<template>
  <div v-if="store.error" class="app-error">
    <el-result
      icon="error"
      title="Failed to load data"
      :sub-title="String(store.error.message || store.error)"
    >
      <template #extra>
        <el-button type="primary" @click="store.init()">Retry</el-button>
      </template>
    </el-result>
  </div>
  <div v-else-if="store.loading && !store.config" class="app-loading">
    <el-icon class="is-loading" size="32"><Loading /></el-icon>
    <div>Loading…</div>
  </div>
  <AppLayout v-else />
</template>

<style scoped>
.app-loading,
.app-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: #909399;
}
</style>
