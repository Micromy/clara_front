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

// false: table occupies ~30% on the right (chart-dominant view)
// true:  table slides to occupy ~70%, covering the right portion of the chart
const tableExpanded = ref(false)

function toggleSplit() {
  tableExpanded.value = !tableExpanded.value
}
</script>

<template>
  <div class="chart-view" :class="{ expanded: tableExpanded }" v-if="chartTab">
    <!-- Chart stays a fixed size; the table overlays on top of it. -->
    <div class="chart-left">
      <ChartDisplay :chart-data="chartTab" />
    </div>
    <div
      class="chart-splitter"
      :title="tableExpanded ? 'Collapse table' : 'Expand table'"
      @click="toggleSplit"
    >
      <span class="splitter-handle">{{ tableExpanded ? '›' : '‹' }}</span>
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
  position: relative;
  height: 100%;
  min-height: 500px;
  overflow: hidden;
}

/* Chart is pinned to the left and keeps a fixed width regardless of the
   table state. The table slides on top of it, so the chart itself never
   resizes — only how much of it is visible changes. */
.chart-left {
  position: absolute;
  left: 0;
  top: 0;
  width: 70%;
  height: 100%;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  z-index: 1;
}

.chart-right {
  position: absolute;
  right: 0;
  top: 0;
  width: 30%;
  height: 100%;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: -6px 0 14px rgba(0, 0, 0, 0.08);
  overflow: auto;
  transition: width 0.25s ease;
  z-index: 3;
}

.chart-view.expanded .chart-right {
  width: 70%;
}

.chart-splitter {
  position: absolute;
  top: 0;
  height: 100%;
  width: 16px;
  right: 30%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: transparent;
  transition: right 0.25s ease, background 0.15s;
  user-select: none;
  z-index: 4;
}

.chart-view.expanded .chart-splitter {
  right: 70%;
}

.chart-splitter:hover {
  background: rgba(144, 147, 153, 0.18);
}

.splitter-handle {
  font-size: 16px;
  color: #909399;
  line-height: 1;
  padding: 6px 2px;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
