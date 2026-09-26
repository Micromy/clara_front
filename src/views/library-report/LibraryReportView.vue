<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PDKS, FAMILIES, findPdk, findFamily } from './data.js'
import TabLibraryInfo from './TabLibraryInfo.vue'
import TabPpa from './TabPpa.vue'
import TabMw from './TabMw.vue'
import TabFinalReport from './TabFinalReport.vue'
import './report.css'

const TABS = [
  { key: 'info',  label: 'Library Info' },
  { key: 'ppa',   label: 'PPA' },
  { key: 'mw',    label: 'MW' },
  { key: 'final', label: 'Final Report' },
]

const route = useRoute()
const router = useRouter()

// Everything the client might want to share a link to lives in the query.
const tab = computed(() => (TABS.some(t => t.key === route.query.tab) ? route.query.tab : 'info'))
const pdkId = computed(() => (PDKS.some(p => p.id === route.query.pdk) ? route.query.pdk : PDKS[0].id))
// family 선택이 곧 소속 library 전체 선택이다 — 네 탭 모두 이 객체 하나를 받는다.
const family = computed(() =>
  (FAMILIES.some(f => f.family === route.query.family) ? findFamily(route.query.family) : FAMILIES[0]),
)
const pdk = computed(() => findPdk(pdkId.value))

// 멤버 칩은 읽기 전용 — 4개까지 보이고 나머지는 +N으로 접는다.
const MAX_CHIPS = 4
const shownLibs = computed(() => family.value.libraries.slice(0, MAX_CHIPS))
const hiddenLibCount = computed(() => Math.max(0, family.value.libraries.length - MAX_CHIPS))

function setQuery(patch) {
  router.push({ query: { ...route.query, ...patch } })
}

const pdkMenuOpen = ref(false)
const pdkWrap = ref(null)

function pickPdk(id) {
  pdkMenuOpen.value = false
  setQuery({ pdk: id })
}

function onDocClick(e) {
  if (pdkMenuOpen.value && pdkWrap.value && !pdkWrap.value.contains(e.target)) pdkMenuOpen.value = false
}
function onEsc(e) {
  if (e.key === 'Escape') pdkMenuOpen.value = false
}
onMounted(() => {
  document.addEventListener('mousedown', onDocClick)
  document.addEventListener('keydown', onEsc)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick)
  document.removeEventListener('keydown', onEsc)
})
</script>

<template>
  <div class="lr-page">
    <!-- Context bar: the PDK + Family scope the whole report depends on -->
    <div class="lr-bar lr-context">
      <div ref="pdkWrap" class="lr-pdk-wrap">
        <div
          class="lr-pdk-trigger"
          :class="{ open: pdkMenuOpen }"
          @click="pdkMenuOpen = !pdkMenuOpen"
        >
          <span class="lr-control-label">PDK</span>
          <span class="lr-pdk-process">{{ pdk.process }}</span>
          <span class="lr-pdk-tag">HSPICE</span>
          <span class="lr-pdk-ver">{{ pdk.hspice }}</span>
          <span class="lr-pdk-caret">▾</span>
        </div>

        <div v-if="pdkMenuOpen" class="lr-pdk-menu">
          <div class="lr-pdk-grid lr-pdk-head">
            <span>PROCESS</span><span>HSPICE</span><span>LVS</span><span>PEX</span>
          </div>
          <div
            v-for="p in PDKS"
            :key="p.id"
            class="lr-pdk-grid lr-pdk-opt"
            :class="{ selected: p.id === pdkId }"
            @click="pickPdk(p.id)"
          >
            <span class="lr-pdk-opt-process">{{ p.process }}</span>
            <span>{{ p.hspice }}</span>
            <span>{{ p.lvs }}</span>
            <span>{{ p.pex }}</span>
          </div>
        </div>
      </div>

      <label class="lr-control">
        <span class="lr-control-label">Family</span>
        <select
          :value="family.family"
          style="width: 112px"
          @change="setQuery({ family: $event.target.value })"
        >
          <option v-for="f in FAMILIES" :key="f.family" :value="f.family">{{ f.family }}</option>
        </select>
      </label>

      <!-- Read-only: picking a family means picking all of its libraries. -->
      <div class="lr-fam-libs">
        <span v-for="l in shownLibs" :key="l.id" class="lr-fam-lib">{{ l.library }}</span>
        <span v-if="hiddenLibCount" class="lr-fam-lib more">+{{ hiddenLibCount }}</span>
      </div>

      <div class="lr-spacer"></div>
    </div>

    <!-- Tab row -->
    <div class="lr-tabs">
      <div
        v-for="t in TABS"
        :key="t.key"
        class="lr-tab"
        :class="{ active: tab === t.key }"
        @click="setQuery({ tab: t.key })"
      >{{ t.label }}</div>
    </div>

    <main class="lr-main">
      <TabLibraryInfo v-if="tab === 'info'" :pdk="pdk" :family="family" />
      <TabPpa v-else-if="tab === 'ppa'" :pdk-id="pdkId" :family="family" />
      <TabMw v-else-if="tab === 'mw'" :pdk-id="pdkId" :family="family" />
      <TabFinalReport v-else :pdk="pdk" :family="family" />
    </main>
  </div>
</template>

<style scoped>
.lr-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}
.lr-context { flex-shrink: 0; }

/* ── Family member chips: read-only echo of the family's libraries ── */
.lr-fam-libs {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.lr-fam-lib {
  font-family: var(--clara-mono);
  font-size: 11px;
  color: #8a929c;
  white-space: nowrap;
}
.lr-fam-lib.more { color: #b6bec8; }

.lr-main {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

/* ── PDK selector: a <select> can't hold the full PDK name ─── */
.lr-pdk-wrap { position: relative; }
.lr-pdk-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 26px;
  padding: 0 9px;
  border: 1px solid #e2e5ea;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
}
.lr-pdk-trigger:hover { border-color: #c8d0d9; }
.lr-pdk-trigger.open { border-color: #bcd0f7; }
.lr-pdk-process {
  font-family: var(--clara-mono);
  font-size: 11px;
  font-weight: 500;
  color: #1c1f24;
}
.lr-pdk-tag {
  font-size: 9.5px;
  letter-spacing: 0.4px;
  color: #b6bec8;
}
.lr-pdk-ver {
  font-family: var(--clara-mono);
  font-size: 11px;
  color: #4a525c;
}
.lr-pdk-caret {
  font-family: var(--clara-mono);
  font-size: 9px;
  color: #a7afb9;
}

.lr-pdk-menu {
  position: absolute;
  top: 30px;
  left: 0;
  z-index: 31;
  width: 352px;
  padding: 4px;
  background: #fff;
  border: 1px solid #d5d9de;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(20, 24, 29, 0.16);
}
.lr-pdk-grid {
  display: grid;
  grid-template-columns: 74px repeat(3, 1fr);
  align-items: center;
  padding: 0 8px;
}
.lr-pdk-head {
  height: 24px;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #a7afb9;
}
.lr-pdk-opt {
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  font-family: var(--clara-mono);
  font-size: 11px;
  color: #6b7480;
}
.lr-pdk-opt:hover { background: #f7f8fa; }
.lr-pdk-opt.selected { background: #f1f3f6; }
.lr-pdk-opt-process {
  font-size: 11.5px;
  color: #1c1f24;
}
.lr-pdk-opt.selected .lr-pdk-opt-process { font-weight: 500; }

/* ── Tab row ──────────────────────────────────────────────── */
.lr-tabs {
  display: flex;
  align-items: stretch;
  height: 32px;
  padding: 0 4px;
  border-bottom: 1px solid #eef0f3;
  flex-shrink: 0;
}
.lr-tab {
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 12px;
  color: #6b7480;
  cursor: pointer;
}
.lr-tab.active {
  font-weight: 500;
  color: #1c1f24;
  box-shadow: inset 0 -2px 0 #2f6fed;
}
</style>
