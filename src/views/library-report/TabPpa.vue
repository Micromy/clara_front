<script setup>
import { inject, computed } from 'vue'
import { SAVED_SETS, findSavedSet, ppaTable, PPA_METRICS } from './data.js'

const { state, actions, family } = inject('report')
const fam = computed(() => family())

const loadedSet = computed(() => state.ppaSetId ? findSavedSet(state.ppaSetId) : null)
const savedList = computed(() => SAVED_SETS.map(s => ({ ...s, selected: state.ppaSetId === s.id })))
const comparable = computed(() => fam.value.libraries.length > 1)
const table = computed(() => loadedSet.value ? ppaTable(loadedSet.value, state.pdkId, fam.value.libraries, state.refLibrary) : null)

const facts = computed(() => {
  if (!loadedSet.value) return []
  const s = loadedSet.value
  return [
    { k: 'chart', v: s.chart }, { k: 'x', v: 'Cell' },
    { k: 'y', v: s.y2 === 'None' ? s.y : `${s.y} / ${s.y2}` },
    { k: 'derived', v: s.derived ? String(s.derived) : '—' },
    { k: 'cells', v: String(s.cells) }, { k: 'libraries', v: String(fam.value.libraries.length) },
  ]
})

const subCols = computed(() => {
  if (!table.value) return []
  return table.value.groups.flatMap(g => PPA_METRICS.map((m, i) => ({ library: g.library, ref: g.ref, metric: m, last: i === PPA_METRICS.length - 1 })))
})

function cellText(row, col) {
  const v = row.byLib[col.library]
  if (!v) return { text: '', color: '#1c1f24', weight: 400 }
  if (!state.diff) { const n = v[col.metric.key]; return { text: n.toFixed(col.metric.digits), color: (col.metric.key === 'leak' && n > 200) ? '#b4451f' : '#1c1f24', weight: 400 } }
  if (col.ref) return { text: 'REF', color: '#2f6fed', weight: 500 }
  const d = v[col.metric.dkey]
  if (d === null) return { text: '', color: '#1c1f24', weight: 400 }
  return { text: `${d > 0 ? '+' : ''}${d.toFixed(2)}%`, color: d > 2 ? '#b4451f' : d < -1 ? '#2c7a4b' : '#1c1f24', weight: 400 }
}

const hasUnsavedChart = computed(() => !!loadedSet.value && state.ppaLinkedId !== loadedSet.value.id)
function onEditInPpa(e) {
  if (hasUnsavedChart.value && !window.confirm('저장하지 않은 차트 변경사항이 있습니다. 저장하지 않고 PPA 페이지로 이동할까요?')) e.preventDefault()
}
</script>

<template>
  <div class="tab-ppa">
    <div class="picker-head">
      <span class="title">불러올 저장 셋을 선택하세요</span>
      <span class="sub">PPA 페이지에서 저장한 셀 리스트와 차트 설정을 그대로 렌더링합니다.</span>
    </div>
    <div class="tbl">
      <div class="row head"><span>NAME</span><span class="ar">CELLS</span><span>CHART</span><span class="ar">DERIVED</span><span>SAVED</span><span class="ar">OWNER</span></div>
      <div v-for="s in savedList" :key="s.id" class="row" :class="{ selected: s.selected }" @click="actions.linkSet(s.id)">
        <span class="strong">{{ s.name }}</span>
        <span class="ar mono">{{ s.cells }}</span>
        <span>{{ s.chart }}</span>
        <span class="ar mono">{{ s.derived || '—' }}</span>
        <span class="mono sub">{{ s.saved }}</span>
        <span class="ar mono sub">{{ s.owner }}</span>
      </div>
    </div>

    <div v-if="loadedSet" class="loaded">
      <div class="loaded-bar">
        <span class="mono strong">{{ loadedSet.name }}</span>
        <div v-for="f in facts" :key="f.k" class="fact"><span class="sub">{{ f.k }}</span><span class="mono">{{ f.v }}</span></div>
        <div class="spacer"></div>
        <a href="#" class="edit-link" @click="onEditInPpa">PPA 페이지에서 편집 →</a>
      </div>

      <div v-if="hasUnsavedChart" class="unsaved-banner">
        <span>이 차트는 아직 리포트에 저장되지 않았습니다.</span>
        <div class="spacer"></div>
        <button class="btn-primary" @click="actions.saveChartToReport()">리포트에 저장</button>
      </div>

      <div v-if="comparable" class="controls">
        <label class="ref-field">
          <span class="sub">REF</span>
          <select :value="state.refLibrary" @change="actions.setRefLibrary($event.target.value)">
            <option v-for="l in fam.libraries" :key="l.id" :value="l.library">{{ l.library }}</option>
          </select>
        </label>
        <button class="seg-btn" :class="{ active: state.diff }" @click="actions.toggleDiff()">Δ vs REF</button>
      </div>

      <div class="ppa-table-wrap">
        <div class="ppa-grid head" :style="{ gridTemplateColumns: `180px repeat(${subCols.length}, minmax(92px,1fr))` }">
          <span></span>
          <span v-for="g in table.groups" :key="g.library" class="grp mono" :style="{ gridColumn: `span ${PPA_METRICS.length}` }">{{ g.library }}<span v-if="g.ref && comparable" class="ref-tag">REF</span></span>
        </div>
        <div class="ppa-grid sub-head" :style="{ gridTemplateColumns: `180px repeat(${subCols.length}, minmax(92px,1fr))` }">
          <span></span>
          <span v-for="(c, i) in subCols" :key="i" class="mono sub">{{ state.diff ? c.metric.diff : c.metric.raw }}</span>
        </div>
        <div v-for="r in table.rows" :key="r.cell" class="ppa-grid row-line" :style="{ gridTemplateColumns: `180px repeat(${subCols.length}, minmax(92px,1fr))` }">
          <span class="mono strong">{{ r.cell }}</span>
          <span v-for="(c, i) in subCols" :key="i" class="mono" :style="{ color: cellText(r, c).color, fontWeight: cellText(r, c).weight }">{{ cellText(r, c).text }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-ppa { display:flex; flex-direction:column; gap:14px; padding:10px 12px 16px; }
.mono { font-family:'Roboto Mono',monospace; }
.strong { font-weight:500; }
.sub { font-size:10.5px; color:#8a929c; }
.ar { text-align:right; }
.spacer { flex:1; }
.picker-head { display:flex; flex-direction:column; gap:2px; }
.title { font-size:13.5px; color:#1c1f24; }
.tbl { border:1px solid #eef0f3; border-radius:6px; overflow-x:auto; }
.row { display:grid; grid-template-columns:minmax(180px,1.4fr) 64px 120px 64px 140px 100px; gap:14px; align-items:center; height:28px; padding:0 12px; border-bottom:1px solid #f4f5f7; cursor:pointer; font-size:12px; }
.row.head { background:#f7f8fa; font-size:10px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase; color:#8a929c; cursor:default; }
.row:hover:not(.head) { background:rgba(47,111,237,0.05); }
.row.selected { background:rgba(47,111,237,0.07); }
.loaded { display:flex; flex-direction:column; border:1px solid #eef0f3; border-radius:6px; overflow:hidden; }
.loaded-bar { display:flex; align-items:center; gap:14px; padding:10px 12px; border-bottom:1px solid #eef0f3; flex-wrap:wrap; }
.fact { display:flex; align-items:center; gap:5px; }
.edit-link { font-size:11px; color:#2f6fed; text-decoration:none; }
.edit-link:hover { text-decoration:underline; }
.unsaved-banner { display:flex; align-items:center; gap:10px; padding:8px 12px; background:#fff7e8; border-bottom:1px solid #f2e0b8; font-size:11.5px; color:#8a6d1f; }
.btn-primary { height:26px; padding:0 12px; border:0; border-radius:4px; background:#2f6fed; font:inherit; font-size:11px; font-weight:500; color:#fff; cursor:pointer; }
.controls { display:flex; align-items:center; gap:10px; padding:8px 12px; border-bottom:1px solid #eef0f3; }
.ref-field { display:flex; align-items:center; gap:6px; }
.ref-field select { border:1px solid #e2e5ea; border-radius:4px; height:24px; font:inherit; font-size:11px; }
.seg-btn { height:24px; padding:0 10px; border:1px solid #e2e5ea; border-radius:4px; background:#fff; font:inherit; font-size:11px; color:#6b7480; cursor:pointer; }
.seg-btn.active { background:#2f6fed; border-color:#2f6fed; color:#fff; }
.ppa-table-wrap { overflow-x:auto; }
.ppa-grid { display:grid; }
.ppa-grid.head span, .ppa-grid.sub-head span { padding:4px 8px; font-size:10px; }
.ppa-grid.row-line { border-bottom:1px solid #f4f5f7; }
.ppa-grid.row-line span { padding:4px 8px; font-size:11px; }
.ref-tag { margin-left:4px; font-size:9px; color:#2f6fed; }
</style>
