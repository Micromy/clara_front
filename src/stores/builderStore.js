import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchCells, fetchColumnConfig, fetchSimulations } from '../api/cells.js'

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

function computeDerived(a, b, op) {
  if (typeof a !== 'number' || typeof b !== 'number') return null
  switch (op) {
    case '+': return a + b
    case '-': return a - b
    case '*': return a * b
    case '/': return b === 0 ? null : a / b
  }
  return null
}

let nextDerivedId = 1

export const useBuilderStore = defineStore('builder', () => {
  // Data fetched from API layer (backed by JSON today)
  const allCells = ref([])
  const simulations = ref({})  // cellId -> { iPeak, iAvg, delay }
  const config = ref(null)
  const loading = ref(false)
  const error = ref(null)
  let initPromise = null

  // Builders management
  const builders = ref([
    { id: 1, name: 'Builder 1_Main (v2)', selectedCellIds: [], chartConfig: createDefaultChartConfig(), derivedFormulas: [] }
  ])
  const activeBuilderIndex = ref(0)
  let nextBuilderId = 2

  // Chart tabs
  const chartTabs = ref([])

  function createDefaultChartConfig() {
    return {
      chartType: 'scatter',
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
    return allCells.value
      .filter(c => ids.includes(c.id))
      .map(c => {
        const merged = { ...c, ...(simulations.value[c.id] || {}) }
        formulas.forEach(df => {
          merged[`__df_${df.id}`] = computeDerived(merged[df.field1], merged[df.field2], df.op)
        })
        return merged
      })
  })

  // Convenience getters over config
  const searchTableColumns = computed(() => config.value?.searchTableColumns ?? [])
  const selectedCellsMetadataColumns = computed(() => config.value?.selectedCellsMetadataColumns ?? [])
  const selectedCellsSimulationColumns = computed(() => config.value?.selectedCellsSimulationColumns ?? [])
  const chartOptions = computed(() => config.value?.chartOptions ?? {
    chartTypes: [], xAxisOptions: [], yAxisOptions: [], groupingOptions: []
  })
  const numericSimFields = computed(() =>
    selectedCellsSimulationColumns.value.filter(c => c.numeric).map(c => c.prop)
  )

  // Derived formula columns for the active builder
  const derivedSimColumns = computed(() => {
    const formulas = activeBuilder.value?.derivedFormulas || []
    return formulas.map(df => ({
      prop: `__df_${df.id}`,
      label: df.name,
      width: 120,
      numeric: true,
      isDerived: true,
      formula: df
    }))
  })

  // All numeric fields for diff/ratio (base + derived)
  const allNumericFields = computed(() => [
    ...numericSimFields.value,
    ...derivedSimColumns.value.map(c => c.prop)
  ])

  // Y-axis options augmented with derived formulas
  const augmentedYAxisOptions = computed(() => {
    const base = chartOptions.value.yAxisOptions || []
    const derived = (activeBuilder.value?.derivedFormulas || []).map(df => ({
      value: `__df_${df.id}`,
      label: df.name
    }))
    return [...base, ...derived]
  })

  // Cell aliases: builderId -> cellId -> alias
  const cellAliases = ref({})

  function getCellAlias(builderId, cellId) {
    return cellAliases.value[`${builderId}-${cellId}`] || ''
  }

  function setCellAlias(builderId, cellId, alias) {
    cellAliases.value[`${builderId}-${cellId}`] = alias
  }

  function toggleCellSelection(cellId) {
    const ids = activeBuilder.value.selectedCellIds
    const idx = ids.indexOf(cellId)
    if (idx === -1) {
      ids.push(cellId)
    } else {
      ids.splice(idx, 1)
    }
  }

  function selectCells(cellIds) {
    const ids = activeBuilder.value.selectedCellIds
    cellIds.forEach(id => {
      if (!ids.includes(id)) ids.push(id)
    })
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
    if (activeBuilder.value) {
      activeBuilder.value.chartConfig[key] = value
    }
  }

  function addDerivedFormula(name, field1, op, field2) {
    if (!activeBuilder.value) return
    const id = nextDerivedId++
    activeBuilder.value.derivedFormulas.push({ id, name, field1, op, field2 })
  }

  function removeDerivedFormula(id) {
    if (!activeBuilder.value) return
    const formulas = activeBuilder.value.derivedFormulas
    const idx = formulas.findIndex(f => f.id === id)
    if (idx !== -1) formulas.splice(idx, 1)
    // If the removed formula was selected as Y axis, reset it
    const key = `__df_${id}`
    const cfg = activeBuilder.value.chartConfig
    if (cfg.yAxisPrimary === key) cfg.yAxisPrimary = 'iPeak'
    if (cfg.yAxisSecondary === key) cfg.yAxisSecondary = null
  }

  function generateChart() {
    if (!activeBuilder.value || selectedCells.value.length === 0) return null

    const cfg = activeBuilder.value.chartConfig
    const builderId = activeBuilder.value.id

    // Add or update chart tab
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

    if (existingIdx !== -1) {
      chartTabs.value[existingIdx] = chartTab
    } else {
      chartTabs.value.push(chartTab)
    }

    return chartTab
  }

  function removeChartTab(builderId) {
    const idx = chartTabs.value.findIndex(t => t.builderId === builderId)
    if (idx !== -1) chartTabs.value.splice(idx, 1)
  }

  return {
    // data
    allCells,
    simulations,
    config,
    loading,
    error,
    // config getters
    searchTableColumns,
    selectedCellsMetadataColumns,
    selectedCellsSimulationColumns,
    chartOptions,
    numericSimFields,
    derivedSimColumns,
    allNumericFields,
    augmentedYAxisOptions,
    // builders
    builders,
    activeBuilderIndex,
    activeBuilder,
    selectedCells,
    cellAliases,
    chartTabs,
    // actions
    init,
    getCellAlias,
    setCellAlias,
    toggleCellSelection,
    selectCells,
    deselectCells,
    addBuilder,
    removeBuilder,
    updateChartConfig,
    addDerivedFormula,
    removeDerivedFormula,
    generateChart,
    removeChartTab
  }
})
