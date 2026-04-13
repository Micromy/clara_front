import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { generateCellList } from '../mock/cellData.js'

export const useBuilderStore = defineStore('builder', () => {
  // All cells from mock data
  const allCells = ref(generateCellList(100))

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

  const activeBuilder = computed(() => builders.value[activeBuilderIndex.value])

  const selectedCells = computed(() => {
    if (!activeBuilder.value) return []
    return allCells.value.filter(c => activeBuilder.value.selectedCellIds.includes(c.id))
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

    const config = activeBuilder.value.chartConfig
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
      config: { ...config }
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
    allCells,
    builders,
    activeBuilderIndex,
    activeBuilder,
    selectedCells,
    cellAliases,
    chartTabs,
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
