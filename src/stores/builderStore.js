import { defineStore } from 'pinia'
import { ref, computed, watch, nextTick } from 'vue'
import {
  fetchColumnConfig, fetchCellTypes, fetchPdks, fetchLibraries, fetchMetrics,
  fetchMeta, fetchSimFF, fetchSimICG,
  fetchPresets as apiFetchPresets, createPreset as apiCreatePreset, deletePreset as apiDeletePreset,
  fetchCharts as apiFetchCharts, createChart as apiCreateChart, deleteChart as apiDeleteChart
} from '../api/cells.js'

const STORAGE_KEY = 'clara-builder-state'

// TODO: 로그인 시스템 도입 후 실제 사용자 ID로 교체
const CURRENT_USER = 'anonymous'

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function savePersistedState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* quota exceeded etc */ }
}

// Operating-condition fields (shared across cell types) usable as derived-formula operands.
// vth / gateLength / cpp are now string-typed in the data, so excluded from arithmetic.
const OPERATING_CONDITION_FIELDS = [
  { value: 'vdd',         label: 'VDD (V)' },
  { value: 'temperature', label: 'Temperature (°C)' }
]

// Build DERIVED_FIELDS dynamically from the simulation columns of the given cellType.
// Falls back to operating-condition fields only if cellType is null/unknown.
export function buildDerivedFields(cellType, config) {
  const simCols = config?.selectedCellsSimulationColumns?.[cellType] || []
  const simFields = simCols
    .filter(c => c.numeric)
    .map(c => ({ value: c.prop, label: c.label }))
  return [...simFields, ...OPERATING_CONDITION_FIELDS]
}

export const DERIVED_OPS = [
  { value: '+', label: '+' },
  { value: '-', label: '−' },
  { value: '*', label: '×' },
  { value: '/', label: '÷' }
]

// Formula types: binary, unary, stat-based, group-based
export const FORMULA_TYPES = [
  { value: 'binary',     label: 'Binary Arithmetic', desc: 'A  op  B' },
  { value: 'unary',      label: 'Math Function',      desc: 'f(field)' },
  { value: 'normalize',  label: 'Z-score',            desc: '(x − μ) / σ' },
  { value: 'relative',   label: 'Relative to Mean',   desc: 'x / μ' },
  { value: 'delta_mean', label: 'Delta from Mean',    desc: 'x − μ' },
  { value: 'pct_max',    label: '% of Max',           desc: 'x / max × 100' },
  { value: 'mean',       label: 'Group Mean',          desc: 'μ within group' },
  { value: 'std',        label: 'Group Std Dev',       desc: 'σ within group' }
]

// Fields available as grouping keys for group-based formulas
export const GROUP_BY_OPTIONS = [
  { value: 'alias',         label: 'Alias' },
  { value: 'cellType',      label: 'Cell Type' },
  { value: 'driveStrength', label: 'Drive Strength' },
  { value: 'library',       label: 'Library' },
  { value: 'feol',          label: 'FEOL' }
]

export const UNARY_FNS = [
  { value: 'log10',      label: 'log₁₀(x)' },
  { value: 'ln',         label: 'ln(x)' },
  { value: 'sqrt',       label: '√x' },
  { value: 'abs',        label: '|x|' },
  { value: 'reciprocal', label: '1/x' }
]

function computeGroupStats(cells, field) {
  const vals = cells.map(c => c[field]).filter(v => typeof v === 'number')
  if (!vals.length) return { mean: 0, std: 0, max: 0, min: 0 }
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const std = vals.length > 1
    ? Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length)
    : 0
  return { mean, std, max: Math.max(...vals), min: Math.min(...vals) }
}

function computeDerivedValue(cell, df, stats) {
  switch (df.type) {
    case 'binary': {
      const a = cell[df.field1], b = cell[df.field2]
      if (typeof a !== 'number' || typeof b !== 'number') return null
      switch (df.op) {
        case '+': return a + b
        case '-': return a - b
        case '*': return a * b
        case '/': return b === 0 ? null : a / b
      }
      break
    }
    case 'unary': {
      const x = cell[df.field]
      if (typeof x !== 'number') return null
      switch (df.fn) {
        case 'log10':      return x > 0 ? Math.log10(x) : null
        case 'ln':         return x > 0 ? Math.log(x) : null
        case 'sqrt':       return x >= 0 ? Math.sqrt(x) : null
        case 'abs':        return Math.abs(x)
        case 'reciprocal': return x === 0 ? null : 1 / x
      }
      break
    }
    case 'mean': return stats?.mean ?? null
    case 'std':  return stats?.std ?? null
    default: {
      const x = cell[df.field]
      if (typeof x !== 'number' || !stats) return null
      const { mean, std, max } = stats
      switch (df.type) {
        case 'normalize':  return std === 0 ? 0 : (x - mean) / std
        case 'relative':   return mean === 0 ? null : x / mean
        case 'delta_mean': return x - mean
        case 'pct_max':    return max === 0 ? null : (x / max) * 100
      }
    }
  }
  return null
}

export function formulaDesc(df, derivedFields = []) {
  const fl = v => derivedFields.find(f => f.value === v)?.label ?? v
  const ol = v => DERIVED_OPS.find(o => o.value === v)?.label ?? v
  const fnl = v => UNARY_FNS.find(f => f.value === v)?.label ?? v
  const gl = v => GROUP_BY_OPTIONS.find(g => g.value === v)?.label ?? (v ?? 'alias')
  switch (df.type) {
    case 'binary':     return `${fl(df.field1)} ${ol(df.op)} ${fl(df.field2)}`
    case 'unary':      return `${fnl(df.fn)} of ${fl(df.field)}`
    case 'normalize':  return `Z-score of ${fl(df.field)}`
    case 'relative':   return `${fl(df.field)} / μ`
    case 'delta_mean': return `${fl(df.field)} − μ`
    case 'pct_max':    return `${fl(df.field)} / max × 100`
    case 'mean':       return `μ of ${fl(df.field)} (by ${gl(df.groupBy)})`
    case 'std':        return `σ of ${fl(df.field)} (by ${gl(df.groupBy)})`
    default:           return ''
  }
}

let nextDerivedId = 1

// ── Label template ────────────────────────────────────────────────────────
// Each cell's display label is computed from an ordered list of tokens.
// Token types:
//   { type: 'field', field: 'driveStr' }   → cell[field]
//   { type: 'tag' }                         → per-cell user-entered tag
// Tokens are joined with '_'; empty values are dropped so labels never
// carry stray separators.
export const LABEL_TOKEN_TYPES = ['field', 'tag']
const LABEL_SEPARATOR = '_'

export function computeLabel(template, cell, tagValue = '') {
  if (!Array.isArray(template) || template.length === 0) return ''
  return template.map(tok => {
    if (!tok || typeof tok !== 'object') return ''
    if (tok.type === 'field') {
      const v = cell?.[tok.field]
      return v == null ? '' : String(v)
    }
    if (tok.type === 'tag') return tagValue ?? ''
    return ''
  }).filter(s => s !== '').join(LABEL_SEPARATOR)
}

function defaultLabelTemplate() {
  return [{ type: 'tag' }]
}

// ── CSV serialization for backend group_by VARCHAR ─────────────────────
const LABEL_TAG_SENTINEL = '__tag__'

function templateToCsv(template) {
  if (!Array.isArray(template) || template.length === 0) return ''
  return template
    .map(t => t?.type === 'tag' ? LABEL_TAG_SENTINEL : (t?.field || ''))
    .filter(Boolean)
    .join(',')
}

function csvToTemplate(csv) {
  if (!csv || typeof csv !== 'string') return []
  return csv.split(',').map(s => s.trim()).filter(Boolean).map(s =>
    s === LABEL_TAG_SENTINEL ? { type: 'tag' } : { type: 'field', field: s }
  )
}

// Cell type options are loaded dynamically from /clara/cell/type/ at init.
// `cellType` on each cell remains the string ('FF', 'ICG', …) — only the
// dropdown source changes.

function cellMatchesCategory(cell, category) {
  return cell.cellType === category
}

function createEmptySearch() {
  return {
    cellType: null,                 // 'FF' | 'ICG' | null
    query: '',                      // cellName partial match
    columnFilters: {},              // { [columnKey]: string[] }  — empty/absent = all
    pdk: null,                      // single PDK filter
    libraries: []                   // multiple library filter
  }
}

export const useBuilderStore = defineStore('builder', () => {
  const metaCells = ref([])          // 서버 검색 결과 (메타데이터만)
  const simulations = ref({})        // cellId → 시뮬 데이터 (캐시)
  const config = ref(null)           // column-config.json (UI 레이아웃)
  const cellTypes = ref([])          // GET /clara/cell/type/
  const pdks = ref([])               // GET /clara/pdk/
  const libraries = ref([])          // GET /clara/lib/
  const metrics = ref([])            // GET /clara/metric/
  const loading = ref(false)
  const restoringSessionState = ref(false)
  const error = ref(null)
  let initPromise = null

  // ── Cell search: pending (user is editing) vs applied (committed on Search click) ──
  const pendingSearch = ref(createEmptySearch())
  const appliedSearch = ref(createEmptySearch())
  const searchDirty = ref(false)    // true when pending diverges from applied
  const restoringSearch = ref(false) // true during builder switch restore

  // Restore persisted builder state (before first render)
  const _saved = loadPersistedState()

  function ensureBuilderShape(b) {
    if (!b.search) b.search = { pending: createEmptySearch(), applied: createEmptySearch() }
    if (!Array.isArray(b.labelTemplate)) {
      b.labelTemplate = defaultLabelTemplate()
    } else {
      // Drop legacy literal tokens; rename note → tag for older payloads.
      b.labelTemplate = b.labelTemplate
        .filter(t => t?.type === 'field' || t?.type === 'note' || t?.type === 'tag')
        .map(t => t.type === 'note' ? { type: 'tag' } : t)
    }
    if (b.chartConfig) {
      // Migrate away from removed `grouping` field
      if ('grouping' in b.chartConfig) delete b.chartConfig.grouping
      // Migrate stale categorical xAxis values (only meaningful on bar charts)
      if (b.chartConfig.chartType === 'bar') {
        if (b.chartConfig.xAxis === 'alias')         b.chartConfig.xAxis = '__label__'
        if (b.chartConfig.xAxis === 'driveStrength') b.chartConfig.xAxis = 'driveStr'
        if (b.chartConfig.xAxis === 'nanosheet')     b.chartConfig.xAxis = 'nanoSheet'
      }
    }
    return b
  }

  const builders = ref(
    (_saved?.builders ?? [
      { id: 1, name: 'Untitled', selectedCellIds: [], chartConfig: createDefaultChartConfig(), derivedFormulas: [], labelTemplate: defaultLabelTemplate() }
    ]).map(ensureBuilderShape)
  )
  const activeBuilderIndex = ref(
    _saved?.activeBuilderIndex != null
      ? Math.min(_saved.activeBuilderIndex, (_saved.builders?.length ?? 1) - 1)
      : 0
  )
  const activeSubTab = ref('builder')
  let nextBuilderId = _saved?.builders
    ? Math.max(..._saved.builders.map(b => b.id), 1) + 1
    : 2

  // Sync nextDerivedId from restored builders so IDs don't collide
  if (_saved?.builders) {
    const allFormulas = _saved.builders.flatMap(b => b.derivedFormulas ?? [])
    if (allFormulas.length) nextDerivedId = Math.max(...allFormulas.map(f => f.id), 0) + 1
  }

  const chartTabs = ref([])

  function saveSearchToBuilder() {
    const b = builders.value[activeBuilderIndex.value]
    if (b) {
      b.search = {
        pending: { ...pendingSearch.value, columnFilters: { ...pendingSearch.value.columnFilters }, libraries: [...pendingSearch.value.libraries] },
        applied: { ...appliedSearch.value, columnFilters: { ...appliedSearch.value.columnFilters }, libraries: [...appliedSearch.value.libraries] }
      }
    }
  }

  function restoreSearchFromBuilder() {
    restoringSearch.value = true
    const b = builders.value[activeBuilderIndex.value]
    if (b?.search) {
      pendingSearch.value = { ...b.search.pending, columnFilters: { ...b.search.pending.columnFilters }, libraries: [...b.search.pending.libraries] }
      appliedSearch.value = { ...b.search.applied, columnFilters: { ...b.search.applied.columnFilters }, libraries: [...b.search.applied.libraries] }
    } else {
      pendingSearch.value = createEmptySearch()
      appliedSearch.value = createEmptySearch()
    }
    searchDirty.value = false
    if (initPromise && b?.selectedCellIds?.length) {
      hydrateBuilderSelections(b).catch(err => {
        console.error('[builderStore] failed to restore builder selections:', err)
      })
    }
    nextTick(() => { restoringSearch.value = false })
  }

  async function restoreVisibleSessionState() {
    const b = builders.value[activeBuilderIndex.value]
    if (!b?.selectedCellIds?.length) return
    restoringSessionState.value = true
    try {
      await hydrateBuilderSelections(b)
    } finally {
      restoringSessionState.value = false
    }
  }

  // Restore search state from the active builder on load
  restoreSearchFromBuilder()

  // Swap search state when switching builders
  watch(activeBuilderIndex, (_newIdx, oldIdx) => {
    const oldBuilder = builders.value[oldIdx]
    if (oldBuilder) {
      oldBuilder.search = {
        pending: { ...pendingSearch.value, columnFilters: { ...pendingSearch.value.columnFilters }, libraries: [...pendingSearch.value.libraries] },
        applied: { ...appliedSearch.value, columnFilters: { ...appliedSearch.value.columnFilters }, libraries: [...appliedSearch.value.libraries] }
      }
    }
    restoreSearchFromBuilder()
  })

  function createDefaultChartConfig(cellType) {
    const ct = cellType || appliedSearch.value?.cellType || 'FF'
    const metricOpts = metrics.value.filter(m => m.cellType === ct)
    const firstRaw = metricOpts.find(m => m.formulaType === 'raw')
    return {
      chartType: 'scatter',
      chartTypeSecondary: null,
      xAxis: firstRaw?.metricId || null,
      yAxisPrimary: firstRaw?.metricId || null,
      yAxisSecondary: null
    }
  }

  async function init() {
    if (initPromise) return initPromise
    loading.value = true
    error.value = null
    initPromise = Promise.all([
      fetchColumnConfig(),
      fetchCellTypes(),
      fetchPdks(),
      fetchLibraries(),
      fetchMetrics(),
      apiFetchPresets(),
      apiFetchCharts()
    ])
      .then(([cfg, cellTypeList, pdkList, libList, metricList, presetList, chartList]) => {
        config.value = cfg
        cellTypes.value = cellTypeList
        pdks.value = pdkList
        libraries.value = libList
        metrics.value = metricList
        chartPresets.value = presetList
        savedCharts.value = chartList
      })
      .then(() => restoreVisibleSessionState())
      .catch((err) => {
        error.value = err
        console.error('[builderStore] init failed:', err)
        throw err
      })
      .finally(() => {
        loading.value = false
      })
    return initPromise
  }

  const activeBuilder = computed(() => builders.value[activeBuilderIndex.value])

  function mergeMetaCells(rows) {
    if (!rows?.length) return
    const map = new Map(metaCells.value.map(c => [c.id, c]))
    rows.forEach(row => {
      map.set(row.id, { ...(map.get(row.id) || {}), ...row })
    })
    metaCells.value = Array.from(map.values())
  }

  async function ensureMetaForCells(cellIds) {
    const existing = new Set(metaCells.value.map(c => c.id))
    const missing = cellIds.filter(id => !existing.has(id))
    if (!missing.length) return
    const rows = await fetchMeta({ cellIds: missing })
    mergeMetaCells(rows)
  }

  async function hydrateBuilderSelections(builder) {
    const ids = builder?.selectedCellIds || []
    if (!ids.length) return
    const cellType = builder?.search?.applied?.cellType || builder?.search?.pending?.cellType || appliedSearch.value.cellType
    await ensureMetaForCells(ids)
    await fetchSimForCells(ids, cellType)
  }

  const selectedCells = computed(() => {
    if (!activeBuilder.value) return []
    const ids = activeBuilder.value.selectedCellIds
    const formulas = activeBuilder.value.derivedFormulas || []
    const template = activeBuilder.value.labelTemplate || []
    const builderId = activeBuilder.value.id

    // Pass 1: merge base + simulation data, then attach computed label
    const cellMap = new Map(metaCells.value.map(c => [c.id, c]))
    const baseCells = ids
      .filter(id => cellMap.has(id))
      .map(id => {
        const merged = { ...cellMap.get(id), ...(simulations.value[id] || {}) }
        merged.label = computeLabel(template, merged, getCellAlias(builderId, id))
        return merged
      })

    if (formulas.length === 0) return baseCells

    // Pre-compute overall group stats for stat-based formulas (normalize, relative, delta_mean, pct_max)
    const groupStats = {}
    formulas
      .filter(df => !['binary', 'unary', 'mean', 'std'].includes(df.type))
      .forEach(df => { groupStats[df.id] = computeGroupStats(baseCells, df.field) })

    // Pre-compute per-group stats for mean/std formulas
    // groupStatsMap[formulaId] = Map<groupKey, { mean, std }>
    const groupStatsMap = {}
    formulas.filter(df => df.type === 'mean' || df.type === 'std').forEach(df => {
      const byGroup = new Map()
      baseCells.forEach(c => {
        const gKey = String(c[df.groupBy ?? 'label'] ?? '')
        if (!byGroup.has(gKey)) byGroup.set(gKey, [])
        const v = c[df.field]
        if (typeof v === 'number') byGroup.get(gKey).push(v)
      })
      const statsMap = new Map()
      byGroup.forEach((vals, gKey) => {
        if (!vals.length) { statsMap.set(gKey, { mean: null, std: null }); return }
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length
        const std = vals.length > 1
          ? Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length)
          : 0
        statsMap.set(gKey, { mean, std })
      })
      groupStatsMap[df.id] = statsMap
    })

    // Pass 2: apply derived formulas per cell
    return baseCells.map(c => {
      const merged = { ...c }
      formulas.forEach(df => {
        let stats = groupStats[df.id]
        if (df.type === 'mean' || df.type === 'std') {
          const gKey = String(c[df.groupBy ?? 'label'] ?? '')
          stats = groupStatsMap[df.id]?.get(gKey)
        }
        merged[`__df_${df.id}`] = computeDerivedValue(c, df, stats)
      })
      return merged
    })
  })

  // ── Search / filter logic ────────────────────────────────────────────────
  const canSearch = computed(() =>
    !!pendingSearch.value.cellType &&
    !!pendingSearch.value.pdk &&
    pendingSearch.value.libraries.length > 0
  )

  function setPendingCellType(v) {
    pendingSearch.value.cellType = v
    searchDirty.value = true
    applySearch()
  }
  function setPendingQuery(v) {
    pendingSearch.value.query = v
    searchDirty.value = true
    applySearch()
  }
  function setPendingColumnFilter(columnKey, values) {
    if (!values || values.length === 0) {
      delete pendingSearch.value.columnFilters[columnKey]
    } else {
      pendingSearch.value.columnFilters[columnKey] = [...values]
    }
    // force reactivity on nested object key changes
    pendingSearch.value = { ...pendingSearch.value, columnFilters: { ...pendingSearch.value.columnFilters } }
    searchDirty.value = true
    applySearch()
  }
  function setPendingPdk(v) {
    pendingSearch.value.pdk = v
    searchDirty.value = true
    applySearch()
  }
  function setPendingLibraries(v) {
    pendingSearch.value.libraries = v
    searchDirty.value = true
    applySearch()
  }
  function clearPendingColumnFilter(columnKey) {
    setPendingColumnFilter(columnKey, [])
  }

  function applySearch() {
    if (!canSearch.value) {
      appliedSearch.value = { ...appliedSearch.value, libraries: [], pdk: pendingSearch.value.pdk }
      return false
    }
    appliedSearch.value = {
      cellType: pendingSearch.value.cellType,
      query: pendingSearch.value.query,
      columnFilters: { ...pendingSearch.value.columnFilters },
      pdk: pendingSearch.value.pdk,
      libraries: [...pendingSearch.value.libraries]
    }
    searchDirty.value = false
    return true
  }

  function resetSearch() {
    pendingSearch.value = createEmptySearch()
    appliedSearch.value = createEmptySearch()
    searchDirty.value = false
  }

  // Distinct values for a column based on current filtered rows (excluding columnFilters)
  function columnFilterOptions(columnKey) {
    const set = new Set()
    for (const c of preColumnFilteredCells.value) {
      const v = c[columnKey]
      if (v !== undefined && v !== null && v !== '') set.add(String(v))
    }
    return Array.from(set).sort((a, b) => {
      const na = Number(a), nb = Number(b)
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
      return a.localeCompare(b)
    })
  }

  // Cell type dropdown options from API
  const cellTypeOptions = computed(() =>
    cellTypes.value.map(t => ({ value: t.cellType, label: t.cellType, id: t.id }))
  )

  // PDK dropdown options from API
  const pdkOptions = computed(() =>
    pdks.value.map(p => {
      const label = `[${p.process}] HSPICE: ${p.hspice} / LVS: ${p.lvs} / PEX: ${p.pex}`
      return { id: p.id, label }
    })
  )

  // Library dropdown options from API
  const libraryOptions = computed(() =>
    libraries.value.map(l => ({ id: l.id, label: l.library || l.lib }))
  )

  function batchSetAlias(builderId, cellIds, alias) {
    cellIds.forEach(id => { cellAliases.value[`${builderId}-${id}`] = alias })
  }

  // Fetch metadata from API when search conditions change
  const searching = ref(false)
  let fetchMetaAbort = null
  async function performMetaSearch() {
    const s = appliedSearch.value
    if (!s.cellType || !s.pdk || s.libraries.length === 0) {
      metaCells.value = []
      return
    }
    if (fetchMetaAbort) fetchMetaAbort.abort()
    fetchMetaAbort = new AbortController()
    searching.value = true
    try {
      const data = await fetchMeta({
        cellType: s.cellType,
        pdkId: s.pdk,
        libIds: s.libraries
      })
      metaCells.value = data
    } catch (err) {
      if (err.name !== 'AbortError') console.error('[builderStore] fetchMeta failed:', err)
    } finally {
      searching.value = false
    }
  }

  // Watch appliedSearch to trigger API call
  watch(appliedSearch, () => {
    if (!restoringSearch.value) performMetaSearch()
  }, { deep: true })

  // Pre-column-filter stage: metaCells + query filter (client-side)
  const preColumnFilteredCells = computed(() => {
    const s = appliedSearch.value
    if (!s.cellType || !s.pdk || s.libraries.length === 0) return []
    const terms = (s.query || '').toLowerCase().split(/[\s,]+/).filter(Boolean)
    if (!terms.length) return metaCells.value
    return metaCells.value.filter(cell => {
      return terms.every(t => cell.cellName.toLowerCase().includes(t))
    })
  })

  // Final filtered cells: preColumnFilteredCells + columnFilters
  const filteredCells = computed(() => {
    const s = appliedSearch.value
    const colFilters = Object.entries(s.columnFilters || {})
    if (colFilters.every(([, vals]) => !vals || !vals.length)) return preColumnFilteredCells.value
    return preColumnFilteredCells.value.filter(cell => {
      for (const [key, vals] of colFilters) {
        if (!vals || !vals.length) continue
        if (!vals.includes(String(cell[key]))) return false
      }
      return true
    })
  })

  const CELL_PADDING = 24
  const MIN_COL_WIDTH = 50
  const CHAR_WIDTH_SEARCH = 8
  const CHAR_WIDTH_SELECTED = 7

  function calcAutoWidth(key, cells, charWidth) {
    let maxContent = 0
    const len = Math.min(cells.length, 200)
    for (let i = 0; i < len; i++) {
      const v = cells[i][key]
      if (v != null) {
        const w = String(v).length
        if (w > maxContent) maxContent = w
      }
    }
    return Math.max(maxContent * charWidth + CELL_PADDING, MIN_COL_WIDTH)
  }

  const searchTableColumns = computed(() => {
    const cols = config.value?.searchTableColumns ?? []
    const cells = filteredCells.value
    return cols.map(col => ({
      ...col,
      autoWidth: cells.length
        ? Math.max(calcAutoWidth(col.key, cells, CHAR_WIDTH_SEARCH), col.width || 0)
        : col.width || 0
    }))
  })

  const selectedCellsMetadataColumns = computed(() => {
    const cols = config.value?.selectedCellsMetadataColumns ?? []
    const cells = selectedCells.value
    if (!cells.length) return cols
    return cols.map(col => ({
      ...col,
      autoWidth: Math.max(calcAutoWidth(col.prop, cells, CHAR_WIDTH_SELECTED), col.width || 0)
    }))
  })

  // Active cell-type context drives which simulation columns / Y-axis options are shown.
  // Derives from the committed search; defaults to 'FF' so early-render getters don't crash.
  const activeCellType = computed(() => appliedSearch.value.cellType ?? 'FF')

  const selectedCellsSimulationColumns = computed(() => {
    const cfg = config.value?.selectedCellsSimulationColumns
    return cfg?.[activeCellType.value] ?? []
  })
  const chartOptions = computed(() => config.value?.chartOptions ?? {
    chartTypes: [], categoricalXAxisOptions: [], labelableFields: []
  })
  const metricOptionsForType = computed(() => {
    const ct = activeCellType.value
    const order = config.value?.chartOptions?.metricOrder?.[ct] || []
    const raw = metrics.value.filter(m => m.cellType === ct && m.formulaType === 'raw')
    const orderMap = new Map(order.map((name, i) => [name, i]))
    raw.sort((a, b) => {
      const ai = orderMap.get(a.name) ?? 999
      const bi = orderMap.get(b.name) ?? 999
      return ai - bi
    })
    return raw.map(m => ({ value: m.metricId, label: m.name }))
  })
  const categoricalXAxisOptions = computed(() => chartOptions.value.categoricalXAxisOptions ?? [])
  const labelableFields = computed(() => chartOptions.value.labelableFields ?? [])
  const augmentedXAxisOptions = computed(() => {
    const chartType = activeBuilder.value?.chartConfig?.chartType
    // Bar charts are always grouped on the Group template — no field picker.
    if (chartType === 'bar') return [{ value: '__label__', label: 'Group (template)' }]
    return metricOptionsForType.value
  })
  const yAxisOptions = computed(() => metricOptionsForType.value)
  const derivedFields = computed(() => buildDerivedFields(activeCellType.value, config.value))
  const numericSimFields = computed(() =>
    selectedCellsSimulationColumns.value.filter(c => c.numeric).map(c => c.prop)
  )

  const derivedSimColumns = computed(() => {
    const formulas = activeBuilder.value?.derivedFormulas || []
    return formulas.map(df => ({
      prop: `__df_${df.id}`,
      label: df.name,
      width: 130,
      numeric: true,
      isDerived: true,
      formula: df,
      desc: formulaDesc(df, derivedFields.value)
    }))
  })

  const allNumericFields = computed(() => [
    ...numericSimFields.value,
    ...derivedSimColumns.value.map(c => c.prop)
  ])

  const augmentedYAxisOptions = computed(() => {
    const base = yAxisOptions.value || []
    const derived = (activeBuilder.value?.derivedFormulas || []).map(df => ({
      value: `__df_${df.id}`,
      label: df.name
    }))
    return [...base, ...derived]
  })

  const cellAliases = ref(_saved?.cellAliases ?? {})

  function getCellAlias(builderId, cellId) {
    return cellAliases.value[`${builderId}-${cellId}`] || ''
  }

  function setCellAlias(builderId, cellId, alias) {
    cellAliases.value[`${builderId}-${cellId}`] = alias
  }

  async function fetchSimForCells(cellIds, cellTypeOverride = appliedSearch.value.cellType) {
    const uncached = cellIds.filter(id => !simulations.value[id])
    if (!uncached.length) return
    const cellType = cellTypeOverride
    const fn = cellType === 'ICG' ? fetchSimICG : fetchSimFF
    const data = await fn(uncached)
    data.forEach(row => { simulations.value[row.cellId] = row })
  }

  async function toggleCellSelection(cellId) {
    const ids = activeBuilder.value.selectedCellIds
    const idx = ids.indexOf(cellId)
    if (idx === -1) {
      ids.push(cellId)
      await fetchSimForCells([cellId])
    } else {
      ids.splice(idx, 1)
    }
  }

  async function selectCells(cellIds) {
    const ids = activeBuilder.value.selectedCellIds
    const newIds = cellIds.filter(id => !ids.includes(id))
    newIds.forEach(id => ids.push(id))
    if (newIds.length) await fetchSimForCells(newIds)
  }

  function deselectCells(cellIds) {
    const builderId = activeBuilder.value.id
    const ids = activeBuilder.value.selectedCellIds
    cellIds.forEach(id => {
      const idx = ids.indexOf(id)
      if (idx !== -1) ids.splice(idx, 1)
      delete cellAliases.value[`${builderId}-${id}`]
    })
  }

  function clearSelection(newCellType) {
    if (!activeBuilder.value) return
    activeBuilder.value.selectedCellIds = []
    activeBuilder.value.chartConfig = createDefaultChartConfig(newCellType)
    activeBuilder.value.derivedFormulas = []
  }

  function nextUntitledName() {
    const names = builders.value.map(b => b.name)
    let i = 1
    while (names.includes(i === 1 ? 'Untitled' : `Untitled (${i})`)) i++
    return i === 1 ? 'Untitled' : `Untitled (${i})`
  }

  function addBuilder() {
    saveSearchToBuilder()
    const id = nextBuilderId++
    builders.value.push({
      id,
      name: nextUntitledName(),
      selectedCellIds: [],
      chartConfig: createDefaultChartConfig(),
      derivedFormulas: [],
      labelTemplate: defaultLabelTemplate(),
      search: { pending: createEmptySearch(), applied: createEmptySearch() }
    })
    activeBuilderIndex.value = builders.value.length - 1
  }

  function removeBuilder(index) {
    if (builders.value.length <= 1) return
    builders.value.splice(index, 1)
    if (activeBuilderIndex.value >= builders.value.length) {
      activeBuilderIndex.value = builders.value.length - 1
    }
  }

  function resetBuilder(index) {
    const builder = builders.value[index]
    if (!builder) return

    Object.keys(cellAliases.value).forEach(key => {
      if (key.startsWith(`${builder.id}-`)) delete cellAliases.value[key]
    })

    builder.name = 'Untitled'
    builder.selectedCellIds = []
    builder.chartConfig = createDefaultChartConfig()
    builder.derivedFormulas = []
    builder.labelTemplate = defaultLabelTemplate()
    builder.search = { pending: createEmptySearch(), applied: createEmptySearch() }

    if (activeBuilderIndex.value === index) {
      pendingSearch.value = createEmptySearch()
      appliedSearch.value = createEmptySearch()
      searchDirty.value = false
    }
  }

  function updateChartConfig(key, value) {
    if (!activeBuilder.value) return
    const cfg = activeBuilder.value.chartConfig
    cfg[key] = value

    if (key === 'chartType') {
      const catValues = new Set(categoricalXAxisOptions.value.map(o => o.value))
      if (value === 'bar') {
        cfg.xAxis = '__label__'
      } else if (catValues.has(cfg.xAxis)) {
        const firstMetric = metricOptionsForType.value[0]
        cfg.xAxis = firstMetric?.value || null
      }
    }

    if (key === 'yAxisSecondary' && !value) {
      cfg.chartTypeSecondary = null
    }
  }

  // ── Label template helpers ──
  function setLabelTemplate(template) {
    if (!activeBuilder.value) return
    activeBuilder.value.labelTemplate = Array.isArray(template) ? [...template] : []
  }

  function addLabelToken(token) {
    if (!activeBuilder.value) return
    if (!Array.isArray(activeBuilder.value.labelTemplate)) {
      activeBuilder.value.labelTemplate = []
    }
    activeBuilder.value.labelTemplate.push({ ...token })
  }

  function removeLabelToken(index) {
    if (!activeBuilder.value) return
    const t = activeBuilder.value.labelTemplate
    if (Array.isArray(t) && index >= 0 && index < t.length) t.splice(index, 1)
  }

  function moveLabelToken(from, to) {
    if (!activeBuilder.value) return
    const t = activeBuilder.value.labelTemplate
    if (!Array.isArray(t)) return
    if (from < 0 || from >= t.length || to < 0 || to >= t.length) return
    const [item] = t.splice(from, 1)
    t.splice(to, 0, item)
  }

  // formulaConfig: { name, type, field?, field1?, op?, field2?, fn? }
  function addDerivedFormula(formulaConfig) {
    if (!activeBuilder.value) return
    const id = nextDerivedId++
    activeBuilder.value.derivedFormulas.push({ id, ...formulaConfig })
  }

  function removeDerivedFormula(id) {
    if (!activeBuilder.value) return
    const formulas = activeBuilder.value.derivedFormulas
    const idx = formulas.findIndex(f => f.id === id)
    if (idx !== -1) formulas.splice(idx, 1)
    const key = `__df_${id}`
    const cfg = activeBuilder.value.chartConfig
    if (cfg.yAxisPrimary === key) cfg.yAxisPrimary = yAxisOptions.value[0]?.value || 'pdpAvg'
    if (cfg.yAxisSecondary === key) cfg.yAxisSecondary = null
  }

  // Resolve metricId → field1 (actual data key). Categorical strings pass through.
  function resolveMetricField(metricIdOrStr) {
    if (metricIdOrStr == null) return null
    if (typeof metricIdOrStr === 'string') return metricIdOrStr // categorical (alias, cellName, etc.)
    const m = metrics.value.find(x => x.metricId === metricIdOrStr)
    return m?.field1 || null
  }

  function generateChart() {
    if (!activeBuilder.value || selectedCells.value.length === 0) return null
    const cfg = activeBuilder.value.chartConfig
    const builderId = activeBuilder.value.id
    const existingIdx = chartTabs.value.findIndex(t => t.builderId === builderId)

    // Build a label map: field name → display label
    const labelMap = { __label__: 'Group', label: 'Group' }
    metrics.value.forEach(m => { labelMap[m.field1] = m.name; labelMap[m.metricId] = m.name })
    ;(categoricalXAxisOptions.value || []).forEach(o => { labelMap[o.value] = o.label })
    ;(selectedCellsSimulationColumns.value || []).forEach(c => { labelMap[c.prop] = c.label })
    ;(selectedCellsMetadataColumns.value || []).forEach(c => { labelMap[c.prop] = c.label })

    // Resolve metricIds to actual field names for chart rendering
    const resolvedConfig = {
      ...cfg,
      xAxis: resolveMetricField(cfg.xAxis),
      yAxisPrimary: resolveMetricField(cfg.yAxisPrimary),
      yAxisSecondary: resolveMetricField(cfg.yAxisSecondary)
    }

    const chartTab = {
      builderId,
      builderName: activeBuilder.value.name,
      cellType: activeCellType.value,
      cells: selectedCells.value.map(c => ({ ...c })),
      config: resolvedConfig,
      derivedFormulas: [...(activeBuilder.value.derivedFormulas || [])],
      labelTemplate: [...(activeBuilder.value.labelTemplate || [])],
      labelMap,
      simulationColumns: [...(selectedCellsSimulationColumns.value || [])]
    }
    if (existingIdx !== -1) chartTabs.value[existingIdx] = chartTab
    else chartTabs.value.push(chartTab)
    return chartTab
  }

  function removeChartTab(builderId) {
    const idx = chartTabs.value.findIndex(t => t.builderId === builderId)
    if (idx !== -1) chartTabs.value.splice(idx, 1)
  }

  // ── Persist builder state to localStorage on every change ──────────────────
  watch(
    [builders, cellAliases, activeBuilderIndex],
    () => savePersistedState({
      builders: builders.value,
      cellAliases: cellAliases.value,
      activeBuilderIndex: activeBuilderIndex.value
    }),
    { deep: true }
  )

  // ── Chart Presets (API) ─────────────────────────────────────────────────
  const chartPresets = ref([])

  function normalizePresetName(name) {
    return String(name ?? '').trim().toLowerCase()
  }

  const presetsForCellType = computed(() => {
    const ct = activeCellType.value
    return chartPresets.value.filter(p => p.isVisible === 'Y')
  })

  async function savePreset(name) {
    if (!activeBuilder.value) return
    const normalized = normalizePresetName(name)
    const duplicate = chartPresets.value.some(p => normalizePresetName(p.name) === normalized)
    if (duplicate) {
      const err = new Error('Preset name already exists')
      err.code = 'DUPLICATE_PRESET_NAME'
      throw err
    }
    const cfg = activeBuilder.value.chartConfig
    const preset = await apiCreatePreset({
      name,
      chartType: cfg.chartType,
      xAxis: cfg.xAxis,
      y1Axis: cfg.yAxisPrimary,
      y2Axis: cfg.yAxisSecondary,
      groupBy: templateToCsv(activeBuilder.value.labelTemplate),
      isVisible: 'Y',
      createdBy: CURRENT_USER
    })
    chartPresets.value.push(preset)
  }

  function loadPreset(presetId) {
    const preset = chartPresets.value.find(p => p.presetId === presetId)
    if (!preset || !activeBuilder.value) return
    const cfg = activeBuilder.value.chartConfig
    cfg.chartType = preset.chartType
    cfg.xAxis = preset.xAxis
    cfg.yAxisPrimary = preset.y1Axis
    cfg.yAxisSecondary = preset.y2Axis
    activeBuilder.value.labelTemplate = csvToTemplate(preset.groupBy)
  }

  async function deletePreset(presetId) {
    await apiDeletePreset(presetId)
    chartPresets.value = chartPresets.value.filter(p => p.presetId !== presetId)
  }

  // ── Saved Charts (API) ──────────────────────────────────────────────────
  const savedCharts = ref([])

  async function saveChart(name) {
    if (!activeBuilder.value) return
    const b = activeBuilder.value
    const cfg = b.chartConfig
    const builderId = b.id

    const chart = await apiCreateChart({
      chartName: name,
      createdBy: CURRENT_USER,
      preset: {
        name: `${name}_${CURRENT_USER}`,
        chartType: cfg.chartType,
        xAxis: cfg.xAxis,
        y1Axis: cfg.yAxisPrimary,
        y2Axis: cfg.yAxisSecondary,
        groupBy: templateToCsv(b.labelTemplate)
      },
      items: b.selectedCellIds.map(cellId => ({
        cellId,
        cellTag: getCellAlias(builderId, cellId) || ''
      }))
    })
    savedCharts.value.push(chart)
  }

  async function restoreChart(chartId) {
    const chart = savedCharts.value.find(c => c.chartId === chartId)
    if (!chart) return

    const preset = chart.preset

    // Create new builder
    saveSearchToBuilder()
    const id = nextBuilderId++
    const cellIds = chart.items.map(i => i.cellId)
    const newBuilder = {
      id,
      name: chart.chartName,
      selectedCellIds: cellIds,
      chartConfig: preset ? {
        chartType: preset.chartType,
        chartTypeSecondary: null,
        xAxis: preset.xAxis,
        yAxisPrimary: preset.y1Axis,
        yAxisSecondary: preset.y2Axis
      } : createDefaultChartConfig(),
      derivedFormulas: [],
      labelTemplate: csvToTemplate(preset?.groupBy || ''),
      search: { pending: createEmptySearch(), applied: createEmptySearch() }
    }
    builders.value.push(newBuilder)
    activeBuilderIndex.value = builders.value.length - 1

    // Restore tags
    chart.items.forEach(item => {
      if (item.cellTag) {
        cellAliases.value[`${id}-${item.cellId}`] = item.cellTag
      }
    })

    await ensureMetaForCells(cellIds)

    // Fetch sim data for restored cells
    if (cellIds.length) await fetchSimForCells(cellIds)

    // Generate chart
    return generateChart()
  }

  async function deleteSavedChart(chartId) {
    await apiDeleteChart(chartId)
    savedCharts.value = savedCharts.value.filter(c => c.chartId !== chartId)
  }

  return {
    metaCells, simulations, config, metrics, cellTypes, cellTypeOptions, pdks, libraries, loading, restoringSessionState, error,
    searchTableColumns, selectedCellsMetadataColumns, selectedCellsSimulationColumns,
    chartOptions, metricOptionsForType, augmentedXAxisOptions, labelableFields, yAxisOptions, derivedFields, activeCellType,
    numericSimFields, derivedSimColumns, allNumericFields, augmentedYAxisOptions,
    builders, activeBuilderIndex, activeSubTab, activeBuilder, selectedCells, cellAliases, chartTabs,
    init, getCellAlias, setCellAlias,
    toggleCellSelection, selectCells, deselectCells, clearSelection,
    addBuilder, removeBuilder, resetBuilder, updateChartConfig,
    setLabelTemplate, addLabelToken, removeLabelToken, moveLabelToken,
    addDerivedFormula, removeDerivedFormula,
    generateChart, removeChartTab,
    // search / filter
    pendingSearch, appliedSearch, searchDirty, restoringSearch, canSearch, searching, filteredCells,
    setPendingCellType, setPendingQuery, setPendingColumnFilter, clearPendingColumnFilter,
    setPendingPdk, setPendingLibraries, pdkOptions, libraryOptions, batchSetAlias,
    applySearch, resetSearch, columnFilterOptions,
    // presets
    chartPresets, presetsForCellType, savePreset, loadPreset, deletePreset,
    // saved charts
    savedCharts, saveChart, restoreChart, deleteSavedChart
  }
})
