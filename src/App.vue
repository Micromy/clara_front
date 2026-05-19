<script setup>
import { computed, onMounted } from 'vue'
import { useBuilderStore } from './stores/builderStore.js'
import AppLayout from './layouts/AppLayout.vue'

const store = useBuilderStore()

onMounted(() => {
  // store.init() puts the failure into store.error so the UI can show
  // it; swallow the rejection here to keep the console clean.
  store.init().catch(() => {})
})

const errorTitle = computed(() => {
  const e = store.error
  if (!e) return ''
  if (e.kind === 'network') return '백엔드에 연결할 수 없습니다'
  if (e.kind === 'parse')   return '서버 응답을 해석할 수 없습니다'
  if (e.kind === 'http' && e.status === 404) return '엔드포인트를 찾을 수 없습니다 (404)'
  if (e.kind === 'http' && e.status >= 500)  return `서버 오류 (${e.status})`
  if (e.kind === 'http')   return `요청이 거부되었습니다 (${e.status})`
  return '데이터를 불러오지 못했습니다'
})

const errorDetail = computed(() => {
  const e = store.error
  if (!e) return ''
  if (e.kind === 'network') return 'API 주소나 사내망 연결을 확인하세요'
  if (e.path) return `${e.method || ''} ${e.path}`.trim()
  return String(e.message || e)
})
</script>

<template>
  <div v-if="store.error" class="app-error">
    <el-result
      icon="error"
      :title="errorTitle"
      :sub-title="errorDetail"
    >
      <template #extra>
        <el-button type="primary" @click="store.init()">Retry</el-button>
      </template>
    </el-result>
  </div>
  <div v-else-if="store.loading && !store.config" class="app-loading">
    <el-icon class="is-loading" size="32"><Loading /></el-icon>
    <div>Loading CLARA…</div>
  </div>
  <div v-else-if="store.restoringSessionState" class="app-loading">
    <el-icon class="is-loading" size="32"><Loading /></el-icon>
    <div>Restoring previous session…</div>
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
