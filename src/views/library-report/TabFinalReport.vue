<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { findSavedSet, finalReport } from './data.js'

const props = defineProps({
  pdk: { type: Object, required: true },
  lib: { type: String, required: true },
})

const route = useRoute()

// Never generated on entry — the button has to be pressed.
const state = ref('idle') // idle | loading | ready

// MW sets live in the MW tab's local state; the summary quotes a fixed shape
// until the two tabs share a store.
const MW_SETS = [{ label: '', tables: [{ pdkId: 'p1', lib: 'LIBA' }] }]

const savedSet = computed(() => findSavedSet(route.query.set))
const report = computed(() =>
  finalReport({ pdk: props.pdk, lib: props.lib, savedSet: savedSet.value, mwSets: MW_SETS }),
)
const inputSummary = computed(
  () => `PDK 4 components · PPA ${savedSet.value ? `${savedSet.value.cells} cells` : '미선택'} · MW ${MW_SETS.length} sets`,
)

function generate() {
  state.value = 'loading'
  setTimeout(() => { state.value = 'ready' }, 700)
}
</script>

<template>
  <div v-if="state === 'idle'" class="fr-idle">
    <div class="fr-idle-copy">
      <span class="fr-idle-title">Library Info · PPA · MW 세 탭의 데이터를 요약합니다</span>
      <span class="fr-idle-sub">{{ inputSummary }}</span>
    </div>
    <button class="lr-btn-primary" type="button" @click="generate">요약 생성</button>
  </div>

  <div v-else-if="state === 'loading'" class="fr-loading">
    <span class="fr-loading-text">요약 생성 중…</span>
    <span class="fr-loading-sub">{{ inputSummary }}</span>
  </div>

  <div v-else>
    <div class="lr-bar">
      <span class="fr-meta">{{ report.meta }}</span>
      <div class="lr-spacer"></div>
      <button class="lr-btn" type="button" @click="generate">다시 생성</button>
    </div>

    <div class="fr-body">
      <div class="fr-verdict">
        <span class="fr-verdict-title">{{ report.title }}</span>
        <span class="fr-prose">{{ report.body }}</span>
      </div>

      <div v-for="s in report.sections" :key="s.title" class="fr-section">
        <div class="fr-section-head">
          <span class="fr-source" :style="{ color: s.color }">{{ s.source }}</span>
          <span class="lr-section-title">{{ s.title }}</span>
        </div>
        <span class="fr-prose">{{ s.body }}</span>
        <div class="fr-points">
          <div v-for="p in s.points" :key="p.flag" class="fr-point">
            <span class="fr-flag">{{ p.flag }}</span>
            <span class="fr-point-text">{{ p.text }}</span>
            <span class="fr-point-value">{{ p.value }}</span>
          </div>
        </div>
      </div>

      <div class="fr-actions-head">
        <span class="lr-section-title">짚어볼 지점</span>
        <span class="lr-subtitle">{{ report.actions.length }} items</span>
      </div>
      <div class="lr-box">
        <div v-for="a in report.actions" :key="a.text" class="lr-row g-action">
          <span class="fr-sev" :class="a.sev === 'CHECK' ? 'lr-warn' : 'dim'">{{ a.sev }}</span>
          <span class="fr-action-text lr-ellipsis">{{ a.text }}</span>
          <span class="lr-mono lr-num small dim">{{ a.tab }}</span>
          <span class="lr-mono lr-num small">{{ a.owner }}</span>
        </div>
      </div>

      <span class="fr-disclaimer">{{ report.disclaimer }}</span>
    </div>
  </div>
</template>

<style scoped>
.fr-idle {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 70px 20px;
}
.fr-idle-copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.fr-idle-title {
  font-size: 13.5px;
  color: #4a525c;
}
.fr-idle-sub {
  font-family: var(--clara-mono);
  font-size: 11px;
  color: #a7afb9;
}

.fr-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 220px;
}
.fr-loading-text {
  font-family: var(--clara-mono);
  font-size: 11.5px;
  color: #a7afb9;
}
.fr-loading-sub {
  font-size: 11px;
  color: #c8d0d9;
}

.fr-meta {
  font-family: var(--clara-mono);
  font-size: 11px;
  color: #8a929c;
}

.fr-body {
  display: flex;
  flex-direction: column;
  max-width: 1000px;
  padding: 4px 12px 24px;
}

.fr-verdict {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 14px 0 12px;
  border-bottom: 1px solid #eef0f3;
}
.fr-verdict-title {
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.1px;
}
.fr-prose {
  font-size: 12.5px;
  line-height: 1.65;
  color: #4a525c;
  text-wrap: pretty;
}

.fr-section {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 13px 0;
  border-bottom: 1px solid #f4f5f7;
}
.fr-section-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fr-source {
  font-family: var(--clara-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.6px;
}

.fr-points {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-top: 2px;
}
.fr-point {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.fr-flag {
  font-family: var(--clara-mono);
  font-size: 10.5px;
  color: #8a929c;
  width: 52px;
  flex-shrink: 0;
}
.fr-point-text {
  flex: 1;
  font-size: 12px;
  line-height: 1.6;
  color: #4a525c;
}
.fr-point-value {
  font-family: var(--clara-mono);
  font-size: 11px;
  color: #8a929c;
  flex-shrink: 0;
}

.fr-actions-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0 6px;
}
.g-action {
  grid-template-columns: 64px minmax(0, 1fr) 92px 108px;
  padding: 0 10px;
}
.fr-sev {
  font-family: var(--clara-mono);
  font-size: 10.5px;
}
.fr-action-text {
  font-size: 11.5px;
  color: #1c1f24;
  padding-right: 10px;
}
.dim { color: #8a929c; }
.small { font-size: 11px; }

.fr-disclaimer {
  font-size: 11px;
  line-height: 1.6;
  color: #a7afb9;
  padding-top: 10px;
}
</style>
