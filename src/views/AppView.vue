<script setup>
import { useBuilderStore } from '../stores/builderStore.js'
import BuilderView from './BuilderView.vue'
import ChartView from './ChartView.vue'

const store = useBuilderStore()
</script>

<template>
  <ChartView v-if="store.activeSubTab === 'chart'" />
  <BuilderView v-else />
</template>
