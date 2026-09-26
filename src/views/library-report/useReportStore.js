import { reactive } from 'vue'
import { PDKS, FAMILIES, HEIGHTS, MW_TYPES, findPdk, findFamily, CURRENT_USER } from './data.js'

let nextTableId = 1
let nextSetId = 1
let nextReleaseId = 4

function makeFamilySet(family, pdkId) {
  const libs = family.libraries.map(l => l.library)
  return {
    id: nextSetId++,
    open: true,
    tables: libs.slice(0, 2).map((lib, i) => ({
      id: nextTableId++, pdkId, lib, height: HEIGHTS[i % HEIGHTS.length], mwType: MW_TYPES[0],
    })),
  }
}

export function fmt(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function createReportStore() {
  const fam0 = FAMILIES[0]
  const state = reactive({
    pdkId: 'p1', familyName: fam0.family, pdkMenuOpen: false, tab: 'info',
    mwSets: [makeFamilySet(fam0, 'p1')],
    picking: null, pickPdk: 'p1', pickLib: fam0.libraries[0].library, pickHeight: HEIGHTS[0], pickMwType: MW_TYPES[0],
    ppaSetId: null, ppaLinkedId: null, diff: false, refLibrary: fam0.libraries[0].library,
    infoEditing: false, gdsDesc: '', libDesc: {},
    releaseRows: [
      { id: 1, height: 'CH120', path: '', gds: '' },
      { id: 2, height: 'CH150', path: '', gds: '' },
      { id: 3, height: 'CH180', path: '', gds: '' },
    ],
    frAreas: {}, savedBy: '', savedAt: null, finalizedAt: null,
    frEditing: false, draftTitle: '', draftLead: '', areaOrder: ['LIB', 'PPA', 'MW'], userAreas: [],
    dragIndex: -1, dragOverIndex: -1,
    commentsOpen: false, comments: [], commentDraft: '', commentEditId: null, commentEditDraft: '',
  })

  const pdk = () => findPdk(state.pdkId)
  const family = () => findFamily(state.familyName)

  const actions = {
    setPdk(id) { state.pdkId = id; state.pdkMenuOpen = false },
    togglePdkMenu() { state.pdkMenuOpen = !state.pdkMenuOpen },
    setFamily(name) {
      const fam = findFamily(name)
      state.familyName = fam.family
      state.mwSets = [makeFamilySet(fam, state.pdkId)]
      state.picking = null
      state.refLibrary = fam.libraries[0].library
      state.diff = false
      state.frAreas = {}
      state.savedBy = ''; state.savedAt = null; state.finalizedAt = null
      state.frEditing = false
      state.areaOrder = ['LIB', 'PPA', 'MW']
      state.userAreas = []
      state.commentsOpen = false; state.comments = []; state.commentDraft = ''
      state.commentEditId = null; state.commentEditDraft = ''
    },

    // Library Info
    toggleInfoEdit() { state.infoEditing = !state.infoEditing },
    addReleaseRowInGroup(height) {
      const rows = state.releaseRows
      let idx = -1
      rows.forEach((r, i) => { if (r.height === height) idx = i })
      rows.splice(idx + 1, 0, { id: nextReleaseId++, height, path: '', gds: '' })
    },
    removeReleaseRow(id) { state.releaseRows = state.releaseRows.filter(r => r.id !== id) },
    updateReleaseRow(id, patch) {
      const r = state.releaseRows.find(x => x.id === id)
      if (r) Object.assign(r, patch)
    },
    setLibDesc(lib, text) { state.libDesc[lib] = text },

    // MW
    mwToggleAll() { const open = state.mwSets.every(x => !x.open); state.mwSets.forEach(x => { x.open = open }) },
    mwAddSet() { state.mwSets.push(makeFamilySet(family(), state.pdkId)); state.picking = null },
    duplicateSet(set) {
      const tables = set.tables.map(t => ({ ...t, id: nextTableId++ }))
      state.mwSets.push({ ...set, id: nextSetId++, tables })
    },
    removeSet(id) { state.mwSets = state.mwSets.filter(x => x.id !== id) },
    removeTable(setId, tableId) {
      const set = state.mwSets.find(s => s.id === setId)
      if (set && set.tables.length > 1) set.tables = set.tables.filter(t => t.id !== tableId)
    },
    openPicker(set) {
      const libs = family().libraries.map(l => l.library)
      const last = set.tables.length ? set.tables[set.tables.length - 1] : null
      state.picking = set.id
      state.pickPdk = state.pdkId
      state.pickLib = libs[(libs.indexOf(last ? last.lib : libs[0]) + 1) % libs.length]
      state.pickHeight = last ? last.height : HEIGHTS[0]
      state.pickMwType = last ? last.mwType : MW_TYPES[0]
    },
    cancelPick() { state.picking = null },
    confirmAdd(setId) {
      const set = state.mwSets.find(s => s.id === setId)
      if (!set) return
      set.open = true
      set.tables.push({ id: nextTableId++, pdkId: state.pickPdk, lib: state.pickLib, height: state.pickHeight, mwType: state.pickMwType })
      state.picking = null
    },
    exportCsv(t, data) {
      const rows = [['cell', ...data.subCols.map(c => c.label)], ...data.rows.map(r => [r.cell, ...r.values.map(v => v.v)])]
      const blob = new Blob(['\ufeff' + rows.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `mw_${t.lib}_${findPdk(t.pdkId).process}_${t.height}_${t.mwType}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    },

    // PPA
    linkSet(id) { state.ppaSetId = id },
    saveChartToReport() { state.ppaLinkedId = state.ppaSetId },
    setRefLibrary(lib) { state.refLibrary = lib },
    toggleDiff() { state.diff = !state.diff },

    // Final Report
    genArea(type, ctx) {
      if (ctx.areaDisabled[type]) return
      state.frAreas = { ...state.frAreas, [type]: { status: 'generating' } }
      setTimeout(() => {
        const { body, points, signature } = ctx.build(type)
        state.frAreas = { ...state.frAreas, [type]: { status: 'ready', body, points, signature } }
      }, 700)
    },
    toggleFrEdit() {
      if (state.frEditing) { state.frEditing = false; return }
      state.frEditing = true
      if (!state.draftTitle) state.draftTitle = `[${pdk().process}] ${state.familyName} 리포트 요약`
      if (!state.draftLead) state.draftLead = 'Library Info · PPA · MW 세 탭의 값을 영역별로 요약합니다. 각 영역은 독립적으로 생성되며, 원본 값을 그대로 인용한 것이고 합격·불합격 판정이 아닙니다.'
    },
    addUserArea(afterIndex) {
      const area = { id: `u-${Date.now()}`, title: '', body: '' }
      state.userAreas.push(area)
      state.areaOrder.splice(afterIndex + 1, 0, area.id)
    },
    updateUserArea(id, patch) {
      const a = state.userAreas.find(x => x.id === id)
      if (a) Object.assign(a, patch)
    },
    removeUserArea(id) {
      state.userAreas = state.userAreas.filter(a => a.id !== id)
      state.areaOrder = state.areaOrder.filter(k => k !== id)
    },
    onAreaDragStart(i) { state.dragIndex = i },
    onAreaDragEnd() { state.dragIndex = -1; state.dragOverIndex = -1 },
    onAreaDragOver(i) { state.dragOverIndex = i },
    onAreaDrop(i) {
      const from = state.dragIndex
      if (from < 0 || from === i) { state.dragIndex = -1; state.dragOverIndex = -1; return }
      const order = [...state.areaOrder]
      const [moved] = order.splice(from, 1)
      order.splice(from < i ? i - 1 : i, 0, moved)
      state.areaOrder = order
      state.dragIndex = -1; state.dragOverIndex = -1
    },
    frSave() { state.savedAt = Date.now(); state.savedBy = CURRENT_USER },
    frFinalize(summaryLines) {
      const msg = `최종 저장은 현재 상태를 모두 확정합니다 — 이후 되돌리려면 재생성이 필요합니다.\n\n${summaryLines.join('\n')}\n\n5일 후에는 수정할 수 없습니다. 최종 저장하시겠습니까?`
      if (!window.confirm(msg)) return
      const now = Date.now()
      state.savedAt = now; state.savedBy = CURRENT_USER; state.finalizedAt = now; state.frEditing = false
    },

    // Comments
    toggleComments() { state.commentsOpen = !state.commentsOpen },
    addComment() {
      const text = state.commentDraft.trim()
      if (!text) return
      state.comments.push({ id: `c-${Date.now()}`, author: CURRENT_USER, text, at: Date.now() })
      state.commentDraft = ''
    },
    startEditComment(id, text) { state.commentEditId = id; state.commentEditDraft = text },
    saveEditComment(id) {
      const text = state.commentEditDraft.trim()
      if (!text) return
      const c = state.comments.find(x => x.id === id)
      if (c) c.text = text
      state.commentEditId = null; state.commentEditDraft = ''
    },
    cancelEditComment() { state.commentEditId = null; state.commentEditDraft = '' },
    removeComment(id) { state.comments = state.comments.filter(c => c.id !== id) },
  }

  return { state, actions, pdk, family }
}

export { PDKS, FAMILIES }
