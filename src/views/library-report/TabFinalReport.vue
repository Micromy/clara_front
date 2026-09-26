<script setup>
import { inject, computed } from 'vue'
import { libraryInfo, findSavedSet, mwTable, HEIGHTS } from './data.js'
import { fmt } from './useReportStore.js'

const { state, actions, pdk, family } = inject('report')
const p = computed(() => pdk())
const fam = computed(() => family())

const AREA_META = {
  LIB: { source: 'LIBRARY INFO', color: '#8a929c', title: 'Library Info 요약' },
  PPA: { source: 'PPA', color: '#2f6fed', title: 'PPA 요약' },
  MW: { source: 'MW', color: '#8a929c', title: 'MW 요약' },
}

const mwTableTotal = computed(() => state.mwSets.reduce((a, s) => a + s.tables.length, 0))

const areaDisabled = computed(() => ({
  LIB: null,
  PPA: state.ppaLinkedId ? null : '선택되지 않았습니다 — PPA 탭에서 셋을 저장하세요',
  MW: mwTableTotal.value > 0 ? null : '선택되지 않았습니다 — MW 탭에 테이블을 추가하세요',
}))

const areaSignature = computed(() => ({
  LIB: JSON.stringify({ pdkId: state.pdkId, rows: state.releaseRows, gdsDesc: state.gdsDesc, libDesc: state.libDesc }),
  PPA: JSON.stringify({ linked: state.ppaLinkedId }),
  MW: JSON.stringify(state.mwSets.map(s => ({ tables: s.tables.map(t => ({ pdkId: t.pdkId, lib: t.lib, height: t.height, mwType: t.mwType })) }))),
}))

function buildArea(type) {
  let body, points
  if (type === 'LIB') {
    const info = libraryInfo(state.pdkId, fam.value)
    const gdsSet = [...new Set(info.libraries.flatMap(l => l.release_paths.map(r => r.gds_version)))]
    body = `PDK는 ${p.value.process} 기준이며 HSPICE ${p.value.hspice} / LVS ${p.value.lvs} / PEX ${p.value.pex}로 구성됩니다. family ${fam.value.family}의 library ${info.libraries.length}종에 걸쳐 Release Path와 Cell Design을 정리했습니다.`
    points = [
      { flag: 'LIBS', text: 'family 내 library', value: `${info.libraries.length}종` },
      { flag: 'GDS', text: `GDS version ${gdsSet.join(' / ')}`, value: gdsSet.length > 1 ? '차이 있음' : '동일' },
      { flag: 'DESIGN', text: 'Cell Height별 Drive/VTH/Nanosheet 지원 범위', value: `${HEIGHTS.length} heights` },
    ]
  } else if (type === 'PPA') {
    const s = findSavedSet(state.ppaLinkedId)
    body = `"${s.name}" 셋은 ${s.cells}개 Cell을 ${s.chart} 형태로, Cell × ${s.y} 축으로 저장했습니다. family ${fam.value.family}의 library ${fam.value.libraries.length}종을 비교합니다.`
    points = [
      { flag: 'LIBS', text: 'family 내 비교 library', value: `${fam.value.libraries.length}종` },
      { flag: 'CELLS', text: '저장된 Cell 수', value: String(s.cells) },
      { flag: 'CHART', text: `${s.chart} · Cell × ${s.y}`, value: s.y2 === 'None' ? '단일 축' : '2축' },
      { flag: 'DERIVED', text: 'Derived Metric', value: s.derived ? String(s.derived) : '—' },
    ]
  } else {
    const overCount = state.mwSets.reduce((a, set) => a + set.tables.reduce((b, t) => {
      const d = mwTable(t.pdkId, t.lib, t.height, t.mwType)
      return b + d.rows.reduce((c, r) => c + r.values.filter(v => v.over).length, 0)
    }, 0), 0)
    body = `${state.mwSets.length}개 비교 셋, ${mwTableTotal.value}개 테이블을 기준으로 CK Slope별 setup 값을 비교했습니다. 임계값을 초과한 셀이 ${overCount}건 있습니다.`
    points = [
      { flag: 'SETS', text: '비교 셋', value: `${state.mwSets.length}개` },
      { flag: 'TABLES', text: '테이블', value: `${mwTableTotal.value}개` },
      { flag: 'OVER', text: '임계값 초과 값', value: `${overCount}건` },
    ]
  }
  return { body, points, signature: areaSignature.value[type] }
}

function generate(type) { actions.genArea(type, { areaDisabled: areaDisabled.value, build: buildArea }) }

const areaBlocksByType = computed(() => {
  const out = {}
  ;['LIB', 'PPA', 'MW'].forEach(type => {
    const meta = AREA_META[type]
    const area = state.frAreas[type] || { status: 'empty' }
    const disabled = !!areaDisabled.value[type]
    const ready = area.status === 'ready'
    const stale = ready && area.signature !== areaSignature.value[type]
    out[type] = {
      kind: 'ai', ai: true, areaType: type,
      source: meta.source, color: meta.color, title: meta.title,
      body: ready ? area.body : '', points: ready ? area.points : [],
      ready, showOverlay: !ready, disabled, disabledReason: areaDisabled.value[type],
      enabledEmpty: !disabled && area.status === 'empty', generating: area.status === 'generating',
      stale, showStatus: ready, staleLabel: stale ? '유효하지 않음 · 재생성 필요' : '유효',
      staleColor: stale ? '#b4451f' : '#2c7a4b', staleBg: stale ? '#fdeee7' : '#e6f4ec', staleBorder: stale ? '#f3d3c4' : '#cbe7d6',
      removable: false, borderColor: '#eef0f3', borderStyle: 'solid',
    }
  })
  return out
})

const docAreas = computed(() => state.areaOrder.map((key, i) => {
  const base = areaBlocksByType.value[key] || (() => {
    const u = state.userAreas.find(a => a.id === key)
    if (!u) return null
    return { kind: 'user', ai: false, areaType: key, source: 'USER', color: '#a7afb9', title: u.title, body: u.body,
      ready: true, showOverlay: false, points: [], stale: false, showStatus: false,
      removable: true, borderColor: '#d5d9de', borderStyle: 'dashed', userRef: u }
  })()
  if (!base) return null
  return { ...base, index: i }
}).filter(Boolean))

function onBodyInput(area, e) {
  if (area.kind === 'user') actions.updateUserArea(area.userRef.id, { body: e.target.value })
  else state.frAreas = { ...state.frAreas, [area.areaType]: { ...state.frAreas[area.areaType], body: e.target.value } }
}
function onTitleInput(area, e) {
  if (area.kind === 'user') actions.updateUserArea(area.userRef.id, { title: e.target.value })
}

const finalizeSummary = computed(() => {
  const releaseFilled = state.releaseRows.filter(r => r.path && r.gds).length
  const gdsDescText = state.gdsDesc ? '작성됨' : '미작성'
  const ppaText = state.ppaLinkedId ? `"${findSavedSet(state.ppaLinkedId).name}" 연결됨` : '연결 안 됨'
  return [
    `PPA: ${ppaText}`,
    `MW: 비교 셋 ${state.mwSets.length}개 · 테이블 ${mwTableTotal.value}개`,
    `Library Info: Release Path ${releaseFilled}/${state.releaseRows.length}행 입력 · GDS 설명 ${gdsDescText}`,
  ]
})

const frTitle = computed(() => state.draftTitle || `[${p.value.process}] ${fam.value.family} 리포트 요약`)
const frLead = computed(() => state.draftLead || 'Library Info · PPA · MW 세 탭의 값을 영역별로 요약합니다. 각 영역은 독립적으로 생성되며, 원본 값을 그대로 인용한 것이고 합격·불합격 판정이 아닙니다.')

function finalize() { actions.frFinalize(finalizeSummary.value) }
</script>

<template>
  <div class="tab-final">
    <div class="doc">
      <header class="doc-header">
        <div class="head-main">
          <input v-if="state.frEditing" class="title-input" :value="frTitle" @input="state.draftTitle = $event.target.value" />
          <span v-else class="doc-title">{{ frTitle }}</span>
          <span class="mono sub">PDK {{ p.process }} · {{ fam.family }} · library {{ fam.libraries.length }}종</span>
        </div>
        <button class="btn" @click="actions.toggleFrEdit()">{{ state.frEditing ? '편집 완료' : '편집' }}</button>
        <template v-if="!state.finalizedAt">
          <button class="btn" @click="actions.frSave()">저장</button>
          <button class="btn-primary" @click="finalize()">최종 저장</button>
        </template>
      </header>

      <div class="doc-body">
        <div v-if="state.finalizedAt" class="finalized-banner">
          <span>최종 저장 완료 — PPA 연결·MW 테이블 구성·Library Info가 모두 확정되었습니다</span>
          <span class="mono sub">저장 {{ fmt(state.finalizedAt) }} · 수정 가능 D-5</span>
        </div>
        <div v-else class="summary-box">
          <span class="summary-title">최종 저장 시 확정되는 내용</span>
          <span v-for="s in finalizeSummary" :key="s" class="summary-line">· {{ s }}</span>
        </div>

        <textarea v-if="state.frEditing" class="lead-input" rows="3" :value="frLead" @input="state.draftLead = $event.target.value"></textarea>
        <p v-else class="lead-text">{{ frLead }}</p>

        <div class="areas">
          <template v-for="(a, i) in docAreas" :key="a.areaType">
            <button v-if="state.frEditing" class="insert-btn" @click="actions.addUserArea(i)"><span class="insert-mark">+</span></button>
            <section class="area"
              :style="{ borderStyle: a.borderStyle, borderColor: a.borderColor, opacity: state.dragIndex === i ? 0.4 : 1, boxShadow: (state.dragOverIndex === i && state.dragIndex !== -1 && state.dragIndex !== i) ? '0 -2px 0 #2f6fed' : 'none' }"
              @dragover.prevent="actions.onAreaDragOver(i)" @drop="actions.onAreaDrop(i)">
              <span v-if="state.frEditing" class="drag-handle" draggable="true" @dragstart="actions.onAreaDragStart(i)" @dragend="actions.onAreaDragEnd()">⠿</span>
              <span class="rail" :style="{ background: a.color }"></span>
              <div class="area-body" :style="{ filter: a.showOverlay ? 'blur(3px)' : 'none', pointerEvents: a.showOverlay ? 'none' : 'auto' }">
                <div class="area-head">
                  <span class="mono area-source" :style="{ color: a.color }">{{ a.source }}</span>
                  <input v-if="a.removable && state.frEditing" class="area-title-input" placeholder="영역 제목" :value="a.title" @input="onTitleInput(a, $event)" />
                  <span v-else class="area-title">{{ a.title }}</span>
                  <span v-if="a.showStatus" class="status-badge" :style="{ background: a.staleBg, borderColor: a.staleBorder, color: a.staleColor }">{{ a.staleLabel }}</span>
                  <div class="spacer"></div>
                  <button v-if="a.ready && a.ai" class="btn-mini" @click="generate(a.areaType)">다시 생성</button>
                  <button v-if="a.removable && state.frEditing" class="btn-mini danger" @click="actions.removeUserArea(a.userRef.id)">삭제</button>
                </div>
                <textarea v-if="a.ready && state.frEditing" class="area-body-input" rows="3" :value="a.body" @input="onBodyInput(a, $event)" placeholder="내용을 입력하세요."></textarea>
                <p v-else class="area-body-text">{{ a.body }}</p>
                <div class="points">
                  <div v-for="pt in a.points" :key="pt.flag" class="point-row">
                    <span class="mono point-flag">{{ pt.flag }}</span>
                    <span class="point-text">{{ pt.text }}</span>
                    <span class="mono point-value">{{ pt.value }}</span>
                  </div>
                </div>
              </div>
              <div v-if="a.showOverlay" class="overlay">
                <span v-if="a.disabled" class="disabled-msg">{{ a.disabledReason }}</span>
                <button v-else-if="a.enabledEmpty" class="btn-primary" @click="generate(a.areaType)">AI 초안 생성</button>
                <span v-else-if="a.generating" class="mono generating">생성 중…</span>
              </div>
            </section>
          </template>
          <button v-if="state.frEditing" class="insert-btn" @click="actions.addUserArea(docAreas.length - 1)"><span class="insert-mark">+</span></button>
        </div>

        <p class="disclaimer">요약은 각 탭에 표시된 값만 인용해 생성되며, 합격·불합격 판정을 하지 않습니다. 근거 값은 각 탭에서 직접 확인하세요.</p>
      </div>
    </div>

    <div v-if="state.finalizedAt" class="comments-widget">
      <div v-if="state.commentsOpen" class="comments-panel">
        <div class="comments-head"><span class="strong">댓글</span><span class="mono sub">{{ state.comments.length }}</span></div>
        <div class="comments-list">
          <div v-for="c in state.comments" :key="c.id" class="comment">
            <div class="comment-head">
              <span class="strong">{{ c.author }}</span>
              <span class="mono sub">{{ fmt(c.at) }}</span>
              <div class="spacer"></div>
              <template v-if="state.commentEditId === c.id">
                <button class="btn-mini primary" @click="actions.saveEditComment(c.id)">저장</button>
                <button class="btn-mini" @click="actions.cancelEditComment()">취소</button>
              </template>
              <template v-else>
                <button class="btn-mini" @click="actions.startEditComment(c.id, c.text)">수정</button>
                <button class="btn-mini danger" @click="actions.removeComment(c.id)">삭제</button>
              </template>
            </div>
            <textarea v-if="state.commentEditId === c.id" class="comment-edit" rows="2" :value="state.commentEditDraft" @input="state.commentEditDraft = $event.target.value"></textarea>
            <p v-else class="comment-text">{{ c.text }}</p>
          </div>
        </div>
        <div class="comment-input-row">
          <textarea rows="2" placeholder="댓글을 입력하세요." :value="state.commentDraft" @input="state.commentDraft = $event.target.value"></textarea>
          <button class="btn-primary" @click="actions.addComment()">등록</button>
        </div>
      </div>
      <button class="comments-toggle" @click="actions.toggleComments()">
        <span>댓글</span><span class="count-badge">{{ state.comments.length }}</span>
        <span class="mono sub">{{ state.commentsOpen ? '▴ 접기' : '▾ 펼치기' }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.tab-final { position:relative; height:100%; }
.mono { font-family:'Roboto Mono',monospace; }
.strong { font-weight:500; }
.sub { font-size:10.5px; color:#8a929c; }
.spacer { flex:1; }
.doc { display:flex; flex-direction:column; max-width:1000px; }
.doc-header { display:flex; align-items:flex-start; gap:12px; padding:14px 12px 12px; border-bottom:1px solid #eef0f3; }
.head-main { display:flex; flex-direction:column; gap:5px; flex:1; }
.doc-title { font-size:15px; font-weight:500; letter-spacing:-0.1px; }
.title-input { font:inherit; font-size:15px; font-weight:500; color:#1c1f24; padding:2px 6px; border:1px solid #bcd0f7; border-radius:4px; outline:none; }
.btn { display:flex; align-items:center; height:26px; padding:0 10px; border:1px solid #e2e5ea; border-radius:4px; background:#fff; font:inherit; font-size:11px; color:#6b7480; cursor:pointer; }
.btn-primary { display:flex; align-items:center; justify-content:center; height:26px; padding:0 12px; border:0; border-radius:4px; background:#2f6fed; font:inherit; font-size:11px; font-weight:500; color:#fff; cursor:pointer; }
.doc-body { display:flex; flex-direction:column; gap:10px; padding:12px 12px 24px; }
.finalized-banner { display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:6px; background:#e6f4ec; border:1px solid #cbe7d6; font-size:12px; font-weight:500; color:#2c7a4b; }
.summary-box { display:flex; flex-direction:column; gap:3px; padding:9px 12px; border-radius:6px; background:#f7f8fa; border:1px solid #eef0f3; }
.summary-title { font-size:10px; font-weight:600; letter-spacing:0.4px; text-transform:uppercase; color:#a7afb9; }
.summary-line { font-size:11.5px; color:#4a525c; }
.lead-input { font:inherit; font-size:12.5px; line-height:1.65; color:#1c1f24; padding:6px 8px; border:1px solid #bcd0f7; border-radius:4px; outline:none; resize:vertical; width:100%; background:#fbfcfe; }
.lead-text { font-size:12.5px; line-height:1.65; color:#4a525c; }
.areas { display:flex; flex-direction:column; gap:6px; }
.insert-btn { display:flex; align-items:center; justify-content:center; width:100%; height:14px; padding:0; border:0; background:transparent; cursor:pointer; }
.insert-mark { display:flex; align-items:center; justify-content:center; width:30px; height:5px; border-radius:3px; background:#dfe3e8; color:transparent; }
.area { position:relative; display:flex; gap:10px; padding:12px; border-width:1px; border-radius:6px; background:#fff; overflow:hidden; }
.drag-handle { flex-shrink:0; align-self:flex-start; margin-top:1px; padding:0 2px; color:#b6bec8; font-size:13px; line-height:1.2; cursor:grab; user-select:none; }
.rail { width:3px; border-radius:2px; flex-shrink:0; }
.area-body { display:flex; flex-direction:column; gap:7px; min-width:0; flex:1; }
.area-head { display:flex; align-items:center; gap:8px; }
.area-source { font-size:10px; font-weight:600; letter-spacing:0.6px; }
.area-title { font-size:13px; font-weight:500; color:#1c1f24; }
.area-title-input { flex:1; min-width:0; font:inherit; font-size:13px; font-weight:500; color:#1c1f24; padding:2px 6px; border:1px solid #bcd0f7; border-radius:4px; outline:none; }
.status-badge { flex-shrink:0; font-size:10px; font-weight:600; letter-spacing:0.2px; padding:2px 7px; border-radius:10px; border-width:1px; border-style:solid; }
.btn-mini { flex-shrink:0; padding:2px 8px; border:1px solid #e2e5ea; border-radius:4px; background:#fff; font:inherit; font-size:11px; color:#6b7480; cursor:pointer; }
.btn-mini.danger { color:#b4451f; }
.btn-mini.primary { border:0; background:#2f6fed; color:#fff; font-weight:500; }
.area-body-input { font:inherit; font-size:12.5px; line-height:1.65; color:#1c1f24; padding:6px 8px; border:1px solid #bcd0f7; border-radius:4px; outline:none; resize:vertical; width:100%; }
.area-body-text { font-size:12.5px; line-height:1.65; color:#4a525c; }
.points { display:flex; flex-direction:column; gap:3px; padding-top:2px; }
.point-row { display:flex; align-items:baseline; gap:8px; }
.point-flag { font-size:10.5px; color:#8a929c; width:52px; flex-shrink:0; }
.point-text { flex:1; font-size:12px; line-height:1.6; color:#4a525c; }
.point-value { font-size:11px; color:#8a929c; flex-shrink:0; }
.overlay { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; background:rgba(255,255,255,0.55); }
.disabled-msg { font-size:12px; font-weight:500; color:#b4451f; }
.generating { font-size:11px; color:#8a929c; }
.disclaimer { font-size:11px; line-height:1.6; color:#a7afb9; padding-top:10px; }

.comments-widget { position:fixed; right:20px; bottom:20px; z-index:40; display:flex; flex-direction:column; align-items:flex-end; }
.comments-panel { width:340px; max-height:60vh; display:flex; flex-direction:column; background:#fff; border:1px solid #d5d9de; border-radius:8px; box-shadow:0 10px 32px rgba(20,24,29,0.18); margin-bottom:8px; overflow:hidden; }
.comments-head { display:flex; align-items:center; gap:8px; padding:10px 12px; border-bottom:1px solid #eef0f3; flex-shrink:0; }
.comments-list { display:flex; flex-direction:column; gap:10px; padding:12px; overflow-y:auto; flex:1; min-height:0; }
.comment { display:flex; flex-direction:column; gap:4px; padding-bottom:10px; border-bottom:1px solid #f4f5f7; }
.comment-head { display:flex; align-items:center; gap:8px; }
.comment-edit { font:inherit; font-size:12px; line-height:1.55; color:#1c1f24; padding:5px 7px; border:1px solid #bcd0f7; border-radius:4px; outline:none; resize:vertical; width:100%; }
.comment-text { font-size:12px; line-height:1.55; color:#4a525c; }
.comment-input-row { display:flex; gap:8px; align-items:flex-end; padding:10px 12px; border-top:1px solid #eef0f3; flex-shrink:0; }
.comment-input-row textarea { flex:1; font:inherit; font-size:12px; line-height:1.5; color:#1c1f24; padding:6px 8px; border:1px solid #e2e5ea; border-radius:4px; outline:none; resize:vertical; }
.comments-toggle { display:flex; align-items:center; gap:7px; height:38px; padding:0 14px; border:1px solid #d5d9de; border-radius:19px; background:#fff; box-shadow:0 6px 18px rgba(20,24,29,0.14); font:inherit; font-size:12.5px; font-weight:500; color:#1c1f24; cursor:pointer; }
.count-badge { display:flex; align-items:center; justify-content:center; min-width:16px; height:16px; padding:0 4px; border-radius:8px; background:#2f6fed; font-family:'Roboto Mono',monospace; font-size:10px; font-weight:600; color:#fff; }
</style>
