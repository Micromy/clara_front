import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchCells, fetchColumnConfig, fetchSimulations } from '../api/cells.js'

export const useBuilderStore = defineStore('builder', () => {
  // Data fetched from API layer (backed by JSON today)
  const allCells = ref([])
  const simulations = ref({})  // cellId -> { iPeak, iAvg, delay, ivData }
  const config = ref(null)
  const loading = ref(false)
  const error = ref(null)
  let initPromise = null

  // Builders management
  const builders = ref([
    { id: 1, name: 'Builder 1_Main (v2)', selectedCellIds: [], chartConfig: createDefaultChartConfig() }
  ])
  const activeBuilderIndex = ref(0)
  let nextBuilderId = 2

  // Chart tabs
  const chartTabs = ref([])

  function createDefaultChartConfig() {
    return {
      chartType: 'line',
      xAxis: 'voltage',
      yAxisPrimary: 'currentMA',
      yAxisSecondary: 'currentUA',
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
    return allCells.value
      .filter(c => ids.includes(c.id))
      .map(c => ({ ...c, ...(simulations.value[c.id] || {}) }))
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
      chartConfig: createDefaultChartConfig()
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
        alias: getCellAlias(builderId, c.id) || c.cellName
      })),
      config: { ...cfg }
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
    generateChart,
    removeChartTab
  }
})
