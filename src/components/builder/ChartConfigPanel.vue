<script setup>
import { useBuilderStore } from '../../stores/builderStore.js'
import { useRouter } from 'vue-router'
import {
  CHART_TYPE_OPTIONS,
  X_AXIS_OPTIONS,
  Y_AXIS_OPTIONS,
  GROUPING_OPTIONS
} from '../../mock/cellData.js'

const store = useBuilderStore()
const router = useRouter()

function onGenerate() {
  const chart = store.generateChart()
  if (chart) {
    router.push(`/chart/${chart.builderId}`)
  }
}
</script>

<template>
  <div class="chart-config-panel" v-if="store.activeBuilder">
    <h3 class="panel-title">Chart Configuration</h3>

    <el-form label-position="top" size="small">
      <el-form-item label="Builder Name">
        <el-input v-model="store.activeBuilder.name" />
      </el-form-item>

      <el-form-item label="Chart Type">
        <el-select
          :model-value="store.activeBuilder.chartConfig.chartType"
          @update:model-value="val => store.updateChartConfig('chartType', val)"
          style="width: 100%"
        >
          <el-option
            v-for="opt in CHART_TYPE_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="X-Axis Attribute">
        <el-select
          :model-value="store.activeBuilder.chartConfig.xAxis"
          @update:model-value="val => store.updateChartConfig('xAxis', val)"
          style="width: 100%"
        >
          <el-option
            v-for="opt in X_AXIS_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="First Y-Axis (required)">
        <el-select
          :model-value="store.activeBuilder.chartConfig.yAxisPrimary"
          @update:model-value="val => store.updateChartConfig('yAxisPrimary', val)"
          style="width: 100%"
        >
          <el-option
            v-for="opt in Y_AXIS_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="Secondary Y-Axis (optional)">
        <el-select
          :model-value="store.activeBuilder.chartConfig.yAxisSecondary"
          @update:model-value="val => store.updateChartConfig('yAxisSecondary', val)"
          style="width: 100%"
          clearable
          placeholder="None"
        >
          <el-option
            v-for="opt in Y_AXIS_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="Grouping / Legend">
        <el-select
          :model-value="store.activeBuilder.chartConfig.grouping"
          @update:model-value="val => store.updateChartConfig('grouping', val)"
          style="width: 100%"
        >
          <el-option
            v-for="opt in GROUPING_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item>
        <el-button type="text" size="small">+ Add Derived Metric</el-button>
      </el-form-item>

      <el-form-item>
        <el-button
          type="primary"
          class="action-btn"
          :disabled="store.selectedCells.length === 0"
          @click="onGenerate"
        >
          Generate Chart
        </el-button>
      </el-form-item>
      <el-form-item>
        <el-button class="action-btn">
          Save Preset
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.chart-config-panel {
  display: flex;
  flex-direction: column;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #303133;
}

.action-btn {
  width: 100%;
}

.chart-config-panel :deep(.el-form-item__content) {
  width: 100%;
}
</style>
