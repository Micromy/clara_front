<script setup>
import { ref, computed } from 'vue'
import { PDKS, LIBS, HEIGHTS, MW_TYPES, findPdk, mwTable } from './data.js'

const props = defineProps({
  pdkId: { type: String, required: true },
  lib: { type: String, required: true },
})

// A "비교 셋" is a horizontal row of tables; sets stack vertically.
// The first table in a set is BASE and can't be removed.
let nextSetId = 2
let nextTableId = 2
const sets = ref([
  { id: 1, label: '', open: true, tables: [{ id: 1, pdkId: props.pdkId, lib: props.lib, height: HEIGHTS[0], mwType: MW_TYPES[0] }] },
])

const tableCount = computed(() => sets.value.reduce((a, s) => a + s.tables.length, 0))
const allCollapsed = computed(() => sets.value.every(s => !s.open))

function toggleAll() {
  const open = allCollapsed.value
  sets.value.forEach(s => { s.open = open })
}

function addSet() {
  picking.value = null
  sets.value.push({
    id: nextSetId++,
    label: '',
    open: true,
    tables: [{ id: nextTableId++, pdkId: props.pdkId, lib: props.lib, height: HEIGHTS[0], mwType: MW_TYPES[0] }],
  })
}

function duplicateSet(set) {
  sets.value.push({
    ...set,
    id: nextSetId++,
    tables: set.tables.map(t => ({ ...t, id: nextTableId++ })),
  })
}

function removeSet(set) {
  sets.value = sets.value.filter(s => s.id !== set.id)
}

function removeTable(set, table) {
  if (set.tables.length > 1) set.tables = set.tables.filter(t => t.id !== table.id)
}

// ── "테이블 추가" popover, opened in place at the end of a set ──
const picking = ref(null)
const pickPdk = ref(PDKS[0].id)
const pickLib = ref(LIBS[0])
const pickHeight = ref(HEIGHTS[0])
const pickMwType = ref(MW_TYPES[0])

function openPicker(set) {
  const last = set.tables.length ? set.tables[set.tables.length - 1] : null
  picking.value = set.id
  pickPdk.value = props.pdkId
  pickLib.value = LIBS[(LIBS.indexOf(last ? last.lib : props.lib) + 1) % LIBS.length]
  pickHeight.value = last ? last.height : HEIGHTS[0]
  pickMwType.value = last ? last.mwType : MW_TYPES[0]
}

function confirmAdd(set) {
  set.tables.push({
    id: nextTableId++,
    pdkId: pickPdk.value,
    lib: pickLib.value,
    height: pickHeight.value,
    mwType: pickMwType.value,
  })
  set.open = true
  picking.value = null
}

function tableData(t) {
  return mwTable(t.pdkId, t.lib, t.height, t.mwType)
}

function gridCols(data) {
  return `112px repeat(${data.subCols.length}, 62px)`
}

function exportCsv(t, data) {
  const rows = [
    ['cell', ...data.subCols.map(c => c.label)],
    ...data.rows.map(r => [r.cell, ...r.values.map(v => v.v)]),
  ]
  const blob = new Blob(['﻿' + rows.map(r => r.join(',')).join('\n')], {
    type: 'text/csv;charset=utf-8',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `mw_${t.lib}_${findPdk(t.pdkId).process}_${t.height}_${t.mwType}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <div>
    <div class="lr-bar">
      <span class="lr-section-title">MW</span>
      <span class="lr-subtitle">
        {{ sets.length }} sets · {{ tableCount }} tables · Cell × CK slope / voltage
      </span>
      <div class="lr-spacer"></div>
      <button class="lr-btn" type="button" @click="toggleAll">
        {{ allCollapsed ? '모두 펼치기' : '모두 접기' }}
      </button>
    </div>

    <div v-for="(set, si) in sets" :key="set.id" class="mw-set">
      <div class="mw-set-head">
        <span class="mw-caret" @click="set.open = !set.open">{{ set.open ? '▾' : '▸' }}</span>
        <input v-model="set.label" class="mw-set-name" :placeholder="`Set ${si + 1}`" />
        <div class="lr-spacer"></div>
        <span class="lr-subtitle">{{ set.tables.length }} tables</span>
        <span class="mw-icon" title="복제" @click="duplicateSet(set)">⧉</span>
        <span class="mw-icon danger" title="삭제" @click="removeSet(set)">×</span>
      </div>

      <div v-if="set.open" class="mw-set-body">
        <div
          v-for="(t, ti) in set.tables"
          :key="t.id"
          class="mw-table"
          :class="{ base: ti === 0 }"
        >
          <template v-for="data in [tableData(t)]" :key="t.id">
            <!-- Each table carries its own PDK / Library — that's the axis of comparison -->
            <div class="mw-table-head">
              <span v-if="ti === 0" class="mw-badge">BASE</span>
              <select v-model="t.pdkId" class="mw-sel strong">
                <option v-for="p in PDKS" :key="p.id" :value="p.id">
                  {{ p.process }} · {{ p.hspice }}
                </option>
              </select>
              <select v-model="t.lib" class="mw-sel muted">
                <option v-for="l in LIBS" :key="l" :value="l">{{ l }}</option>
              </select>
              <select v-model="t.height" class="mw-sel muted">
                <option v-for="h in HEIGHTS" :key="h" :value="h">{{ h }}</option>
              </select>
              <select v-model="t.mwType" class="mw-sel muted">
                <option v-for="m in MW_TYPES" :key="m" :value="m">{{ m }}</option>
              </select>
              <div class="lr-spacer" style="min-width: 8px"></div>
              <span class="mw-csv" @click="exportCsv(t, data)">CSV</span>
              <span
                class="mw-icon danger"
                :class="{ disabled: set.tables.length < 2 }"
                @click="removeTable(set, t)"
              >×</span>
            </div>

            <!-- Two-level header: CK Slope groups over voltages -->
            <div class="mw-group-row">
              <div class="mw-group-pad"></div>
              <div
                v-for="g in data.groups"
                :key="g.slope"
                class="mw-group"
                :style="{ width: `${g.volts.length * 62}px` }"
              >CK {{ g.slope }}</div>
            </div>

            <div class="mw-subhead" :style="{ gridTemplateColumns: gridCols(data) }">
              <span class="mw-cell-col">CELL</span>
              <span
                v-for="(c, i) in data.subCols"
                :key="i"
                class="mw-volt"
                :class="{ edge: c.last }"
              >{{ c.label }}</span>
            </div>

            <div
              v-for="r in data.rows"
              :key="r.cell"
              class="mw-row"
              :style="{ gridTemplateColumns: gridCols(data) }"
            >
              <span class="lr-mono mw-cell-name">{{ r.cell }}</span>
              <span
                v-for="(v, i) in r.values"
                :key="i"
                class="lr-mono mw-val"
                :class="{ edge: v.last, 'lr-warn': v.over }"
              >{{ v.v }}</span>
            </div>
          </template>
        </div>

        <!-- In-place popover for adding a table -->
        <div v-if="picking === set.id" class="mw-picker">
          <span class="mw-picker-title">테이블 추가</span>
          <label class="mw-picker-field">
            <span>PDK</span>
            <select v-model="pickPdk">
              <option v-for="p in PDKS" :key="p.id" :value="p.id">
                {{ p.process }} · {{ p.hspice }}
              </option>
            </select>
          </label>
          <label class="mw-picker-field">
            <span>Library</span>
            <select v-model="pickLib">
              <option v-for="l in LIBS" :key="l" :value="l">{{ l }}</option>
            </select>
          </label>
          <label class="mw-picker-field">
            <span>Cell Height</span>
            <select v-model="pickHeight">
              <option v-for="h in HEIGHTS" :key="h" :value="h">{{ h }}</option>
            </select>
          </label>
          <label class="mw-picker-field">
            <span>MW Type</span>
            <select v-model="pickMwType">
              <option v-for="m in MW_TYPES" :key="m" :value="m">{{ m }}</option>
            </select>
          </label>
          <div class="lr-spacer"></div>
          <div class="mw-picker-actions">
            <button class="mw-add-confirm" type="button" @click="confirmAdd(set)">추가</button>
            <button class="lr-btn" type="button" @click="picking = null">취소</button>
          </div>
        </div>

        <div v-else class="mw-add-table" @click="openPicker(set)">
          <span class="mw-add-plus">+</span>
          <span class="mw-add-label">테이블<br />추가</span>
        </div>
      </div>
    </div>

    <div class="mw-add-set" @click="addSet">+ 비교 셋 추가</div>
  </div>
</template>

<style scoped>
.mw-set { border-bottom: 1px solid #eef0f3; }
.mw-set-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  background: #fbfbfc;
  border-bottom: 1px solid #f4f5f7;
  flex-wrap: wrap;
}
.mw-caret {
  font-family: var(--clara-mono);
  font-size: 11px;
  color: #8a929c;
  width: 12px;
  cursor: pointer;
}
.mw-set-name {
  height: 26px;
  width: 210px;
  padding: 0 9px;
  border: 1px solid #e2e5ea;
  border-radius: 4px;
  background: #fff;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  color: #1c1f24;
  outline: none;
}
.mw-icon {
  font-family: var(--clara-mono);
  font-size: 12px;
  color: #b6bec8;
  cursor: pointer;
  padding: 0 3px;
}
.mw-icon:hover { color: #2f6fed; }
.mw-icon.danger:hover { color: #b4451f; }
.mw-icon.disabled {
  color: #eef0f3;
  cursor: default;
}
.mw-icon.disabled:hover { color: #eef0f3; }

.mw-set-body {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  overflow-x: auto;
  align-items: flex-start;
}

.mw-table {
  flex: 0 0 auto;
  border: 1px solid #eef0f3;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}
.mw-table.base { border-color: #bcd0f7; }

.mw-table-head {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 8px 0 10px;
  background: #f7f8fa;
  border-bottom: 1px solid #e2e5ea;
}
.mw-badge {
  display: flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 9px;
  background: rgba(47, 111, 237, 0.09);
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.3px;
  color: #2f6fed;
}
.mw-sel {
  border: 0;
  background: transparent;
  font-family: var(--clara-mono);
  font-size: 11px;
  height: 24px;
  cursor: pointer;
  outline: none;
}
.mw-sel.strong {
  font-weight: 500;
  color: #1c1f24;
  max-width: 230px;
}
.mw-sel.muted { color: #6b7480; }
.mw-csv {
  font-family: var(--clara-mono);
  font-size: 10px;
  color: #8a929c;
  cursor: pointer;
  padding: 0 2px;
}
.mw-csv:hover { color: #2f6fed; }

.mw-group-row {
  display: flex;
  align-items: stretch;
  height: 24px;
  background: #f7f8fa;
  border-bottom: 1px solid #eef0f3;
}
.mw-group-pad {
  width: 112px;
  flex-shrink: 0;
  border-right: 1px solid #e2e5ea;
}
.mw-group {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid #e2e5ea;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.4px;
  color: #4a525c;
}

.mw-subhead {
  display: grid;
  align-items: center;
  height: 26px;
  background: #f7f8fa;
  border-bottom: 1px solid #e2e5ea;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #8a929c;
}
.mw-cell-col { padding-left: 10px; }
.mw-volt {
  font-family: var(--clara-mono);
  font-size: 10px;
  letter-spacing: 0;
  text-transform: none;
  text-align: right;
  padding-right: 8px;
}
.mw-volt.edge { border-right: 1px solid #e2e5ea; }

.mw-row {
  display: grid;
  align-items: center;
  height: 26px;
  border-bottom: 1px solid #f4f5f7;
}
.mw-row:last-child { border-bottom: 0; }
.mw-row:hover { background: #f7f9fb; }
.mw-cell-name {
  padding-left: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mw-val {
  text-align: right;
  padding-right: 8px;
}
.mw-val.edge { border-right: 1px solid #e2e5ea; }

.mw-add-table {
  flex: 0 0 auto;
  align-self: stretch;
  min-height: 120px;
  width: 58px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px dashed #e2e5ea;
  border-radius: 6px;
  cursor: pointer;
}
.mw-add-table:hover {
  border-color: #bcd0f7;
  background: rgba(47, 111, 237, 0.03);
}
.mw-add-plus {
  font-family: var(--clara-mono);
  font-size: 15px;
  color: #b6bec8;
}
.mw-add-label {
  font-size: 10px;
  line-height: 1.3;
  color: #a7afb9;
  text-align: center;
}

.mw-picker {
  flex: 0 0 auto;
  align-self: stretch;
  min-height: 120px;
  width: 250px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 11px;
  border: 1px solid #bcd0f7;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(20, 24, 29, 0.16);
}
.mw-picker-title {
  font-size: 11.5px;
  font-weight: 500;
  color: #1c1f24;
}
.mw-picker-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.mw-picker-field span {
  font-size: 10px;
  color: #8a929c;
}
.mw-picker-field select {
  height: 26px;
  border: 1px solid #e2e5ea;
  border-radius: 4px;
  background: #fff;
  font-family: var(--clara-mono);
  font-size: 11px;
  color: #1c1f24;
  padding: 0 4px;
  cursor: pointer;
  outline: none;
}
.mw-picker-actions {
  display: flex;
  gap: 6px;
}
.mw-add-confirm {
  flex: 1;
  height: 26px;
  border: 0;
  border-radius: 4px;
  background: #2f6fed;
  font: inherit;
  font-size: 11px;
  font-weight: 500;
  color: #fff;
  cursor: pointer;
}
.mw-add-confirm:hover { background: #0b4fbf; }

.mw-add-set {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  margin: 10px 12px 18px;
  border: 1px dashed #e2e5ea;
  border-radius: 6px;
  font-size: 11.5px;
  color: #8a929c;
  cursor: pointer;
}
.mw-add-set:hover {
  border-color: #bcd0f7;
  color: #2f6fed;
  background: rgba(47, 111, 237, 0.03);
}
</style>
