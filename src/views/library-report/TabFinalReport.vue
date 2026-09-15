<script setup>
import { ref, reactive, computed } from 'vue'
import { useRoute } from 'vue-router'
import { findSavedSet, finalReport, CURRENT_USER } from './data.js'

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

// The AI output is the source; the user edits a draft copied from it so the
// original generated text can always be regenerated.
const editing = ref(false)
const draft = reactive({ title: '', body: '', sectionBodies: {} })

// AI proposes, the user decides: the report stays a draft until the user
// confirms it, at which point they become its author.
const status = ref('draft') // draft | confirmed
const author = ref('')
const statusLabel = computed(() => (status.value === 'confirmed' ? '유저 확정' : 'AI 초안'))

// Reviewer check — the same user verifies the confirmed report before it can be
// saved. Editing invalidates a prior review, so the content is always
// re-checked after a change.
const reviewed = ref(false)
const reviewedBy = ref('')

// Free-form area for anything the generated report doesn't cover.
const userNote = ref('')

function confirmReport() {
  status.value = 'confirmed'
  author.value = CURRENT_USER
  editing.value = false
}

function onReview() {
  reviewedBy.value = reviewed.value ? CURRENT_USER : ''
}

function toggleEdit() {
  editing.value = !editing.value
  if (editing.value) {
    reviewed.value = false
    reviewedBy.value = ''
  }
}

function loadDraft() {
  draft.title = report.value.title
  draft.body = report.value.body
  draft.sectionBodies = Object.fromEntries(report.value.sections.map(s => [s.title, s.body]))
}

function generate() {
  state.value = 'loading'
  setTimeout(() => {
    state.value = 'ready'
    editing.value = false
    status.value = 'draft'
    author.value = ''
    reviewed.value = false
    reviewedBy.value = ''
    userNote.value = ''
    loadDraft()
  }, 700)
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

  <div v-else class="fr">
    <header class="fr-head">
      <div class="fr-head-main">
        <input v-if="editing" v-model="draft.title" class="fr-title-input" />
        <span v-else class="fr-title">{{ draft.title }}</span>
        <div class="fr-sub">
          <span class="fr-meta">{{ report.meta }}</span>
          <span class="fr-badge" :class="status">{{ statusLabel }}</span>
          <span v-if="reviewed" class="fr-badge reviewed">검수완료 {{ reviewedBy }}</span>
          <span v-if="status === 'confirmed'" class="fr-author">최종 작성자 {{ author }}</span>
        </div>
      </div>
      <button class="lr-btn" type="button" @click="toggleEdit">
        {{ editing ? '편집 완료' : '편집' }}
      </button>
      <button
        v-if="status === 'draft'"
        class="lr-btn-primary fr-confirm"
        type="button"
        @click="confirmReport"
      >확정</button>
      <label v-else-if="!editing" class="fr-review">
        <input v-model="reviewed" type="checkbox" @change="onReview" />
        검수완료
      </label>
      <button class="lr-btn" type="button" @click="generate">다시 생성</button>
    </header>

    <div class="fr-doc">
      <textarea v-if="editing" v-model="draft.body" class="fr-edit fr-edit-lead" rows="4"></textarea>
      <p v-else class="fr-lead">{{ draft.body }}</p>

      <section v-for="s in report.sections" :key="s.title" class="fr-card">
        <span class="fr-card-rail" :style="{ background: s.color }"></span>
        <div class="fr-card-body">
          <div class="fr-card-head">
            <span class="fr-source" :style="{ color: s.color }">{{ s.source }}</span>
            <span class="fr-card-title">{{ s.title }}</span>
          </div>
          <textarea
            v-if="editing"
            v-model="draft.sectionBodies[s.title]"
            class="fr-edit"
            rows="3"
          ></textarea>
          <p v-else class="fr-prose">{{ draft.sectionBodies[s.title] }}</p>
          <div class="fr-points">
            <div v-for="p in s.points" :key="p.flag" class="fr-point">
              <span class="fr-flag">{{ p.flag }}</span>
              <span class="fr-point-text">{{ p.text }}</span>
              <span class="fr-point-value">{{ p.value }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="fr-actions">
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
      </section>

      <section class="fr-note-sec">
        <div class="fr-actions-head">
          <span class="lr-section-title">추가 코멘트</span>
          <span class="lr-subtitle">리포트에 없는 내용</span>
        </div>
        <textarea
          v-model="userNote"
          class="fr-edit"
          rows="4"
          placeholder="리포트 근거 외에 담당자가 남길 내용을 적으세요."
        ></textarea>
      </section>

      <p class="fr-disclaimer">{{ report.disclaimer }}</p>
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

/* ── Document header ──────────────────────────────────────── */
.fr {
  display: flex;
  flex-direction: column;
  max-width: 1000px;
}
.fr-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 12px 12px;
  border-bottom: 1px solid #eef0f3;
}
.fr-head-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}
.fr-title {
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.1px;
}
.fr-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.fr-meta {
  font-family: var(--clara-mono);
  font-size: 11px;
  color: #8a929c;
}
.fr-badge {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.4px;
  padding: 1px 7px;
  border-radius: 10px;
}
.fr-badge.draft {
  color: #8a929c;
  background: #f1f3f6;
}
.fr-badge.confirmed {
  color: #2c7a4b;
  background: #e6f4ec;
}
.fr-badge.reviewed {
  color: #2f6fed;
  background: #e8f0fe;
}
.fr-review {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid #e2e5ea;
  border-radius: 4px;
  font-size: 11px;
  color: #6b7480;
  cursor: pointer;
  user-select: none;
}
.fr-review input { cursor: pointer; }
.fr-author {
  font-family: var(--clara-mono);
  font-size: 11px;
  color: #4a525c;
}
.fr-confirm {
  height: 26px;
  padding: 0 12px;
  font-size: 11px;
}
.fr-title-input {
  font: inherit;
  font-size: 15px;
  font-weight: 500;
  color: #1c1f24;
  padding: 2px 6px;
  border: 1px solid #bcd0f7;
  border-radius: 4px;
  outline: none;
}
.fr-edit {
  font: inherit;
  font-size: 12.5px;
  line-height: 1.65;
  color: #1c1f24;
  padding: 6px 8px;
  border: 1px solid #bcd0f7;
  border-radius: 4px;
  outline: none;
  resize: vertical;
  width: 100%;
  box-sizing: border-box;
}
.fr-edit-lead { background: #fbfcfe; }

.fr-doc {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 12px 24px;
}
.fr-lead {
  font-size: 12.5px;
  line-height: 1.65;
  color: #4a525c;
  text-wrap: pretty;
}
.fr-prose {
  font-size: 12.5px;
  line-height: 1.65;
  color: #4a525c;
  text-wrap: pretty;
}

/* ── Section cards ────────────────────────────────────────── */
.fr-card {
  display: flex;
  gap: 10px;
  padding: 12px;
  border: 1px solid #eef0f3;
  border-radius: 6px;
}
.fr-card-rail {
  width: 3px;
  border-radius: 2px;
  flex-shrink: 0;
}
.fr-card-body {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
  flex: 1;
}
.fr-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fr-card-title {
  font-size: 13px;
  font-weight: 500;
  color: #1c1f24;
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
