<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useBuilderStore } from '../stores/builderStore.js'
import ChartDisplay from '../components/chart/ChartDisplay.vue'
import SourceDataTable from '../components/chart/SourceDataTable.vue'

const route = useRoute()
const store = useBuilderStore()

const chartTab = computed(() => {
  const builderId = Number(route.params.builderId)
  return store.chartTabs.find(t => t.builderId === builderId)
})
</script>

<template>
  <div class="chart-view" v-if="chartTab">
    <div class="chart-left">
      <ChartDisplay :chart-data="chartTab" />
    </div>
    <div class="chart-right">
      <SourceDataTable :chart-data="chartTab" />
    </div>
  </div>
  <div v-else class="chart-empty">
    <el-empty description="No chart data. Go to a Builder tab and click 'Generate Chart'." />
  </div>
</template>

<style scoped>
.chart-view {
  display: flex;
  gap: 16px;
  height: 100%;
}

.chart-left {
  flex: 1;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  min-height: 500px;
}

.chart-right {
  width: 400px;
  flex-shrink: 0;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: auto;
}

.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
