<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SAVED_SETS, findSavedSet, PPA_METRICS, ppaTable } from './data.js'

const props = defineProps({
  pdkId: { type: String, required: true },
  family: { type: Object, required: true },
})

const route = useRoute()
const router = useRouter()

// The loaded set is part of the URL so a report link opens on the same view.
const set = computed(() => findSavedSet(route.query.set))

function loadSet(id) {
  router.push({ query: { ...route.query, set: id } })
}
function backToList() {
  const { set: _, ...rest } = route.query
  router.push({ query: rest })
}

const diff = ref(false)

// The reference is a real family member now, so diff% comes from its own row.
const refLibrary = ref(props.family.libraries[0].library)
watch(() => props.family, f => { refLibrary.value = f.libraries[0].library; diff.value = false })

// A one-library family has nothing to compare against.
const comparable = computed(() => props.family.libraries.length > 1)

const table = computed(() =>
  set.value ? ppaTable(set.value, props.pdkId, props.family.libraries, refLibrary.value) : null,
)
// Columns are library × metric; the group row spans each library's metrics.
const subCols = computed(() =>
  table.value
    ? table.value.groups.flatMap(g =>
        PPA_METRICS.map((m, i) => ({ library: g.library, ref: g.ref, metric: m, last: i === PPA_METRICS.length - 1 })),
      )
    : [],
)
const gridCols = computed(() => `180px repeat(${subCols.value.length}, minmax(92px, 1fr))`)

const facts = computed(() => {
  const s = set.value
  if (!s) return []
  return [
    { k: 'chart', v: s.chart },
    { k: 'x', v: 'Cell' },
    { k: 'y', v: s.y2 === 'None' ? s.y : `${s.y} / ${s.y2}` },
    { k: 'derived', v: s.derived ? String(s.derived) : '—' },
    { k: 'cells', v: String(s.cells) },
    { k: 'libraries', v: String(props.family.libraries.length) },
  ]
})

// 값 없음 → 빈칸(0과 구분), 참조 library의 diff → 'REF'
function cellText(row, col) {
  const v = row.byLib[col.library]
  if (!v) return { text: '', cls: '' }
  if (!diff.value) {
    const n = v[col.metric.key]
    return { text: n.toFixed(col.metric.digits), cls: col.metric.key === 'leak' && n > 200 ? 'lr-over' : '' }
  }
  if (col.ref) return { text: 'REF', cls: 'ppa-ref' }
  const d = v[col.metric.dkey]
  if (d === null) return { text: '', cls: '' }
  return { text: `${d > 0 ? '+' : ''}${d.toFixed(2)}%`, cls: d > 2 ? 'lr-over' : d < -1 ? 'lr-good' : '' }
}

function rowCells(row) {
  return subCols.value.map(c => ({ ...cellText(row, c), edge: c.last }))
}
</script>

<template>
  <!-- 2-1) Nothing loaded yet -->
  <div v-if="!set" class="ppa-empty">
    <div class="ppa-empty-head">
      <span class="ppa-empty-title">불러올 저장 셋을 선택하세요</span>
      <span class="ppa-empty-sub">PPA 페이지에서 저장한 셀 리스트와 차트 설정을 그대로 렌더링합니다.</span>
    </div>
    <div class="lr-box">
      <div class="lr-thead g-saved">
        <span>NAME</span>
        <span class="lr-num">CELLS</span>
        <span>CHART</span>
        <span class="lr-num">DERIVED</span>
        <span>SAVED</span>
        <span class="lr-num">OWNER</span>
      </div>
      <div v-for="s in SAVED_SETS" :key="s.id" class="lr-row g-saved pick" @click="loadSet(s.id)">
        <span class="lr-mono lr-ellipsis">{{ s.name }}</span>
        <span class="lr-mono lr-num muted">{{ s.cells }}</span>
        <span class="ppa-chart">{{ s.chart }}</span>
        <span class="lr-mono lr-num small muted">{{ s.derived || '—' }}</span>
        <span class="lr-mono small dim">{{ s.saved }}</span>
        <span class="lr-mono lr-num small dim">{{ s.owner }}</span>
      </div>
    </div>
    <router-link class="lr-link ppa-new" to="/">PPA 페이지에서 새로 만들기 →</router-link>
  </div>

  <!-- 2-2) A set is loaded: one chart + one table -->
  <div v-else>
    <div class="lr-bar">
      <label class="lr-control">
        <span class="lr-control-label">saved set</span>
        <select :value="set.id" @change="loadSet($event.target.value)">
          <option v-for="s in SAVED_SETS" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </label>
      <span class="ppa-back" @click="backToList">목록</span>
      <div class="ppa-divider"></div>
      <div v-for="f in facts" :key="f.k" class="ppa-fact">
        <span class="ppa-fact-k">{{ f.k }}</span>
        <span class="ppa-fact-v">{{ f.v }}</span>
      </div>
      <div class="lr-spacer"></div>
      <router-link class="lr-link" to="/">PPA 페이지에서 편집 →</router-link>
    </div>

    <div class="ppa-chart-block">
      <div class="ppa-chart-head">
        <span class="lr-section-title">{{ set.name }}</span>
        <span class="lr-subtitle">
          {{ set.chart }} · Cell × {{ set.y }}{{ diff ? ` · diff vs ${refLibrary}` : '' }}
        </span>
      </div>
      <!-- Chart rendering is out of scope for this step; PPA page owns it. -->
      <div class="ppa-chart-slot">차트 자리 (PPA 페이지의 저장 설정으로 렌더링)</div>
    </div>

    <div class="lr-bar">
      <span class="lr-section-title">Cell별 측정값</span>
      <span class="lr-subtitle">
        {{ table.rows.length }} cells × {{ table.groups.length }} libraries ·
        {{ diff ? `Δ % vs ${refLibrary}` : family.family }}
      </span>
      <div class="lr-spacer"></div>
      <label v-if="comparable && diff" class="lr-control">
        <span class="lr-control-label">reference</span>
        <select v-model="refLibrary">
          <option v-for="l in family.libraries" :key="l.id" :value="l.library">{{ l.library }}</option>
        </select>
      </label>
      <div v-if="comparable" class="lr-seg">
        <button type="button" :class="{ active: !diff }" @click="diff = false">Raw</button>
        <button type="button" :class="{ active: diff }" @click="diff = true">Diff</button>
      </div>
    </div>

    <div class="ppa-table">
      <!-- Two-level header: library groups over the four metrics -->
      <div class="ppa-group-row" :style="{ gridTemplateColumns: gridCols }">
        <span class="ppa-group-pad"></span>
        <span
          v-for="g in table.groups"
          :key="g.library"
          class="ppa-group"
          :style="{ gridColumn: `span ${table.metrics.length}` }"
        >
          {{ g.library }}
          <span v-if="g.ref && comparable" class="ppa-badge">REF</span>
        </span>
      </div>

      <div class="ppa-subhead" :style="{ gridTemplateColumns: gridCols }">
        <span class="ppa-cell-col">CELL</span>
        <span
          v-for="(c, i) in subCols"
          :key="i"
          class="ppa-metric"
          :class="{ edge: c.last }"
        >{{ diff ? c.metric.diff : c.metric.raw }}</span>
      </div>

      <div
        v-for="r in table.rows"
        :key="r.cell"
        class="lr-row"
        :style="{ gridTemplateColumns: gridCols }"
      >
        <span class="lr-mono">{{ r.cell }}</span>
        <span
          v-for="(v, i) in rowCells(r)"
          :key="i"
          class="lr-mono lr-num ppa-val"
          :class="[v.cls, { edge: v.edge }]"
        >{{ v.text }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ppa-empty {
  display: flex;
  flex-direction: column;
  max-width: 900px;
  padding: 22px 12px;
}
.ppa-empty-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 12px;
}
.ppa-empty-title {
  font-size: 13.5px;
  color: #1c1f24;
}
.ppa-empty-sub {
  font-size: 11.5px;
  color: #8a929c;
}
.ppa-new { padding-top: 11px; }

.g-saved {
  grid-template-columns: minmax(180px, 1.4fr) 64px 120px 64px 140px 100px;
  gap: 14px;
}
.pick { cursor: pointer; }
.pick:hover { background: rgba(47, 111, 237, 0.05); }
.ppa-chart {
  font-size: 11.5px;
  color: #6b7480;
}
.muted { color: #6b7480; }
.dim { color: #8a929c; }
.small { font-size: 11px; }

.ppa-back {
  font-size: 11px;
  color: #8a929c;
  cursor: pointer;
  padding: 0 2px;
}
.ppa-back:hover { color: #2f6fed; }
.ppa-divider {
  width: 1px;
  height: 18px;
  background: #eef0f3;
  margin: 0 2px;
}
.ppa-fact {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 26px;
}
.ppa-fact-k {
  font-size: 10px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: #b6bec8;
}
.ppa-fact-v {
  font-family: var(--clara-mono);
  font-size: 11px;
  color: #4a525c;
}

.ppa-chart-block { border-bottom: 1px solid #eef0f3; }
.ppa-chart-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 11px 12px 3px;
}
.ppa-chart-slot {
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11.5px;
  color: #c8d0d9;
}

/* Two-level header. The column template is inline (library count varies), and
   both header rows share it with the body rows so the groups stay aligned.
   Deliberately not shared with TabMw: MW's columns are a fixed 62px, PPA's
   flex, so the two can't use one width rule. */
.ppa-table { overflow-x: auto; }
.ppa-group-row {
  display: grid;
  align-items: stretch;
  height: 24px;
  padding: 0 12px;
  background: #f7f8fa;
  border-bottom: 1px solid #eef0f3;
}
.ppa-group-pad { border-right: 1px solid #e2e5ea; }
.ppa-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-right: 1px solid #e2e5ea;
  font-family: var(--clara-mono);
  font-size: 11px;
  font-weight: 500;
  color: #1c1f24;
}
.ppa-badge {
  display: flex;
  align-items: center;
  height: 15px;
  padding: 0 5px;
  border-radius: 8px;
  background: rgba(47, 111, 237, 0.09);
  font-family: inherit;
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.3px;
  color: #2f6fed;
}

.ppa-subhead {
  display: grid;
  align-items: center;
  height: 26px;
  padding: 0 12px;
  background: #f7f8fa;
  border-bottom: 1px solid #e2e5ea;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #8a929c;
}
.ppa-metric {
  text-align: right;
  padding-right: 8px;
}
.ppa-val { padding-right: 8px; }
.ppa-metric.edge,
.ppa-val.edge { border-right: 1px solid #e2e5ea; }
.ppa-ref {
  color: #2f6fed;
  font-weight: 500;
}
</style>
