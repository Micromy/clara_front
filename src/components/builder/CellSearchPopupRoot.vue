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
   doesn't work across window boundaries because document.addEventListener
   binds to the main window, not the popup. Override all three layers: */
.popup-shell :deep(.el-table .el-scrollbar) {
  overflow: visible !important;
}
.popup-shell :deep(.el-table .el-scrollbar__wrap) {
  overflow: auto !important;
  margin: 0 !important;
}
.popup-shell :deep(.el-table .el-scrollbar__bar) {
  opacity: 0 !important;
  pointer-events: none !important;
}
</style>
