import { defineStore } from 'pinia'
import { ref, computed, watch, nextTick } from 'vue'
import { fetchCells, fetchColumnConfig, fetchSimulations } from '../api/cells.js'

const STORAGE_KEY = 'arias-builder-state'

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

// Cell type top-level classification (mutually exclusive).
// `cellType` on each cell is now 'FF' or 'ICG' directly.
export const CELL_TYPE_OPTIONS = [
  { value: 'FF',  label: 'FF' },
  { value: 'ICG', label: 'ICG' }
]

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
  const allCells = ref([])
  const simulations = ref({})  // cellId -> { iPeak, iAvg, delay }
  const config = ref(null)
  const loading = ref(false)
  const error = ref(null)
  let initPromise = null

  // ── Cell search: pending (user is editing) vs applied (committed on Search click) ──
  const pendingSearch = ref(createEmptySearch())
  const appliedSearch = ref(createEmptySearch())
  const searchDirty = ref(false)    // true when pending diverges from applied
  const restoringSearch = ref(false) // true during builder switch restore

  // Restore persisted builder state (before first render)
  const _saved = loadPersistedState()

  function ensureBuilderSearch(b) {
    if (!b.search) b.search = { pending: createEmptySearch(), applied: createEmptySearch() }
    return b
  }

  const builders = ref(
    (_saved?.builders ?? [
      { id: 1, name: 'Untitled', selectedCellIds: [], chartConfig: createDefaultChartConfig(), derivedFormulas: [] }
    ]).map(ensureBuilderSearch)
  )
  const activeBuilderIndex = ref(
    _saved?.activeBuilderIndex != null
      ? Math.min(_saved.activeBuilderIndex, (_saved.builders?.length ?? 1) - 1)
      : 0
  )
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
    nextTick(() => { restoringSearch.value = false })
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
    const xOpts = config.value?.chartOptions?.xAxisOptions?.[ct] || []
    const yOpts = config.value?.chartOptions?.yAxisOptions?.[ct] || []
    return {
      chartType: 'scatter',
      chartTypeSecondary: null,
      xAxis: xOpts[0]?.value || 'pdpAvg',
      yAxisPrimary: yOpts[0]?.value || 'pdpAvg',
      yAxisSecondary: null,
      grouping: 'alias'
    }
  }

  async function init() {
    if (initPromise) return initPromise
    loading.value = true
    error.value = null
    initPromise = Promise.all([
      fetchCells(),
      fetchColumnConfig(),
      fetchSimulations()
    ])
      .then(([cells, cfg, sims]) => {
        allCells.value = cells
        config.value = cfg
        simulations.value = sims
      })
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

  const selectedCells = computed(() => {
    if (!activeBuilder.value) return []
    const ids = activeBuilder.value.selectedCellIds
    const formulas = activeBuilder.value.derivedFormulas || []

    // Pass 1: merge base + simulation data
    const cellMap = new Map(allCells.value.map(c => [c.id, c]))
    const baseCells = ids
      .filter(id => cellMap.has(id))
      .map(id => ({ ...cellMap.get(id), ...(simulations.value[id] || {}) }))

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
        const gKey = String(c[df.groupBy ?? 'alias'] ?? '')
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
          const gKey = String(c[df.groupBy ?? 'alias'] ?? '')
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

  // PDK dropdown options: unique pdk values from allCells, sorted
  const pdkOptions = computed(() => {
    const set = new Set()
    for (const c of allCells.value) {
      if (c.pdk != null && c.pdk !== '') set.add(c.pdk)
    }
    return Array.from(set).sort()
  })

  // Library dropdown options: unique library values, cascading on selected PDK
  const libraryOptions = computed(() => {
    const pdk = pendingSearch.value.pdk
    const cellType = pendingSearch.value.cellType
    const set = new Set()
    for (const c of allCells.value) {
      if (cellType && c.cellType !== cellType) continue
      if (pdk && c.pdk !== pdk) continue
      if (c.library != null && c.library !== '') set.add(c.library)
    }
    return Array.from(set).sort()
  })

  function batchSetAlias(builderId, cellIds, alias) {
    cellIds.forEach(id => { cellAliases.value[`${builderId}-${id}`] = alias })
  }

  // Pre-column-filter stage: type + pdk + libraries + query only (no columnFilters).
  // Used as the source for columnFilterOptions to avoid circular dependency.
  const preColumnFilteredCells = computed(() => {
    const s = appliedSearch.value
    if (!s.cellType || !s.pdk || s.libraries.length === 0) return []
    const terms = (s.query || '').toLowerCase().split(/[\s,]+/).filter(Boolean)
    return allCells.value.filter(cell => {
      if (!cellMatchesCategory(cell, s.cellType)) return false
      if (s.pdk && cell.pdk !== s.pdk) return false
      if (s.libraries.length > 0 && !s.libraries.includes(cell.library)) return false
      if (terms.length && !terms.every(t => cell.cellName.toLowerCase().includes(t))) return false
      return true
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
    chartTypes: [], xAxisOptions: [], yAxisOptions: {}, groupingOptions: []
  })
  const xAxisOptions = computed(() => {
    const x = chartOptions.value.xAxisOptions
    return x?.[activeCellType.value] ?? []
  })
  const categoricalXAxisOptions = computed(() => chartOptions.value.categoricalXAxisOptions ?? [])
  const augmentedXAxisOptions = computed(() => {
    const chartType = activeBuilder.value?.chartConfig?.chartType
    if (chartType === 'bar') return categoricalXAxisOptions.value
    return xAxisOptions.value
  })
  const filteredGroupingOptions = computed(() => {
    const all = chartOptions.value.groupingOptions || []
    const xAxis = activeBuilder.value?.chartConfig?.xAxis
    return all.filter(opt => opt.value !== xAxis)
  })
  const yAxisOptions = computed(() => {
    const y = chartOptions.value.yAxisOptions
    return y?.[activeCellType.value] ?? []
  })
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

  function toggleCellSelection(cellId) {
    const ids = activeBuilder.value.selectedCellIds
    const idx = ids.indexOf(cellId)
    if (idx === -1) ids.push(cellId)
    else ids.splice(idx, 1)
  }

  function selectCells(cellIds) {
    const ids = activeBuilder.value.selectedCellIds
    cellIds.forEach(id => { if (!ids.includes(id)) ids.push(id) })
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

  function updateChartConfig(key, value) {
    if (!activeBuilder.value) return
    const cfg = activeBuilder.value.chartConfig
    cfg[key] = value

    if (key === 'chartType') {
      const catValues = new Set(categoricalXAxisOptions.value.map(o => o.value))
      if (value === 'bar' && !catValues.has(cfg.xAxis)) {
        cfg.xAxis = categoricalXAxisOptions.value[0]?.value || 'alias'
      } else if (value !== 'bar' && catValues.has(cfg.xAxis)) {
        cfg.xAxis = xAxisOptions.value[0]?.value || 'pdpAvg'
      }
    }

    if (key === 'xAxis' && cfg.grouping === value) {
      const fallback = (chartOptions.value.groupingOptions || []).find(o => o.value !== value)
      cfg.grouping = fallback?.value || 'alias'
    }
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

  function generateChart() {
    if (!activeBuilder.value || selectedCells.value.length === 0) return null
    const cfg = activeBuilder.value.chartConfig
    const builderId = activeBuilder.value.id
    const existingIdx = chartTabs.value.findIndex(t => t.builderId === builderId)

    // Build a label map so chart/table components can render axis/column labels
    // without hardcoding them or depending on the store.
    const labelMap = {}
    ;(xAxisOptions.value || []).forEach(o => { labelMap[o.value] = o.label })
    ;(categoricalXAxisOptions.value || []).forEach(o => { labelMap[o.value] = o.label })
    ;(yAxisOptions.value || []).forEach(o => { labelMap[o.value] = o.label })
    ;(selectedCellsSimulationColumns.value || []).forEach(c => { labelMap[c.prop] = c.label })
    ;(selectedCellsMetadataColumns.value || []).forEach(c => { labelMap[c.prop] = c.label })

    const chartTab = {
      builderId,
      builderName: activeBuilder.value.name,
      cellType: activeCellType.value,
      cells: selectedCells.value.map(c => ({
        ...c,
        alias: getCellAlias(builderId, c.id) || ''
      })),
      config: { ...cfg },
      derivedFormulas: [...(activeBuilder.value.derivedFormulas || [])],
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

  // ── Chart Presets (localStorage until backend) ─────────────────────────
  const PRESETS_KEY = 'arias-chart-presets'

  function loadPresets() {
    try {
      return JSON.parse(localStorage.getItem(PRESETS_KEY)) || []
    } catch { return [] }
  }

  const chartPresets = ref(loadPresets())

  function savePresetsToStorage() {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(chartPresets.value))
  }

  const presetsForCellType = computed(() => {
    const ct = activeCellType.value
    return chartPresets.value.filter(p => p.cellType === ct && p.isVisible === 'Y')
  })

  function savePreset(name) {
    if (!activeBuilder.value) return
    const cfg = activeBuilder.value.chartConfig
    chartPresets.value.push({
      id: Date.now(),
      name,
      cellType: activeCellType.value,
      chartType: cfg.chartType,
      xAxis: cfg.xAxis,
      yAxisPrimary: cfg.yAxisPrimary,
      y1Aggregation: null,
      yAxisSecondary: cfg.yAxisSecondary,
      y2Aggregation: null,
      grouping: cfg.grouping,
      isVisible: 'Y',
      createdBy: '',
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
    })
    savePresetsToStorage()
  }

  function loadPreset(presetId) {
    const preset = chartPresets.value.find(p => p.id === presetId)
    if (!preset || !activeBuilder.value) return
    const cfg = activeBuilder.value.chartConfig
    cfg.chartType = preset.chartType
    cfg.xAxis = preset.xAxis
    cfg.yAxisPrimary = preset.yAxisPrimary
    cfg.yAxisSecondary = preset.yAxisSecondary
    cfg.grouping = preset.grouping

    const catValues = new Set(categoricalXAxisOptions.value.map(o => o.value))
    if (cfg.chartType !== 'bar' && catValues.has(cfg.xAxis)) {
      cfg.xAxis = xAxisOptions.value[0]?.value || 'pdpAvg'
    } else if (cfg.chartType === 'bar' && !catValues.has(cfg.xAxis)) {
      cfg.xAxis = categoricalXAxisOptions.value[0]?.value || 'alias'
    }
  }

  function deletePreset(presetId) {
    chartPresets.value = chartPresets.value.filter(p => p.id !== presetId)
    savePresetsToStorage()
  }

  // ── Saved Charts (localStorage until backend) ──────────────────────────
  const CHARTS_KEY = 'arias-saved-charts'

  function loadSavedCharts() {
    try {
      return JSON.parse(localStorage.getItem(CHARTS_KEY)) || []
    } catch { return [] }
  }

  const savedCharts = ref(loadSavedCharts())

  function saveChartsToStorage() {
    localStorage.setItem(CHARTS_KEY, JSON.stringify(savedCharts.value))
  }

  function saveChart(name) {
    if (!activeBuilder.value) return
    const b = activeBuilder.value
    const cfg = b.chartConfig
    const builderId = b.id

    // Collect selected cell IDs + aliases
    const items = b.selectedCellIds.map(cellId => ({
      cellId,
      cellAlias: getCellAlias(builderId, cellId) || ''
    }))

    // Save chart config as a hidden preset
    const presetId = Date.now()
    chartPresets.value.push({
      id: presetId,
      name: `${name}__auto`,
      cellType: activeCellType.value,
      chartType: cfg.chartType,
      xAxis: cfg.xAxis,
      yAxisPrimary: cfg.yAxisPrimary,
      y1Aggregation: null,
      yAxisSecondary: cfg.yAxisSecondary,
      y2Aggregation: null,
      grouping: cfg.grouping,
      isVisible: 'N',
      createdBy: '',
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
    })
    savePresetsToStorage()

    // Save chart
    savedCharts.value.push({
      id: Date.now() + 1,
      name,
      presetId,
      cellType: activeCellType.value,
      items,
      createdBy: '',
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
    })
    saveChartsToStorage()
  }

  function restoreChart(chartId) {
    const chart = savedCharts.value.find(c => c.id === chartId)
    if (!chart) return

    const preset = chartPresets.value.find(p => p.id === chart.presetId)

    // Create new builder
    saveSearchToBuilder()
    const id = nextBuilderId++
    const newBuilder = {
      id,
      name: chart.name,
      selectedCellIds: chart.items.map(i => i.cellId),
      chartConfig: preset ? {
        chartType: preset.chartType,
        chartTypeSecondary: null,
        xAxis: preset.xAxis,
        yAxisPrimary: preset.yAxisPrimary,
        yAxisSecondary: preset.yAxisSecondary,
        grouping: preset.grouping
      } : createDefaultChartConfig(chart.cellType),
      derivedFormulas: [],
      search: { pending: createEmptySearch(), applied: createEmptySearch() }
    }
    builders.value.push(newBuilder)
    activeBuilderIndex.value = builders.value.length - 1

    // Restore aliases
    chart.items.forEach(item => {
      if (item.cellAlias) {
        cellAliases.value[`${id}-${item.cellId}`] = item.cellAlias
      }
    })

    // Generate chart
    const chartTab = generateChart()
    return chartTab
  }

  function deleteSavedChart(chartId) {
    const chart = savedCharts.value.find(c => c.id === chartId)
    if (chart) {
      // Also delete hidden preset
      chartPresets.value = chartPresets.value.filter(p => p.id !== chart.presetId)
      savePresetsToStorage()
    }
    savedCharts.value = savedCharts.value.filter(c => c.id !== chartId)
    saveChartsToStorage()
  }

  return {
    allCells, simulations, config, loading, error,
    searchTableColumns, selectedCellsMetadataColumns, selectedCellsSimulationColumns,
    chartOptions, xAxisOptions, augmentedXAxisOptions, filteredGroupingOptions, yAxisOptions, derivedFields, activeCellType,
    numericSimFields, derivedSimColumns, allNumericFields, augmentedYAxisOptions,
    builders, activeBuilderIndex, activeBuilder, selectedCells, cellAliases, chartTabs,
    init, getCellAlias, setCellAlias,
    toggleCellSelection, selectCells, deselectCells, clearSelection,
    addBuilder, removeBuilder, updateChartConfig,
    addDerivedFormula, removeDerivedFormula,
    generateChart, removeChartTab,
    // search / filter
    pendingSearch, appliedSearch, searchDirty, restoringSearch, canSearch, filteredCells,
    setPendingCellType, setPendingQuery, setPendingColumnFilter, clearPendingColumnFilter,
    setPendingPdk, setPendingLibraries, pdkOptions, libraryOptions, batchSetAlias,
    applySearch, resetSearch, columnFilterOptions,
    // presets
    chartPresets, presetsForCellType, savePreset, loadPreset, deletePreset,
    // saved charts
    savedCharts, saveChart, restoreChart, deleteSavedChart
  }
})
