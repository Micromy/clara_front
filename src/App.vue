<script setup>
import PlatformShell from './layouts/PlatformShell.vue'
</script>

<template>
  <div class="app-root">
    <PlatformShell />
    <router-view />
  </div>
</template>

<style scoped>
.app-root {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.app-root > :not(header) {
  flex: 1;
  min-height: 0;
}
</style>
