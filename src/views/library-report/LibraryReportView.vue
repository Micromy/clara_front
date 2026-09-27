<script setup>
import { computed, provide, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createReportStore } from './useReportStore.js'
import { PDKS, FAMILIES, SAVED_SETS } from './data.js'
import TabLibraryInfo from './TabLibraryInfo.vue'
import TabPpa from './TabPpa.vue'
import TabMw from './TabMw.vue'
import TabFinalReport from './TabFinalReport.vue'

const tabs = [
  { key: 'info', label: 'Library Info' },
  { key: 'ppa', label: 'PPA' },
  { key: 'mw', label: 'MW' },
  { key: 'final', label: 'Final Report' },
]

const store = createReportStore()
provide('report', store)
const { state, actions } = store
const pdk = computed(() => store.pdk())
const family = computed(() => store.family())

// 멤버 칩은 읽기 전용 — 4개까지 보이고 나머지는 +N으로 접는다.
const MAX_CHIPS = 4
const shownLibs = computed(() => family.value.libraries.slice(0, MAX_CHIPS))
const hiddenLibCount = computed(() => Math.max(0, family.value.libraries.length - MAX_CHIPS))

const route = useRoute()
const router = useRouter()

// Restore from the URL once at mount so a refresh or a shared link opens on
// the same view. pdk must be applied before family — setFamily() rebuilds
// the MW comparison set using the current pdkId.
if (tabs.some(t => t.key === route.query.tab)) state.tab = route.query.tab
if (PDKS.some(p => p.id === route.query.pdk)) actions.setPdk(route.query.pdk)
if (FAMILIES.some(f => f.family === route.query.family)) actions.setFamily(route.query.family)
if (SAVED_SETS.some(s => s.id === route.query.set)) state.ppaSetId = route.query.set

function setQuery(patch) {
  router.push({ query: { ...route.query, ...patch } })
}
watch(() => state.tab, tab => setQuery({ tab }))
watch(() => state.pdkId, pdkId => setQuery({ pdk: pdkId }))
watch(() => state.familyName, family => setQuery({ family }))
watch(() => state.ppaSetId, set => setQuery({ set: set || undefined }))
</script>

<template>
  <div class="lr-root">
    <div class="lr-header">
      <div class="pdk-trigger" @click="actions.togglePdkMenu()">
        <span class="lbl">PDK</span>
        <span class="mono strong">{{ pdk.process }}</span>
        <span class="lbl">HSPICE</span><span class="mono">{{ pdk.hspice }}</span>
        <span class="lbl">LVS</span><span class="mono">{{ pdk.lvs }}</span>
        <span class="lbl">PEX</span><span class="mono">{{ pdk.pex }}</span>
        <span class="mono caret">▾</span>
      </div>
      <div v-if="state.pdkMenuOpen" class="pdk-menu">
        <div class="pdk-menu-head"><span>PROCESS</span><span>HSPICE</span><span>LVS</span><span>PEX</span></div>
        <div v-for="pp in PDKS" :key="pp.id" class="pdk-menu-row" @click="actions.setPdk(pp.id)">
          <span class="mono" :style="{ fontWeight: pp.id === state.pdkId ? 600 : 400 }">{{ pp.process }}</span>
          <span class="mono">{{ pp.hspice }}</span><span class="mono">{{ pp.lvs }}</span><span class="mono">{{ pp.pex }}</span>
        </div>
      </div>

      <label class="family-field">
        <span class="lbl">FAMILY</span>
        <select :value="state.familyName" @change="actions.setFamily($event.target.value)">
          <option v-for="f in FAMILIES" :key="f.family" :value="f.family">{{ f.family }}</option>
        </select>
      </label>

      <!-- Read-only: picking a family means picking all of its libraries. -->
      <div class="lr-fam-libs">
        <span v-for="l in shownLibs" :key="l.id" class="lr-fam-lib">{{ l.library }}</span>
        <span v-if="hiddenLibCount" class="lr-fam-lib more">+{{ hiddenLibCount }}</span>
      </div>

      <div class="spacer"></div>
    </div>

    <div class="lr-tabs">
      <div v-for="t in tabs" :key="t.key" class="lr-tab" :class="{ active: state.tab === t.key }" @click="state.tab = t.key">{{ t.label }}</div>
    </div>

    <main class="lr-main">
      <TabLibraryInfo v-if="state.tab === 'info'" />
      <TabPpa v-else-if="state.tab === 'ppa'" />
      <TabMw v-else-if="state.tab === 'mw'" />
      <TabFinalReport v-else-if="state.tab === 'final'" />
    </main>
  </div>
</template>

<style scoped>
.lr-root { display:flex; flex-direction:column; height:100%; background:#fff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:12px; color:#1c1f24; }
.mono { font-family:'Roboto Mono',monospace; }
.lbl { font-size:10.5px; color:#8a929c; }
.strong { font-weight:500; }
.spacer { flex:1; }
.lr-header { display:flex; align-items:center; gap:10px; padding:8px 10px; border-bottom:1px solid #eef0f3; flex-wrap:wrap; position:relative; }
.pdk-trigger { display:flex; align-items:center; gap:8px; height:26px; padding:0 9px; border:1px solid #e2e5ea; border-radius:4px; cursor:pointer; user-select:none; }
.pdk-trigger .caret { font-size:9px; color:#a7afb9; }
.pdk-menu { position:absolute; top:40px; left:10px; z-index:31; width:352px; padding:4px; background:#fff; border:1px solid #d5d9de; border-radius:6px; box-shadow:0 8px 24px rgba(20,24,29,0.16); }
.pdk-menu-head, .pdk-menu-row { display:grid; grid-template-columns:74px repeat(3,1fr); align-items:center; padding:0 8px; height:26px; }
.pdk-menu-head { font-size:9.5px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase; color:#8a929c; }
.pdk-menu-row { border-radius:4px; cursor:pointer; font-size:11.5px; }
.pdk-menu-row:hover { background:#f7f8fa; }
.family-field { display:flex; align-items:center; gap:6px; height:26px; padding:0 4px 0 9px; border:1px solid #e2e5ea; border-radius:4px; }
.family-field select { border:0; background:transparent; font:inherit; font-size:11.5px; color:#1c1f24; cursor:pointer; outline:none; }
/* ── Family member chips: read-only echo of the family's libraries ── */
.lr-fam-libs { display:flex; align-items:center; gap:5px; min-width:0; }
.lr-fam-lib { font-family:'Roboto Mono',monospace; font-size:11px; color:#8a929c; white-space:nowrap; }
.lr-fam-lib.more { color:#b6bec8; }
.lr-tabs { display:flex; align-items:stretch; height:32px; padding:0 4px; border-bottom:1px solid #eef0f3; flex-shrink:0; }
.lr-tab { display:flex; align-items:center; padding:0 12px; font-size:12px; cursor:pointer; color:#8a929c; }
.lr-tab.active { color:#1c1f24; font-weight:500; box-shadow:inset 0 -2px 0 #2f6fed; }
.lr-main { flex:1; min-height:0; overflow:auto; position:relative; }
</style>
