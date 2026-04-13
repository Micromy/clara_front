<script setup>
import { ref, computed } from 'vue'
import { useBuilderStore } from '../../stores/builderStore.js'

const store = useBuilderStore()

const visible = ref(false)
const csvText = ref('')
const parseError = ref('')
const previewRows = ref([])
const previewCols = ref([])

const TEMPLATE = `cellName,cellType,driveStrength,library,feolCorner,vdd,temp,vth,gateLength,cpp,iPeak,iAvg,delay
INV_X1,INV,X1,MyLib,TT,1.0,25,0.4,14,30,55.2,22.1,98.4
INV_X2,INV,X2,MyLib,TT,1.0,25,0.4,14,30,102.4,41.8,54.7
NAND2_X1,NAND2,X1,MyLib,SS,0.9,85,0.45,14,30,38.6,15.4,142.0`

function open() {
  csvText.value = ''
  parseError.value = ''
  previewRows.value = []
  previewCols.value = []
  visible.value = true
}

function parseCsv(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row')
  const headers = lines[0].split(',').map(h => h.trim())
  if (!headers.includes('cellName')) throw new Error('CSV must include a "cellName" column')
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim())
    const row = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  })
}

function onInput() {
  parseError.value = ''
  previewRows.value = []
  previewCols.value = []
  if (!csvText.value.trim()) return
  try {
    const rows = parseCsv(csvText.value)
    const keys = Object.keys(rows[0] || {})
    previewCols.value = keys
    previewRows.value = rows.slice(0, 5)
  } catch (e) {
    parseError.value = e.message
  }
}

function useTemplate() {
  csvText.value = TEMPLATE
  onInput()
}

const hasDebugCells = computed(() => store.allCells.some(c => c._debug))
const importRowCount = computed(() => {
  if (!previewRows.value.length || parseError.value) return 0
  try { return parseCsv(csvText.value).length } catch { return 0 }
})

function doImport() {
  try {
    const rows = parseCsv(csvText.value)
    store.addDebugCells(rows)
    visible.value = false
  } catch (e) {
    parseError.value = e.message
  }
}

function doClear() {
  store.clearDebugCells()
}

defineExpose({ open })
</script>

<template>
  <el-dialog
    v-model="visible"
    title="[Debug] CSV Import"
    width="680px"
    :close-on-click-modal="false"
  >
    <div class="debug-badge">DEBUG MODE — for development only</div>

    <el-alert v-if="parseError" :title="parseError" type="error" :closable="false" style="margin-bottom:12px" />

    <el-form label-position="top" size="small">
      <el-form-item>
        <template #label>
          <span>Paste CSV data</span>
          <el-button link size="small" type="primary" style="margin-left:8px" @click="useTemplate">Use template</el-button>
        </template>
        <el-input
          v-model="csvText"
          type="textarea"
          :rows="10"
          placeholder="cellName,iPeak,iAvg,delay&#10;INV_X1,55.2,22.1,98.4"
          style="font-family:monospace;font-size:12px"
          @input="onInput"
        />
      </el-form-item>
    </el-form>

    <!-- Preview table -->
    <div v-if="previewRows.length" class="preview-section">
      <div class="preview-label">Preview (first {{ previewRows.length }} rows)</div>
      <el-table :data="previewRows" border size="small" max-height="180">
        <el-table-column
          v-for="col in previewCols"
          :key="col"
          :prop="col"
          :label="col"
          min-width="90"
          show-overflow-tooltip
        />
      </el-table>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button v-if="hasDebugCells" type="danger" plain size="small" @click="doClear">
          Clear Debug Cells
        </el-button>
        <div style="flex:1" />
        <el-button @click="visible = false">Cancel</el-button>
        <el-button
          type="primary"
          :disabled="!importRowCount"
          @click="doImport"
        >Import{{ importRowCount ? ` (${importRowCount} rows)` : '' }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.debug-badge {
  display: inline-block;
  background: #fdf6ec;
  border: 1px solid #f5dab1;
  color: #e6a23c;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  margin-bottom: 12px;
  letter-spacing: 0.5px;
}

.preview-section {
  margin-top: 4px;
}

.preview-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}

.dialog-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
