<script setup>
import CellSearchTable from './CellSearchTable.vue'
</script>

<template>
  <div class="popup-shell">
    <CellSearchTable :show-expand-button="false" in-popup />
  </div>
</template>

<style scoped>
.popup-shell {
  padding: 16px;
  height: 100vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: #fff;
}
/* Force native scrollbar in popup — Element Plus el-scrollbar thumb drag
   doesn't work across window boundaries (document context mismatch). */
.popup-shell :deep(.el-scrollbar__bar) {
  display: none;
}
.popup-shell :deep(.el-scrollbar__wrap) {
  overflow: auto !important;
}
</style>
