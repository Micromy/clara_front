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
</style>
