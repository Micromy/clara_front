<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LIBS, SAVED_SETS, findSavedSet, ppaRows } from './data.js'

const props = defineProps({
  pdkId: { type: String, required: true },
  lib: { type: String, required: true },
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
const refLib = ref(LIBS.find(l => l !== props.lib) || LIBS[0])
const refOptions = computed(() => LIBS.filter(l => l !== props.lib))

const rows = computed(() =>
  set.value ? ppaRows(set.value, props.pdkId, props.lib, refLib.value) : [],
)

const columns = computed(() =>
  diff.value
    ? ['Δ AREA', 'Δ DELAY', 'Δ LEAK', 'Δ CIN']
    : ['AREA (µm²)', 'DELAY (ps)', 'LEAK (nA)', 'CIN (fF)'],
)

const facts = computed(() => {
  const s = set.value
  if (!s) return []
  return [
    { k: 'chart', v: s.chart },
    { k: 'x', v: 'Cell' },
    { k: 'y', v: s.y2 === 'None' ? s.y : `${s.y} / ${s.y2}` },
    { k: 'derived', v: s.derived ? String(s.derived) : '—' },
    { k: 'cells', v: String(s.cells) },
  ]
})

function cells(r) {
  if (diff.value) {
    return [r.dArea, r.dDelay, r.dLeak, r.dCin].map(v => ({
      text: `${v > 0 ? '+' : ''}${v.toFixed(2)}%`,
      cls: v > 2 ? 'lr-over' : v < -1 ? 'lr-good' : '',
    }))
  }
  return [
    { text: r.area.toFixed(4), cls: '' },
    { text: r.delay.toFixed(2), cls: '' },
    { text: r.leak.toFixed(1), cls: r.leak > 200 ? 'lr-over' : '' },
    { text: r.cin.toFixed(2), cls: '' },
  ]
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
          {{ set.chart }} · Cell × {{ set.y }}{{ diff ? ` · diff vs ${refLib}` : '' }}
        </span>
      </div>
      <!-- Chart rendering is out of scope for this step; PPA page owns it. -->
      <div class="ppa-chart-slot">차트 자리 (PPA 페이지의 저장 설정으로 렌더링)</div>
    </div>

    <div class="lr-bar">
      <span class="lr-section-title">Cell별 측정값</span>
      <span class="lr-subtitle">
        {{ rows.length }} cells · {{ diff ? `Δ % vs ${refLib}` : lib }}
      </span>
      <div class="lr-spacer"></div>
      <label v-if="diff" class="lr-control">
        <span class="lr-control-label">reference</span>
        <select v-model="refLib">
          <option v-for="l in refOptions" :key="l" :value="l">{{ l }}</option>
        </select>
      </label>
      <div class="lr-seg">
        <button type="button" :class="{ active: !diff }" @click="diff = false">Raw</button>
        <button type="button" :class="{ active: diff }" @click="diff = true">Diff</button>
      </div>
    </div>

    <div class="ppa-table">
      <div class="lr-thead g-ppa">
        <span>CELL</span>
        <span v-for="c in columns" :key="c" class="lr-num">{{ c }}</span>
      </div>
      <div v-for="r in rows" :key="r.cell" class="lr-row g-ppa">
        <span class="lr-mono">{{ r.cell }}</span>
        <span v-for="(v, i) in cells(r)" :key="i" class="lr-mono lr-num" :class="v.cls">{{ v.text }}</span>
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

.ppa-table { overflow-x: auto; }
.g-ppa {
  grid-template-columns: 180px repeat(4, minmax(110px, 1fr));
  min-width: 640px;
}
</style>
