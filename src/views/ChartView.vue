<script setup>
import { computed, ref } from 'vue'
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

// false: chart:table = 7:3 (default, chart-dominant)
// true:  chart:table = 3:7 (table-dominant)
const tableExpanded = ref(false)

function toggleSplit() {
  tableExpanded.value = !tableExpanded.value
}
</script>

<template>
  <div class="chart-view" :class="{ expanded: tableExpanded }" v-if="chartTab">
    <div class="chart-left">
      <ChartDisplay :chart-data="chartTab" />
    </div>
    <div
      class="chart-splitter"
      :title="tableExpanded ? 'Expand chart' : 'Expand table'"
      @click="toggleSplit"
    >
      <span class="splitter-handle">{{ tableExpanded ? '‹' : '›' }}</span>
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
  gap: 0;
  height: 100%;
}

.chart-left {
  flex: 7 1 0;
  min-width: 0;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  min-height: 500px;
  transition: flex-grow 0.25s ease;
}

.chart-right {
  flex: 3 1 0;
  min-width: 0;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: auto;
  transition: flex-grow 0.25s ease;
}

.chart-view.expanded .chart-left {
  flex-grow: 3;
}

.chart-view.expanded .chart-right {
  flex-grow: 7;
}

.chart-splitter {
  width: 14px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: transparent;
  transition: background 0.15s;
  user-select: none;
}

.chart-splitter:hover {
  background: #e4e7ed;
}

.splitter-handle {
  font-size: 16px;
  color: #909399;
  line-height: 1;
}

.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
