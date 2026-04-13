<script setup>
import { ref } from 'vue'
import { useBuilderStore, DERIVED_FIELDS, DERIVED_OPS } from '../../stores/builderStore.js'
import { useRouter } from 'vue-router'

const store = useBuilderStore()
const router = useRouter()

// Derived metric dialog
const dialogVisible = ref(false)
const dfName   = ref('')
const dfField1 = ref('iPeak')
const dfOp     = ref('/')
const dfField2 = ref('delay')

function openDerivedDialog() {
  dfName.value = ''
  dfField1.value = 'iPeak'
  dfOp.value = '/'
  dfField2.value = 'delay'
  dialogVisible.value = true
}

function addDerived() {
  if (!dfName.value.trim()) return
  store.addDerivedFormula(dfName.value.trim(), dfField1.value, dfOp.value, dfField2.value)
  dialogVisible.value = false
}

function labelForField(val) {
  return DERIVED_FIELDS.find(f => f.value === val)?.label ?? val
}

function labelForOp(val) {
  return DERIVED_OPS.find(o => o.value === val)?.label ?? val
}

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
            v-for="opt in store.chartOptions.chartTypes"
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
            v-for="opt in store.chartOptions.xAxisOptions"
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
            v-for="opt in store.augmentedYAxisOptions"
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
            v-for="opt in store.augmentedYAxisOptions"
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
            v-for="opt in store.chartOptions.groupingOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <!-- Derived Metrics section -->
      <el-form-item label="Derived Metrics">
        <div class="derived-list">
          <div
            v-for="df in store.activeBuilder.derivedFormulas"
            :key="df.id"
            class="derived-item"
          >
            <span class="derived-name">{{ df.name }}</span>
            <span class="derived-formula">
              {{ labelForField(df.field1) }} {{ labelForOp(df.op) }} {{ labelForField(df.field2) }}
            </span>
            <el-button
              type="danger"
              link
              size="small"
              @click="store.removeDerivedFormula(df.id)"
            >✕</el-button>
          </div>
          <el-button type="primary" link size="small" @click="openDerivedDialog">
            + Add Derived Metric
          </el-button>
        </div>
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
        <el-button class="action-btn">Save Preset</el-button>
      </el-form-item>
    </el-form>

    <!-- Derived Metric Dialog -->
    <el-dialog
      v-model="dialogVisible"
      title="Add Derived Metric"
      width="380px"
      :close-on-click-modal="false"
    >
      <el-form label-position="top" size="small">
        <el-form-item label="Name">
          <el-input v-model="dfName" placeholder="e.g. Efficiency" style="width:100%" />
        </el-form-item>
        <el-form-item label="Formula">
          <div class="formula-row">
            <el-select v-model="dfField1" style="flex:1">
              <el-option
                v-for="f in DERIVED_FIELDS"
                :key="f.value"
                :label="f.label"
                :value="f.value"
              />
            </el-select>
            <el-select v-model="dfOp" style="width:60px">
              <el-option
                v-for="o in DERIVED_OPS"
                :key="o.value"
                :label="o.label"
                :value="o.value"
              />
            </el-select>
            <el-select v-model="dfField2" style="flex:1">
              <el-option
                v-for="f in DERIVED_FIELDS"
                :key="f.value"
                :label="f.label"
                :value="f.value"
              />
            </el-select>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">Cancel</el-button>
        <el-button type="primary" :disabled="!dfName.trim()" @click="addDerived">Add</el-button>
      </template>
    </el-dialog>
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

.derived-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.derived-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f5f7fa;
  border-radius: 4px;
  padding: 4px 8px;
}

.derived-name {
  font-weight: 600;
  font-size: 12px;
  min-width: 60px;
}

.derived-formula {
  flex: 1;
  font-size: 11px;
  color: #909399;
}

.formula-row {
  display: flex;
  gap: 6px;
  align-items: center;
  width: 100%;
}
</style>
