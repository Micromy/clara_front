import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
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

// Fields available for derived formula operands
export const DERIVED_FIELDS = [
  { value: 'iPeak',      label: 'I_peak (μA)' },
  { value: 'iAvg',       label: 'I_avg (μA)' },
  { value: 'delay',      label: 'Delay (ps)' },
  { value: 'vdd',        label: 'VDD (V)' },
  { value: 'temp',       label: 'Temp (°C)' },
  { value: 'vth',        label: 'Vth (V)' },
  { value: 'gateLength', label: 'Gate Length' },
  { value: 'cpp',        label: 'CPP' }
]

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
  { value: 'feolCorner',    label: 'FEOL Corner' }
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

export function formulaDesc(df) {
  const fl = v => DERIVED_FIELDS.find(f => f.value === v)?.label ?? v
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
// Mapping to backend DB fields is resolved in the adapter layer later;
// for now we filter on `cell.cellType` directly.
export const CELL_TYPE_OPTIONS = [
  { value: 'FF',  label: 'FF' },
  { value: 'ICG', label: 'ICG' }
]

function createEmptySearch() {
  return {
    cellType: null,                 // 'FF' | 'ICG' | null
    query: '',                      // cellName partial match
    columnFilters: {}               // { [columnKey]: string[] }  — empty/absent = all
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

  // Restore persisted builder state (before first render)
  const _saved = loadPersistedState()

  const builders = ref(
    _saved?.builders ?? [
      { id: 1, name: 'Builder 1_Main (v2)', selectedCellIds: [], chartConfig: createDefaultChartConfig(), derivedFormulas: [] }
    ]
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

  function createDefaultChartConfig() {
    return {
      chartType: 'scatter',
      chartTypeSecondary: null,   // null = same as primary
      xAxis: 'vdd',
      yAxisPrimary: 'iPeak',
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
    const baseCells = allCells.value
      .filter(c => ids.includes(c.id))
      .map(c => ({ ...c, ...(simulations.value[c.id] || {}) }))

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
  const canSearch = computed(() => !!pendingSearch.value.cellType)

  function setPendingCellType(v) {
    pendingSearch.value.cellType = v
    searchDirty.value = true
  }
  function setPendingQuery(v) {
    pendingSearch.value.query = v
    searchDirty.value = true
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
  }
  function clearPendingColumnFilter(columnKey) {
    setPendingColumnFilter(columnKey, [])
  }

  function applySearch() {
    if (!canSearch.value) return false
    appliedSearch.value = {
      cellType: pendingSearch.value.cellType,
      query: pendingSearch.value.query,
      columnFilters: { ...pendingSearch.value.columnFilters }
    }
    searchDirty.value = false
    return true
  }

  function resetSearch() {
    pendingSearch.value = createEmptySearch()
    appliedSearch.value = createEmptySearch()
    searchDirty.value = false
  }

  // Distinct values for a column (used by ColumnFilterDropdown)
  function columnFilterOptions(columnKey) {
    const set = new Set()
    for (const c of allCells.value) {
      const v = c[columnKey]
      if (v !== undefined && v !== null && v !== '') set.add(String(v))
    }
    return Array.from(set).sort((a, b) => {
      const na = Number(a), nb = Number(b)
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
      return a.localeCompare(b)
    })
  }

  // filteredCells: applied filters applied to allCells (null when no search yet)
  const filteredCells = computed(() => {
    const s = appliedSearch.value
    if (!s.cellType) return []     // no search executed yet
    const q = (s.query || '').toLowerCase().trim()
    const colFilters = Object.entries(s.columnFilters || {})
    return allCells.value.filter(cell => {
      if (cell.cellType !== s.cellType) return false
      if (q && !cell.cellName.toLowerCase().includes(q)) return false
      for (const [key, vals] of colFilters) {
        if (!vals || !vals.length) continue
        if (!vals.includes(String(cell[key]))) return false
      }
      return true
    })
  })

  const searchTableColumns = computed(() => config.value?.searchTableColumns ?? [])
  const selectedCellsMetadataColumns = computed(() => config.value?.selectedCellsMetadataColumns ?? [])
  const selectedCellsSimulationColumns = computed(() => config.value?.selectedCellsSimulationColumns ?? [])
  const chartOptions = computed(() => config.value?.chartOptions ?? {
    chartTypes: [], xAxisOptions: [], yAxisOptions: [], groupingOptions: []
  })
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
      desc: formulaDesc(df)
    }))
  })

  const allNumericFields = computed(() => [
    ...numericSimFields.value,
    ...derivedSimColumns.value.map(c => c.prop)
  ])

  const augmentedYAxisOptions = computed(() => {
    const base = chartOptions.value.yAxisOptions || []
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
    const ids = activeBuilder.value.selectedCellIds
    cellIds.forEach(id => {
      const idx = ids.indexOf(id)
      if (idx !== -1) ids.splice(idx, 1)
    })
  }

  function addBuilder() {
    const id = nextBuilderId++
    builders.value.push({
      id,
      name: `Builder ${id}`,
      selectedCellIds: [],
      chartConfig: createDefaultChartConfig(),
      derivedFormulas: []
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
    if (activeBuilder.value) activeBuilder.value.chartConfig[key] = value
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
    if (cfg.yAxisPrimary === key) cfg.yAxisPrimary = 'iPeak'
    if (cfg.yAxisSecondary === key) cfg.yAxisSecondary = null
  }

  function generateChart() {
    if (!activeBuilder.value || selectedCells.value.length === 0) return null
    const cfg = activeBuilder.value.chartConfig
    const builderId = activeBuilder.value.id
    const existingIdx = chartTabs.value.findIndex(t => t.builderId === builderId)
    const chartTab = {
      builderId,
      builderName: activeBuilder.value.name,
      cells: selectedCells.value.map(c => ({
        ...c,
        alias: getCellAlias(builderId, c.id) || ''
      })),
      config: { ...cfg },
      derivedFormulas: [...(activeBuilder.value.derivedFormulas || [])]
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

  return {
    allCells, simulations, config, loading, error,
    searchTableColumns, selectedCellsMetadataColumns, selectedCellsSimulationColumns,
    chartOptions, numericSimFields, derivedSimColumns, allNumericFields, augmentedYAxisOptions,
    builders, activeBuilderIndex, activeBuilder, selectedCells, cellAliases, chartTabs,
    init, getCellAlias, setCellAlias,
    toggleCellSelection, selectCells, deselectCells,
    addBuilder, removeBuilder, updateChartConfig,
    addDerivedFormula, removeDerivedFormula,
    generateChart, removeChartTab,
    // search / filter
    pendingSearch, appliedSearch, searchDirty, canSearch, filteredCells,
    setPendingCellType, setPendingQuery, setPendingColumnFilter, clearPendingColumnFilter,
    applySearch, resetSearch, columnFilterOptions
  }
})
