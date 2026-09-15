<script setup>
import { ref, reactive, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { findSavedSet, finalReport, CURRENT_USER } from './data.js'

const props = defineProps({
  pdk: { type: Object, required: true },
  lib: { type: String, required: true },
})

const route = useRoute()
const router = useRouter()

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
const draft = reactive({ title: '', body: '' })

// Document body as an ordered list of blocks: AI-generated sections plus any
// user-added areas. Editing lets the user insert areas between blocks and
// drag blocks to reorder them.
let blockSeq = 0
const blocks = ref([])

function buildBlocks() {
  blocks.value = report.value.sections.map(s => ({
    id: `ai-${blockSeq++}`,
    kind: 'ai',
    source: s.source,
    color: s.color,
    title: s.title,
    points: s.points,
    body: s.body,
  }))
}

function addBlockAt(index) {
  blocks.value.splice(index, 0, { id: `user-${blockSeq++}`, kind: 'user', title: '', body: '' })
}

function removeBlock(index) {
  blocks.value.splice(index, 1)
}

// Native drag-and-drop reorder. The drag handle is the draggable element so it
// doesn't fight with text selection inside the block's textarea.
const dragIndex = ref(-1)
const dragOverIndex = ref(-1)

function onDragStart(i, e) {
  dragIndex.value = i
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onDragEnd() {
  dragIndex.value = -1
  dragOverIndex.value = -1
}
function onDrop(i) {
  const from = dragIndex.value
  if (from < 0 || from === i) return onDragEnd()
  const arr = [...blocks.value]
  const [moved] = arr.splice(from, 1)
  arr.splice(from < i ? i - 1 : i, 0, moved)
  blocks.value = arr
  onDragEnd()
}

// Save records who last saved. Final save opens a 5-day editing window; after
// it the report locks read-only.
const GRACE_DAYS = 5
const GRACE_MS = GRACE_DAYS * 24 * 60 * 60 * 1000
const savedBy = ref('')
const savedAt = ref(null)      // any save (regular or final)
const finalizedAt = ref(null)  // set only by final save; drives grace/lock
const now = ref(Date.now())

const locked = computed(() => finalizedAt.value !== null && now.value - finalizedAt.value > GRACE_MS)
const remainingDays = computed(() =>
  finalizedAt.value ? Math.max(0, Math.ceil((finalizedAt.value + GRACE_MS - now.value) / (24 * 60 * 60 * 1000))) : 0,
)

function fmt(ts) {
  const d = new Date(ts)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
const savedText = computed(() =>
  finalizedAt.value
    ? `저장 ${fmt(finalizedAt.value)} · ${locked.value ? '수정 불가' : `수정 가능 D-${remainingDays.value}`}`
    : '',
)

function toggleEdit() {
  if (locked.value) return
  editing.value = !editing.value
}

function save() {
  if (locked.value) return
  now.value = Date.now()
  savedAt.value = now.value
  savedBy.value = CURRENT_USER
  editing.value = false
}

function finalize() {
  if (locked.value) return
  if (!window.confirm(`최종 저장하면 ${GRACE_DAYS}일 후에는 수정할 수 없습니다. 최종 저장하시겠습니까?`)) return
  now.value = Date.now()
  savedAt.value = now.value
  savedBy.value = CURRENT_USER
  finalizedAt.value = now.value
  editing.value = false
}

// Clicking an action jumps to the tab it points at.
const TAB_KEY = { 'Library Info': 'info', PPA: 'ppa', MW: 'mw' }
function goToTab(tab) {
  const key = TAB_KEY[tab]
  if (key) router.push({ query: { ...route.query, tab: key } })
}

function loadDraft() {
  draft.title = report.value.title
  draft.body = report.value.body
  buildBlocks()
}

function generate() {
  state.value = 'loading'
  setTimeout(() => {
    state.value = 'ready'
    editing.value = false
    savedBy.value = ''
    savedAt.value = null
    finalizedAt.value = null
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
          <span v-if="savedAt" class="fr-author">저장 {{ savedBy }} · {{ fmt(savedAt) }}</span>
        </div>
      </div>
      <button class="lr-btn" type="button" :disabled="locked" @click="toggleEdit">
        {{ editing ? '편집 완료' : '편집' }}
      </button>
      <button v-if="!locked" class="lr-btn fr-confirm" type="button" @click="save">저장</button>
      <button
        v-if="!locked && !finalizedAt"
        class="lr-btn-primary fr-confirm"
        type="button"
        @click="finalize"
      >최종 저장</button>
      <button class="lr-btn" type="button" @click="generate">다시 생성</button>
    </header>

    <div class="fr-doc">
      <div v-if="finalizedAt" class="fr-saved" :class="{ locked }">
        <span class="fr-saved-title">{{ locked ? '수정 기간 만료 · 읽기 전용' : '최종 저장 완료' }}</span>
        <span class="fr-saved-meta">{{ savedText }}</span>
      </div>

      <textarea v-if="editing" v-model="draft.body" class="fr-edit fr-edit-lead" rows="4"></textarea>
      <p v-else class="fr-lead">{{ draft.body }}</p>

      <div class="fr-blocks">
        <template v-for="(b, i) in blocks" :key="b.id">
          <button
            v-if="editing"
            class="fr-insert"
            type="button"
            title="여기에 영역 추가"
            @click="addBlockAt(i)"
          ><span class="fr-insert-bar">+</span></button>

          <section
            class="fr-card"
            :class="{ dragging: dragIndex === i, 'drop-target': dragOverIndex === i && dragIndex !== -1 && dragIndex !== i, user: b.kind === 'user' }"
            @dragover.prevent="dragOverIndex = i"
            @drop="onDrop(i)"
          >
            <span
              v-if="editing"
              class="fr-drag"
              draggable="true"
              title="드래그하여 순서 변경"
              @dragstart="onDragStart(i, $event)"
              @dragend="onDragEnd"
            >⠿</span>
            <span class="fr-card-rail" :style="{ background: b.kind === 'ai' ? b.color : '#c8d0d9' }"></span>
            <div class="fr-card-body">
              <div class="fr-card-head">
                <template v-if="b.kind === 'ai'">
                  <span class="fr-source" :style="{ color: b.color }">{{ b.source }}</span>
                  <span class="fr-card-title">{{ b.title }}</span>
                </template>
                <template v-else>
                  <span class="fr-source fr-source-user">USER</span>
                  <input
                    v-if="editing"
                    v-model="b.title"
                    class="fr-card-title-input"
                    placeholder="영역 제목"
                  />
                  <span v-else class="fr-card-title">{{ b.title || '제목 없음' }}</span>
                </template>
                <div class="lr-spacer"></div>
                <button
                  v-if="editing && b.kind === 'user'"
                  class="fr-block-del"
                  type="button"
                  @click="removeBlock(i)"
                >삭제</button>
              </div>
              <textarea
                v-if="editing"
                v-model="b.body"
                class="fr-edit"
                rows="3"
                :placeholder="b.kind === 'user' ? '리포트에 없는 내용을 이 영역에 적으세요.' : ''"
              ></textarea>
              <p v-else class="fr-prose">{{ b.body }}</p>
              <div v-if="b.kind === 'ai'" class="fr-points">
                <div v-for="p in b.points" :key="p.flag" class="fr-point">
                  <span class="fr-flag">{{ p.flag }}</span>
                  <span class="fr-point-text">{{ p.text }}</span>
                  <span class="fr-point-value">{{ p.value }}</span>
                </div>
              </div>
            </div>
          </section>
        </template>

        <button
          v-if="editing"
          class="fr-insert"
          type="button"
          title="여기에 영역 추가"
          @click="addBlockAt(blocks.length)"
        ><span class="fr-insert-bar">+</span></button>
      </div>

      <section class="fr-actions">
        <div class="fr-actions-head">
          <span class="lr-section-title">짚어볼 지점</span>
          <span class="lr-subtitle">{{ report.actions.length }} items</span>
        </div>
        <div class="lr-box">
          <button
            v-for="a in report.actions"
            :key="a.text"
            class="lr-row g-action fr-action-row"
            type="button"
            :title="`${a.tab} 탭으로 이동`"
            @click="goToTab(a.tab)"
          >
            <span class="fr-sev" :class="a.sev === 'CHECK' ? 'lr-warn' : 'dim'">{{ a.sev }}</span>
            <span class="fr-action-text lr-ellipsis">{{ a.text }}</span>
            <span class="lr-mono lr-num small dim">{{ a.tab }} ↗</span>
            <span class="lr-mono lr-num small">{{ a.owner }}</span>
          </button>
        </div>
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
.lr-btn:disabled,
.lr-btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.fr-edit:disabled {
  background: #f7f8fa;
  color: #8a929c;
  cursor: not-allowed;
}

.fr-saved {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  background: #e6f4ec;
  border: 1px solid #cbe7d6;
}
.fr-saved.locked {
  background: #f5f6f8;
  border-color: #e2e5ea;
}
.fr-saved-title {
  font-size: 12px;
  font-weight: 500;
  color: #2c7a4b;
}
.fr-saved.locked .fr-saved-title { color: #6b7480; }
.fr-saved-meta {
  font-family: var(--clara-mono);
  font-size: 11px;
  color: #8a929c;
}
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

/* ── Section blocks ───────────────────────────────────────── */
.fr-blocks {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Thin insert affordance between blocks: a small bar at rest that grows into
   a "+" button on hover. */
.fr-insert {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 14px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.fr-insert-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 5px;
  border-radius: 3px;
  background: #dfe3e8;
  color: transparent;
  font-size: 13px;
  line-height: 1;
  transition: width 0.12s ease, height 0.12s ease, background 0.12s ease, color 0.12s ease;
}
.fr-insert:hover .fr-insert-bar {
  width: 46px;
  height: 18px;
  background: #2f6fed;
  color: #fff;
}

.fr-card {
  position: relative;
  display: flex;
  gap: 10px;
  padding: 12px;
  border: 1px solid #eef0f3;
  border-radius: 6px;
  background: #fff;
}
.fr-card.user { border-style: dashed; border-color: #d5d9de; }
.fr-card.dragging { opacity: 0.4; }
.fr-card.drop-target { box-shadow: 0 -2px 0 #2f6fed; }

.fr-drag {
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 1px;
  padding: 0 2px;
  color: #b6bec8;
  font-size: 13px;
  line-height: 1.2;
  cursor: grab;
  user-select: none;
}
.fr-drag:active { cursor: grabbing; }

.fr-source-user { color: #a7afb9; }
.fr-card-title-input {
  flex: 1;
  min-width: 0;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: #1c1f24;
  padding: 2px 6px;
  border: 1px solid #bcd0f7;
  border-radius: 4px;
  outline: none;
}
.fr-block-del {
  flex-shrink: 0;
  padding: 2px 8px;
  border: 1px solid #e2e5ea;
  border-radius: 4px;
  background: #fff;
  font: inherit;
  font-size: 11px;
  color: #b4451f;
  cursor: pointer;
}
.fr-block-del:hover { border-color: #e6b8a6; background: #fdf3ef; }
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
.fr-action-row {
  width: 100%;
  border: 0;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.fr-action-row:hover { background: #f1f6ff; }
.fr-action-row:hover .fr-action-text { color: #2f6fed; }
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
