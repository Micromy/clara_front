<script setup>
import { ref, computed } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import {
  useBuilderStore,
  DERIVED_OPS, FORMULA_TYPES, UNARY_FNS, GROUP_BY_OPTIONS,
  formulaDesc
} from '../../stores/builderStore.js'
const store = useBuilderStore()
const loadDialogVisible = ref(false)
const saveDialogVisible = ref(false)
const presetNameInput = ref('')

const normalizedPresetName = computed(() => presetNameInput.value.trim().toLowerCase())
const presetNameEmpty = computed(() => !presetNameInput.value.trim())
const presetNameDuplicate = computed(() => {
  const name = normalizedPresetName.value
  if (!name) return false
  return store.chartPresets.some(p => (p.name || '').trim().toLowerCase() === name)
})

function openSavePresetDialog() {
  presetNameInput.value = ''
  saveDialogVisible.value = true
}

function onPresetNameEnter() {
  if (presetNameEmpty.value || presetNameDuplicate.value) return
  confirmSavePreset()
}

async function confirmSavePreset() {
  const name = presetNameInput.value.trim()
  if (!name || presetNameDuplicate.value) return
  try {
    await store.savePreset(name)
    saveDialogVisible.value = false
    presetNameInput.value = ''
    ElMessage.success(`Preset "${name}" saved.`)
  } catch (err) {
    const msg = String(err?.message || '')
    if (err?.code === 'DUPLICATE_PRESET_NAME' || /409|400|already exists|duplicate/i.test(msg)) {
      ElMessage.error('A preset with the same name already exists.')
      return
    }
    ElMessage.error('Failed to save preset.')
  }
}

function onLoadPreset(presetId) {
  store.loadPreset(presetId)
  loadDialogVisible.value = false
  ElMessage.success('Preset loaded.')
}

async function onDeletePreset(preset) {
  try {
    await ElMessageBox.confirm(
      `Delete preset "${preset.name}"?`,
      'Delete Preset',
      { confirmButtonText: 'Delete', cancelButtonText: 'Cancel', type: 'warning' }
    )
    store.deletePreset(preset.presetId)
    ElMessage.info('Preset deleted.')
  } catch {}
}

const derivedFields = computed(() => store.derivedFields)
const defaultField = computed(() => derivedFields.value[0]?.value ?? 'pdpAvg')

// Derived metric dialog state
const dialogVisible = ref(false)
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

const matchedDerivedMetric = computed(() => {
  const cellType = store.activeCellType
  return store.metrics.find(m => {
    if (m.cellType !== cellType) return false
    if (m.formulaType !== dfType.value) return false

    if (isBinary.value) {
      return m.field1 === dfField1.value && m.op === dfOp.value && m.field2 === dfField2.value
    }
    if (isUnary.value) {
      return m.field1 === dfField.value && m.op === dfFn.value
    }
    if (isGroup.value) {
      return m.field1 === dfField.value &&
        (m.field2 === dfGroupBy.value || m.op === dfGroupBy.value)
    }
    return m.field1 === dfField.value
  }) || null
})

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
  const type = dfType.value
  let formula
  if (isBinary.value) {
    formula = { type, field1: dfField1.value, op: dfOp.value, field2: dfField2.value }
  } else if (isUnary.value) {
    formula = { type, field: dfField.value, fn: dfFn.value }
  } else if (isGroup.value) {
    formula = { type, field: dfField.value, groupBy: dfGroupBy.value }
  } else {
    formula = { type, field: dfField.value }
  }
  const name = matchedDerivedMetric.value?.name || formulaPreview.value
  store.addDerivedFormula({ ...formula, name })
  dialogVisible.value = false
}

function onGenerate() {
  const chart = store.generateChart()
  if (chart) store.activeSubTab = 'chart'
}

// ── Series mirror (read-only view of Label template) ──
const labelTemplate = computed(() => store.activeBuilder?.labelTemplate || [])
const fieldLabelMap = computed(() => {
  const m = {}
  store.labelableFields.forEach(f => { m[f.value] = f.label })
  return m
})
const seriesTitle = computed(() => 'Color/series come from the Label template above. Click to edit.')

function tokenText(tok) {
  if (tok.type === 'field') return fieldLabelMap.value[tok.field] || tok.field
  if (tok.type === 'note') return 'Note'
  return '?'
}

function focusLabelBuilder() {
  const el = document.querySelector('.label-template-builder')
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('lt-flash')
  setTimeout(() => el.classList.remove('lt-flash'), 1200)
}
</script>

<template>
  <div class="chart-config-panel" v-if="store.activeBuilder">
    <div class="panel-header">
      <h3 class="panel-title">Chart Configuration</h3>
      <div class="preset-btns">
        <button class="preset-action-btn" @click="openSavePresetDialog">Save</button>
        <button class="preset-action-btn" @click="loadDialogVisible = true">Load</button>
      </div>
    </div>

    <!-- Save Preset Dialog -->
    <el-dialog v-model="saveDialogVisible" title="Save Preset" width="420px" :close-on-click-modal="false">
      <el-form label-position="top" size="small">
        <el-form-item label="Preset Name">
          <el-input
            v-model="presetNameInput"
            placeholder="Preset name"
            @keydown.enter.prevent="onPresetNameEnter"
          />
        </el-form-item>
        <div v-if="presetNameEmpty" class="preset-hint">Name is required.</div>
        <div v-else-if="presetNameDuplicate" class="preset-hint preset-hint-error">
          A preset with the same name already exists.
        </div>
        <div v-else class="preset-hint preset-hint-ok">Name is available.</div>
      </el-form>

      <template #footer>
        <el-button @click="saveDialogVisible = false">Cancel</el-button>
        <el-button type="primary" :disabled="presetNameEmpty || presetNameDuplicate" @click="confirmSavePreset">
          Save
        </el-button>
      </template>
    </el-dialog>

    <!-- Load Preset Dialog -->
    <el-dialog v-model="loadDialogVisible" title="Load Preset" width="850px" :close-on-click-modal="true">
      <el-table :data="store.presetsForCellType" size="small" border stripe max-height="400" empty-text="No presets saved.">
        <el-table-column prop="name" label="Name" min-width="120" show-overflow-tooltip />
        <el-table-column prop="chartType" label="Type" width="80" />
        <el-table-column prop="xAxis" label="X" width="100" show-overflow-tooltip />
        <el-table-column prop="yAxisPrimary" label="Y1" width="100" show-overflow-tooltip />
        <el-table-column prop="yAxisSecondary" label="Y2" width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.yAxisSecondary || '—' }}</template>
        </el-table-column>
        <el-table-column label="Created" width="170">
          <template #default="{ row }">{{ row.createdAt ? row.createdAt.replace('T', ' ').slice(0, 19) : '—' }}</template>
        </el-table-column>
        <el-table-column label="" width="130" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="onLoadPreset(row.presetId)">Apply</el-button>
            <el-button size="small" type="danger" link @click="onDeletePreset(row)">Delete</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-form label-position="top" size="small">
      <el-form-item label="Chart Type">
        <el-select
          :model-value="store.activeBuilder.chartConfig.chartType"
          @update:model-value="val => store.updateChartConfig('chartType', val)"
          style="width: 100%"
        >
          <el-option v-for="opt in store.chartOptions.chartTypes" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </el-form-item>

      <el-form-item label="X-Axis">
        <el-select
          :model-value="store.activeBuilder.chartConfig.xAxis"
          @update:model-value="val => store.updateChartConfig('xAxis', val)"
          style="width: 100%"
        >
          <el-option v-for="opt in store.augmentedXAxisOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </el-form-item>

      <el-form-item label="Y-Axis">
        <el-select
          :model-value="store.activeBuilder.chartConfig.yAxisPrimary"
          @update:model-value="val => store.updateChartConfig('yAxisPrimary', val)"
          style="width: 100%"
        >
          <el-option v-for="opt in store.augmentedYAxisOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </el-form-item>

      <el-form-item label="Y-Axis 2">
        <el-select
          :model-value="store.activeBuilder.chartConfig.yAxisSecondary"
          @update:model-value="val => store.updateChartConfig('yAxisSecondary', val || null)"
          style="width: 100%"
          clearable
          placeholder="None"
        >
          <el-option label="None" :value="null" />
          <el-option v-for="opt in store.augmentedYAxisOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </el-form-item>

      <el-form-item v-if="store.activeBuilder.chartConfig.yAxisSecondary" label="Y2 Chart Type">
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

      <el-form-item label="Series">
        <div class="series-mirror" :title="seriesTitle" @click="focusLabelBuilder">
          <template v-if="labelTemplate.length === 0">
            <span class="series-empty">no label — all cells in one series</span>
          </template>
          <template v-else>
            <span
              v-for="(tok, i) in labelTemplate"
              :key="i"
              class="series-chip"
              :class="{ 'series-chip-note': tok.type === 'note' }"
            >{{ tokenText(tok) }}</span>
          </template>
          <span class="series-edit-hint">edit ↑</span>
        </div>
      </el-form-item>

      <el-divider />

      <el-form-item label="Derived Metrics">
        <div class="derived-list">
          <div v-for="df in store.activeBuilder.derivedFormulas" :key="df.id" class="derived-item">
            <span class="derived-name">{{ df.name }}</span>
            <span class="derived-formula">{{ formulaDesc(df, derivedFields) }}</span>
            <el-button type="danger" link size="small" @click="store.removeDerivedFormula(df.id)">✕</el-button>
          </div>
          <el-button type="primary" link size="small" class="add-derived-btn" @click="openDerivedDialog">
            + Add Derived Metric
          </el-button>
        </div>
      </el-form-item>

      <el-form-item>
        <div class="action-row" style="margin-top: 12px">
          <el-button
            type="primary"
            size="default"
            class="action-btn-main"
            :disabled="store.selectedCells.length === 0"
            @click="onGenerate"
          >Generate Chart</el-button>
        </div>
      </el-form-item>
    </el-form>

    <!-- Derived Metric Dialog -->
    <el-dialog v-model="dialogVisible" title="Add Derived Metric" width="520px" :close-on-click-modal="false">
      <el-form label-position="top" size="small">

        <el-form-item label="Formula Type">
          <el-select v-model="dfType" style="width:100%">
            <el-option
              v-for="t in FORMULA_TYPES"
              :key="t.value"
              :label="t.label"
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

        <!-- Formula description -->
        <el-form-item label="Description">
          <div class="formula-preview">{{ formulaPreview }}</div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">Cancel</el-button>
        <el-button type="primary" @click="addDerived">Add</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.chart-config-panel { display: flex; flex-direction: column; }
.chart-config-panel :deep(.el-divider) { margin: 10px 0 10px; }
.chart-config-panel :deep(.el-form-item) { margin-bottom: 12px; }
.chart-config-panel :deep(.el-form-item__label) { padding-bottom: 0; line-height: 1.4; }
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 32px;
  margin-bottom: 12px;
}
.preset-btns {
  display: flex;
  gap: 4px;
}
.preset-action-btn {
  border: none;
  background: none;
  font-size: 12px;
  color: #909399;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.preset-action-btn:hover {
  background: rgba(0,0,0,0.04);
  color: #606266;
}
.preset-hint {
  margin-top: -4px;
  font-size: 12px;
  color: #909399;
}
.preset-hint-error {
  color: #f56c6c;
}
.preset-hint-ok {
  color: #67c23a;
}
.panel-title { font-size: 14px; font-weight: 600; color: #303133; margin: 0; }
.action-row { display: flex; gap: 4px; width: 100%; }
.action-btn-main { flex: 1; }
.chart-config-panel :deep(.el-form-item__content) { width: 100%; }

.derived-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  overflow: hidden;
  min-height: 36px;
  background: #fafafa;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  padding: 8px;
}
.derived-list:empty { display: none; }
.derived-item { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #ebeef5; border-radius: 4px; padding: 5px 8px; min-width: 0; overflow: hidden; }
.derived-name { font-weight: 600; font-size: 12px; white-space: nowrap; flex-shrink: 0; }
.derived-formula { flex: 1; font-size: 11px; color: #909399; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.add-derived-btn { align-self: flex-start; }

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

.series-mirror {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  width: 100%;
  padding: 6px 8px;
  background: #f8fafb;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.series-mirror:hover {
  border-color: var(--clara-primary, #4078C0);
  background: #fff;
}
.series-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11.5px;
  background: #fff;
  border: 1px solid #dcdfe6;
  color: #303133;
  font-weight: 500;
  line-height: 1.5;
}
.series-chip-note { font-style: italic; }
.series-empty {
  color: #909399;
  font-style: italic;
  font-size: 11.5px;
}
.series-edit-hint {
  margin-left: auto;
  color: #909399;
  font-size: 10.5px;
  letter-spacing: 0.3px;
}
.series-mirror:hover .series-edit-hint { color: var(--clara-primary, #4078C0); }
</style>
