<script setup>
import { inject, computed } from 'vue'
import { PDKS, HEIGHTS, MW_TYPES, mwTable } from './data.js'

const { state, actions, family, locked } = inject('report')
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
      <button class="btn-primary" :disabled="locked" @click="actions.mwAddSet()">+ 비교 셋 추가</button>
    </div>

    <div v-for="set in state.mwSets" :key="set.id" class="mw-set">
      <div class="set-bar">
        <span class="caret" @click="set.open = !set.open">{{ set.open ? '▾' : '▸' }}</span>
        <span class="mono strong">Set #{{ set.id }}</span>
        <span class="sub mono">{{ set.tables.length }} tables</span>
        <div class="spacer"></div>
        <button class="btn" :disabled="locked" @click="actions.duplicateSet(set)">복제</button>
        <button class="btn danger" :disabled="locked" @click="actions.removeSet(set.id)">삭제</button>
      </div>

      <!-- 이전(포팅 전) 레이아웃 복원: 테이블은 셋 안에서 가로로 나란히,
           "테이블 추가"는 그 줄 맨 끝에 인라인 박스로 붙는다. 여백을 넓히던
           minmax(...,1fr) 열 폭도 고정 62px로 되돌려 한눈에 들어오게 한다. -->
      <div v-if="set.open" class="set-body">
        <div v-for="(t, ti) in set.tables" :key="t.id" class="mw-table-block" :class="{ base: ti === 0 }">
          <div class="table-bar">
            <span v-if="ti === 0" class="mw-badge">BASE</span>
            <span class="mono strong">{{ t.lib }}</span>
            <span class="mono sub">{{ t.height }} · {{ t.mwType }}</span>
            <div class="spacer" style="min-width: 6px"></div>
            <button class="csv-link" @click="actions.exportCsv(t, tableData(t))">CSV</button>
            <button v-if="set.tables.length > 1" class="icon-btn danger" :disabled="locked" @click="actions.removeTable(set.id, t.id)">×</button>
          </div>
          <div class="mw-group-row">
            <div class="mw-group-pad"></div>
            <div v-for="g in tableData(t).groups" :key="g.slope" class="mw-group" :style="{ width: `${g.volts.length * 62}px` }">CK {{ g.slope }}</div>
          </div>
          <div class="mw-grid sub-head" :style="{ gridTemplateColumns: `112px repeat(${tableData(t).subCols.length}, 62px)` }">
            <span></span>
            <span v-for="c in tableData(t).subCols" :key="c.label" class="mono sub" :class="{ edge: c.last }">{{ c.label }}</span>
          </div>
          <div v-for="r in tableData(t).rows" :key="r.cell" class="mw-grid row-line" :style="{ gridTemplateColumns: `112px repeat(${tableData(t).subCols.length}, 62px)` }">
            <span class="mono strong cell-name">{{ r.cell }}</span>
            <span v-for="(v, i) in r.values" :key="i" class="mono" :class="{ edge: v.last }" :style="{ color: v.over ? '#b4451f' : '#1c1f24', fontWeight: v.over ? 600 : 400 }">{{ v.v }}</span>
          </div>
        </div>

        <div v-if="state.picking === set.id && !locked" class="picker">
          <span class="picker-title">테이블 추가</span>
          <label><span class="sub">PDK</span><select v-model="state.pickPdk"><option v-for="pp in PDKS" :key="pp.id" :value="pp.id">{{ pp.process }}</option></select></label>
          <label><span class="sub">LIB</span><select v-model="state.pickLib"><option v-for="l in libOptions" :key="l" :value="l">{{ l }}</option></select></label>
          <label><span class="sub">HEIGHT</span><select v-model="state.pickHeight"><option v-for="h in HEIGHTS" :key="h" :value="h">{{ h }}</option></select></label>
          <label><span class="sub">MW TYPE</span><select v-model="state.pickMwType"><option v-for="m in MW_TYPES" :key="m" :value="m">{{ m }}</option></select></label>
          <div class="spacer"></div>
          <div class="picker-actions">
            <button class="btn-primary" @click="actions.confirmAdd(set.id)">추가</button>
            <button class="btn" @click="actions.cancelPick()">취소</button>
          </div>
        </div>
        <div v-else-if="!locked" class="add-table" @click="actions.openPicker(set)">
          <span class="add-plus">+</span>
          <span class="add-label">테이블<br />추가</span>
        </div>
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
.btn:disabled, .btn.danger:disabled { background:#f7f8fa; color:#c2c9d2; cursor:not-allowed; }
.btn-primary:disabled { background:#dfe3e8; cursor:not-allowed; }
.btn-primary { height:26px; padding:0 10px; border:0; border-radius:4px; background:#2f6fed; font:inherit; font-size:11px; font-weight:500; color:#fff; cursor:pointer; }
.mw-set { border-bottom:1px solid #eef0f3; }
.set-bar { display:flex; align-items:center; gap:8px; padding:7px 12px; background:#fbfbfc; border-bottom:1px solid #f4f5f7; flex-wrap:wrap; }
.caret { cursor:pointer; width:14px; color:#8a929c; }

/* 셋 안의 테이블들은 가로로 나란히, 넘치면 가로 스크롤. */
.set-body { display:flex; flex-direction:row; gap:10px; padding:10px 12px; overflow-x:auto; align-items:flex-start; }
.mw-table-block { flex:0 0 auto; border:1px solid #eef0f3; border-radius:6px; overflow:hidden; background:#fff; }
.mw-table-block.base { border-color:#bcd0f7; }
.table-bar { display:flex; align-items:center; gap:7px; height:30px; padding:0 8px 0 10px; background:#f7f8fa; border-bottom:1px solid #e2e5ea; }
.mw-badge { display:flex; align-items:center; height:18px; padding:0 6px; border-radius:9px; background:rgba(47,111,237,0.09); font-size:9.5px; font-weight:500; letter-spacing:0.3px; color:#2f6fed; }
.csv-link { border:0; background:transparent; font:inherit; font-family:var(--clara-mono,'Roboto Mono',monospace); font-size:10px; color:#8a929c; cursor:pointer; padding:0 2px; }
.csv-link:hover { color:#2f6fed; }
.icon-btn { border:0; background:transparent; font-family:var(--clara-mono,'Roboto Mono',monospace); font-size:12px; color:#b6bec8; cursor:pointer; padding:0 3px; }
.icon-btn.danger:hover { color:#b4451f; }
.icon-btn:disabled { color:#eef0f3; cursor:not-allowed; }

.mw-group-row { display:flex; align-items:stretch; height:24px; background:#f7f8fa; border-bottom:1px solid #eef0f3; }
.mw-group-pad { width:112px; flex-shrink:0; border-right:1px solid #e2e5ea; }
.mw-group { flex-shrink:0; display:flex; align-items:center; justify-content:center; border-right:1px solid #e2e5ea; font-size:10px; font-weight:600; letter-spacing:0.4px; color:#4a525c; }

.mw-grid { display:grid; }
.mw-grid.sub-head { height:26px; align-items:center; background:#f7f8fa; border-bottom:1px solid #e2e5ea; }
.mw-grid.sub-head span { font-size:10px; font-weight:600; letter-spacing:0; text-transform:none; text-align:right; padding-right:8px; color:#8a929c; }
.mw-grid.row-line { height:26px; align-items:center; border-bottom:1px solid #f4f5f7; }
.mw-grid.row-line:last-child { border-bottom:0; }
.mw-grid.row-line:hover { background:#f7f9fb; }
.mw-grid span { text-align:right; padding-right:8px; font-size:11px; }
.mw-grid span.edge { border-right:1px solid #e2e5ea; }
.cell-name { text-align:left; padding-left:10px; padding-right:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

.add-table { flex:0 0 auto; align-self:stretch; min-height:120px; width:58px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; border:1px dashed #e2e5ea; border-radius:6px; cursor:pointer; }
.add-table:hover { border-color:#bcd0f7; background:rgba(47,111,237,0.03); }
.add-plus { font-family:var(--clara-mono,'Roboto Mono',monospace); font-size:15px; color:#b6bec8; }
.add-label { font-size:10px; line-height:1.3; color:#a7afb9; text-align:center; }

.picker { flex:0 0 auto; align-self:stretch; min-height:120px; width:250px; display:flex; flex-direction:column; gap:8px; padding:11px; border:1px solid #bcd0f7; border-radius:6px; background:#fff; box-shadow:0 8px 24px rgba(20,24,29,0.16); }
.picker-title { font-size:11.5px; font-weight:500; color:#1c1f24; }
.picker label { display:flex; flex-direction:column; gap:3px; }
.picker select { height:26px; border:1px solid #e2e5ea; border-radius:4px; font:inherit; font-size:11px; }
.picker-actions { display:flex; gap:6px; }
.picker-actions .btn-primary, .picker-actions .btn { flex:1; }
</style>
