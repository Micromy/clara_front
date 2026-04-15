<script setup>
import { ref, computed } from 'vue'
import {
  useBuilderStore,
  DERIVED_OPS, FORMULA_TYPES, UNARY_FNS, GROUP_BY_OPTIONS,
  formulaDesc
} from '../../stores/builderStore.js'
import { useRouter } from 'vue-router'

const store = useBuilderStore()
const router = useRouter()

const derivedFields = computed(() => store.derivedFields)
const defaultField = computed(() => derivedFields.value[0]?.value ?? 'pdpAvg')

// Derived metric dialog state
const dialogVisible = ref(false)
const dfName  = ref('')
const dfType  = ref('binary')
const dfField1 = ref('')
const dfOp    = ref('/')
const dfField2 = ref('')
const dfField = ref('')        // for unary / stat-based
const dfFn    = ref('log10')   // for unary
const dfGroupBy = ref('alias') // for mean/std

const isBinary  = computed(() => dfType.value === 'binary')
const isUnary   = computed(() => dfType.value === 'unary')
const isGroup   = computed(() => dfType.value === 'mean' || dfType.value === 'std')
const isStat    = computed(() => !isBinary.value && !isUnary.value && !isGroup.value)

const CHART_TYPES = [
  { value: 'scatter', label: 'Scatter' },
  { value: 'line',    label: 'Line' },
  { value: 'bar',     label: 'Bar' }
]

const formulaPreview = computed(() => {
  const fl = v => derivedFields.value.find(f => f.value === v)?.label ?? v
  const ol = v => DERIVED_OPS.find(o => o.value === v)?.label ?? v
  const fnl = v => UNARY_FNS.find(f => f.value === v)?.label ?? v
  const gl = v => GROUP_BY_OPTIONS.find(g => g.value === v)?.label ?? v
  switch (dfType.value) {
    case 'binary':     return `${fl(dfField1.value)} ${ol(dfOp.value)} ${fl(dfField2.value)}`
    case 'unary':      return `${fnl(dfFn.value)} of ${fl(dfField.value)}`
    case 'normalize':  return `(${fl(dfField.value)} − μ) / σ`
    case 'relative':   return `${fl(dfField.value)} / μ`
    case 'delta_mean': return `${fl(dfField.value)} − μ`
    case 'pct_max':    return `${fl(dfField.value)} / max × 100`
    case 'mean':       return `μ of ${fl(dfField.value)} (by ${gl(dfGroupBy.value)})`
    case 'std':        return `σ of ${fl(dfField.value)} (by ${gl(dfGroupBy.value)})`
    default: return ''
  }
})

function openDerivedDialog() {
  const fields = derivedFields.value
  const first = fields[0]?.value ?? defaultField.value
  const second = fields[1]?.value ?? first
  dfName.value = ''
  dfType.value = 'binary'
  dfField1.value = first
  dfOp.value = '/'
  dfField2.value = second
  dfField.value = first
  dfFn.value = 'log10'
  dfGroupBy.value = 'alias'
  dialogVisible.value = true
}

function addDerived() {
  if (!dfName.value.trim()) return
  const base = { name: dfName.value.trim(), type: dfType.value }
  if (isBinary.value) {
    store.addDerivedFormula({ ...base, field1: dfField1.value, op: dfOp.value, field2: dfField2.value })
  } else if (isUnary.value) {
    store.addDerivedFormula({ ...base, field: dfField.value, fn: dfFn.value })
  } else if (isGroup.value) {
    store.addDerivedFormula({ ...base, field: dfField.value, groupBy: dfGroupBy.value })
  } else {
    store.addDerivedFormula({ ...base, field: dfField.value })
  }
  dialogVisible.value = false
}

function onGenerate() {
  const chart = store.generateChart()
  if (chart) router.push(`/chart/${chart.builderId}`)
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
          <el-option v-for="opt in store.chartOptions.chartTypes" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </el-form-item>

      <el-form-item label="X-Axis Attribute">
        <el-select
          :model-value="store.activeBuilder.chartConfig.xAxis"
          @update:model-value="val => store.updateChartConfig('xAxis', val)"
          style="width: 100%"
        >
          <el-option v-for="opt in store.chartOptions.xAxisOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </el-form-item>

      <el-form-item label="First Y-Axis (required)">
        <el-select
          :model-value="store.activeBuilder.chartConfig.yAxisPrimary"
          @update:model-value="val => store.updateChartConfig('yAxisPrimary', val)"
          style="width: 100%"
        >
          <el-option v-for="opt in store.augmentedYAxisOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
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
          <el-option v-for="opt in store.augmentedYAxisOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </el-form-item>

      <el-form-item v-if="store.activeBuilder.chartConfig.yAxisSecondary" label="Secondary Y-Axis Chart Type">
        <el-select
          :model-value="store.activeBuilder.chartConfig.chartTypeSecondary"
          @update:model-value="val => store.updateChartConfig('chartTypeSecondary', val || null)"
          style="width: 100%"
          clearable
          placeholder="Same as primary"
        >
          <el-option v-for="opt in CHART_TYPES" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </el-form-item>

      <el-form-item label="Grouping / Legend">
        <el-select
          :model-value="store.activeBuilder.chartConfig.grouping"
          @update:model-value="val => store.updateChartConfig('grouping', val)"
          style="width: 100%"
        >
          <el-option v-for="opt in store.chartOptions.groupingOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </el-form-item>

      <!-- Derived Metrics -->
      <el-form-item label="Derived Metrics">
        <div class="derived-list">
          <div v-for="df in store.activeBuilder.derivedFormulas" :key="df.id" class="derived-item">
            <span class="derived-name">{{ df.name }}</span>
            <span class="derived-formula">{{ formulaDesc(df, derivedFields) }}</span>
            <el-button type="danger" link size="small" @click="store.removeDerivedFormula(df.id)">✕</el-button>
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
        >Generate Chart</el-button>
      </el-form-item>
      <el-form-item>
        <el-button class="action-btn">Save Preset</el-button>
      </el-form-item>
    </el-form>

    <!-- Derived Metric Dialog -->
    <el-dialog v-model="dialogVisible" title="Add Derived Metric" width="520px" :close-on-click-modal="false">
      <el-form label-position="top" size="small">
        <el-form-item label="Name">
          <el-input v-model="dfName" placeholder="e.g. Efficiency" style="width:100%" />
        </el-form-item>

        <el-form-item label="Formula Type">
          <el-select v-model="dfType" style="width:100%">
            <el-option
              v-for="t in FORMULA_TYPES"
              :key="t.value"
              :value="t.value"
            >
              <span>{{ t.label }}</span>
              <span style="color:#909399;font-size:11px;margin-left:8px">{{ t.desc }}</span>
            </el-option>
          </el-select>
        </el-form-item>

        <!-- Binary: Field1 op Field2 -->
        <el-form-item v-if="isBinary" label="Formula">
          <div class="formula-row">
            <el-select v-model="dfField1" style="flex:1">
              <el-option v-for="f in derivedFields" :key="f.value" :label="f.label" :value="f.value" />
            </el-select>
            <el-select v-model="dfOp" style="width:56px">
              <el-option v-for="o in DERIVED_OPS" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <el-select v-model="dfField2" style="flex:1">
              <el-option v-for="f in derivedFields" :key="f.value" :label="f.label" :value="f.value" />
            </el-select>
          </div>
        </el-form-item>

        <!-- Unary: fn(field) -->
        <template v-else-if="isUnary">
          <el-form-item label="Function">
            <el-select v-model="dfFn" style="width:100%">
              <el-option v-for="f in UNARY_FNS" :key="f.value" :label="f.label" :value="f.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="Field">
            <el-select v-model="dfField" style="width:100%">
              <el-option v-for="f in derivedFields" :key="f.value" :label="f.label" :value="f.value" />
            </el-select>
          </el-form-item>
        </template>

        <!-- Group-based: field + groupBy -->
        <template v-else-if="isGroup">
          <el-form-item label="Field">
            <el-select v-model="dfField" style="width:100%">
              <el-option v-for="f in derivedFields" :key="f.value" :label="f.label" :value="f.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="Group By">
            <el-select v-model="dfGroupBy" style="width:100%">
              <el-option v-for="g in GROUP_BY_OPTIONS" :key="g.value" :label="g.label" :value="g.value" />
            </el-select>
          </el-form-item>
        </template>

        <!-- Stat-based: single field -->
        <el-form-item v-else label="Field">
          <el-select v-model="dfField" style="width:100%">
            <el-option v-for="f in derivedFields" :key="f.value" :label="f.label" :value="f.value" />
          </el-select>
        </el-form-item>

        <!-- Formula preview -->
        <el-form-item label="Preview">
          <div class="formula-preview">{{ formulaPreview }}</div>
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
.chart-config-panel { display: flex; flex-direction: column; }
.panel-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #303133; }
.action-btn { width: 100%; }
.chart-config-panel :deep(.el-form-item__content) { width: 100%; }

.derived-list { display: flex; flex-direction: column; gap: 6px; width: 100%; overflow: hidden; }
.derived-item { display: flex; align-items: center; gap: 8px; background: #f5f7fa; border-radius: 4px; padding: 4px 8px; min-width: 0; overflow: hidden; }
.derived-name { font-weight: 600; font-size: 12px; white-space: nowrap; flex-shrink: 0; }
.derived-formula { flex: 1; font-size: 11px; color: #909399; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }

.formula-row { display: flex; gap: 6px; align-items: center; width: 100%; }
.formula-preview {
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 6px 10px;
  font-family: monospace;
  font-size: 13px;
  color: #303133;
  width: 100%;
}
</style>
