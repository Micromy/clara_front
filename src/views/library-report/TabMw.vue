<script setup>
import { inject, computed } from 'vue'
import { PDKS, HEIGHTS, MW_TYPES, mwTable } from './data.js'

const { state, actions, family } = inject('report')
const fam = computed(() => family())
const libOptions = computed(() => fam.value.libraries.map(l => l.library))
const allCollapsed = computed(() => state.mwSets.every(s => !s.open))
const mwTableCount = computed(() => state.mwSets.reduce((a, s) => a + s.tables.length, 0))

function tableData(t) { return mwTable(t.pdkId, t.lib, t.height, t.mwType) }
</script>

<template>
  <div class="tab-mw">
    <div class="mw-head">
      <span class="title">MW</span>
      <span class="sub mono">{{ state.mwSets.length }} sets · {{ mwTableCount }} tables · {{ fam.libraries.length }} libraries · Cell × CK slope / voltage</span>
      <div class="spacer"></div>
      <button class="btn" @click="actions.mwToggleAll()">{{ allCollapsed ? '모두 펼치기' : '모두 접기' }}</button>
      <button class="btn-primary" @click="actions.mwAddSet()">+ 비교 셋 추가</button>
    </div>

    <div v-for="set in state.mwSets" :key="set.id" class="mw-set">
      <div class="set-bar">
        <span class="caret" @click="set.open = !set.open">{{ set.open ? '▾' : '▸' }}</span>
        <span class="mono strong">Set #{{ set.id }}</span>
        <span class="sub mono">{{ set.tables.length }} tables</span>
        <div class="spacer"></div>
        <button class="btn" @click="actions.duplicateSet(set)">복제</button>
        <button class="btn danger" @click="actions.removeSet(set.id)">삭제</button>
      </div>

      <div v-if="set.open" class="set-body">
        <div v-for="t in set.tables" :key="t.id" class="mw-table-block">
          <div class="table-bar">
            <span class="mono strong">{{ t.lib }}</span>
            <span class="mono sub">{{ t.height }} · {{ t.mwType }}</span>
            <div class="spacer"></div>
            <button class="btn" @click="actions.exportCsv(t, tableData(t))">CSV</button>
            <button v-if="set.tables.length > 1" class="btn danger" @click="actions.removeTable(set.id, t.id)">삭제</button>
          </div>
          <div class="mw-grid-wrap">
            <div class="mw-grid head" :style="{ gridTemplateColumns: `120px repeat(${tableData(t).subCols.length}, minmax(56px,1fr))` }">
              <span></span>
              <span v-for="g in tableData(t).groups" :key="g.slope" class="mono" :style="{ gridColumn: `span ${g.volts.length}` }">{{ g.slope }}</span>
            </div>
            <div class="mw-grid sub-head" :style="{ gridTemplateColumns: `120px repeat(${tableData(t).subCols.length}, minmax(56px,1fr))` }">
              <span></span>
              <span v-for="c in tableData(t).subCols" :key="c.label" class="mono sub">{{ c.label }}</span>
            </div>
            <div v-for="r in tableData(t).rows" :key="r.cell" class="mw-grid row-line" :style="{ gridTemplateColumns: `120px repeat(${tableData(t).subCols.length}, minmax(56px,1fr))` }">
              <span class="mono strong">{{ r.cell }}</span>
              <span v-for="(v, i) in r.values" :key="i" class="mono" :style="{ color: v.over ? '#b4451f' : '#1c1f24', fontWeight: v.over ? 600 : 400 }">{{ v.v }}</span>
            </div>
          </div>
        </div>

        <div v-if="state.picking === set.id" class="picker">
          <label><span class="sub">PDK</span><select v-model="state.pickPdk"><option v-for="pp in PDKS" :key="pp.id" :value="pp.id">{{ pp.process }}</option></select></label>
          <label><span class="sub">LIB</span><select v-model="state.pickLib"><option v-for="l in libOptions" :key="l" :value="l">{{ l }}</option></select></label>
          <label><span class="sub">HEIGHT</span><select v-model="state.pickHeight"><option v-for="h in HEIGHTS" :key="h" :value="h">{{ h }}</option></select></label>
          <label><span class="sub">MW TYPE</span><select v-model="state.pickMwType"><option v-for="m in MW_TYPES" :key="m" :value="m">{{ m }}</option></select></label>
          <button class="btn-primary" @click="actions.confirmAdd(set.id)">추가</button>
          <button class="btn" @click="actions.cancelPick()">취소</button>
        </div>
        <button v-else class="add-table-btn" @click="actions.openPicker(set)">+ 테이블 추가</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-mw { display:flex; flex-direction:column; }
.mono { font-family:'Roboto Mono',monospace; }
.strong { font-weight:500; }
.sub { font-size:10.5px; color:#8a929c; }
.spacer { flex:1; }
.title { font-size:13px; font-weight:500; color:#1c1f24; }
.mw-head { display:flex; align-items:center; gap:8px; padding:8px 12px; border-bottom:1px solid #eef0f3; flex-wrap:wrap; }
.btn { height:26px; padding:0 10px; border:1px solid #e2e5ea; border-radius:4px; background:#fff; font:inherit; font-size:11px; color:#6b7480; cursor:pointer; }
.btn.danger { color:#b4451f; }
.btn-primary { height:26px; padding:0 10px; border:0; border-radius:4px; background:#2f6fed; font:inherit; font-size:11px; font-weight:500; color:#fff; cursor:pointer; }
.mw-set { border-bottom:1px solid #eef0f3; }
.set-bar { display:flex; align-items:center; gap:8px; padding:7px 12px; background:#fbfbfc; border-bottom:1px solid #f4f5f7; flex-wrap:wrap; }
.caret { cursor:pointer; width:14px; color:#8a929c; }
.set-body { display:flex; flex-direction:column; gap:10px; padding:10px 12px; }
.mw-table-block { border:1px solid #eef0f3; border-radius:6px; overflow:hidden; }
.table-bar { display:flex; align-items:center; gap:8px; padding:6px 10px; background:#f7f8fa; border-bottom:1px solid #eef0f3; flex-wrap:wrap; }
.mw-grid-wrap { overflow-x:auto; }
.mw-grid { display:grid; }
.mw-grid.head span, .mw-grid.sub-head span { padding:4px 8px; font-size:10px; text-align:center; }
.mw-grid.row-line { border-bottom:1px solid #f4f5f7; }
.mw-grid.row-line span { padding:4px 8px; font-size:11px; text-align:center; }
.picker { display:flex; align-items:center; gap:10px; padding:8px; border:1px dashed #d5d9de; border-radius:6px; flex-wrap:wrap; }
.picker select { border:1px solid #e2e5ea; border-radius:4px; height:24px; font:inherit; font-size:11px; }
.add-table-btn { align-self:flex-start; height:26px; padding:0 10px; border:1px dashed #d5d9de; border-radius:4px; background:#fff; font:inherit; font-size:11px; color:#8a929c; cursor:pointer; }
</style>
