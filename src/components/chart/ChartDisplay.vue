<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  chartData: { type: Object, required: true },
  showLabels: { type: Boolean, default: false }
})

const chartContainer = ref(null)
let chartInstance = null

const COLORS = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
  '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#4dc9f6'
]

function getAxisLabel(key) {
  const labelMap = props.chartData.labelMap || {}
  if (labelMap[key]) return labelMap[key]
  const df = (props.chartData.derivedFormulas || []).find(d => `__df_${d.id}` === key)
  return df ? df.name : key
}

const chartOption = computed(() => {
  const { cells, config } = props.chartData
  if (!cells || cells.length === 0) return {}

  const isBar = config.chartType === 'bar'
  const isLine = config.chartType === 'line'

  // Secondary type must be compatible with primary's x-axis type:
  //   bar requires category x-axis → only allowed when primary is also bar; else falls back to line
  //   scatter/line require value x-axis → only allowed when primary is NOT bar; else bar primary gets line fallback
  const rawSecType = config.chartTypeSecondary || config.chartType
  const secType = isBar
    ? (rawSecType === 'bar' ? 'bar' : 'line')        // category x-axis: bar or line OK, scatter→line
    : (rawSecType === 'bar' ? 'scatter' : rawSecType) // value x-axis: scatter/line OK, bar→scatter
  const isBarSec = secType === 'bar'
  const isLineSec = secType === 'line'

  // Group cells by the grouping field.
  // Fall back to cellName when the grouping value is null/undefined/empty string
  // (e.g. alias is '' before the user fills it in).
  const groups = new Map()
  cells.forEach(cell => {
    const raw = cell[config.grouping]
    const key = (raw != null && String(raw).trim() !== '') ? String(raw) : cell.cellName
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(cell)
  })

  // For bar chart: collect unique X values as categories (sorted)
  let xCategories = null
  if (isBar) {
    const xVals = new Set(cells.map(c => c[config.xAxis]))
    xCategories = [...xVals].sort((a, b) => a - b).map(String)
  }

  const series = []
  let colorIdx = 0

  groups.forEach((groupCells, groupName) => {
    const color = COLORS[colorIdx % COLORS.length]
    colorIdx++

    if (isBar) {
      const data = xCategories.map(xCat => {
        const matching = groupCells.filter(c => String(c[config.xAxis]) === xCat)
        if (!matching.length) return null
        const avg = matching.reduce((s, c) => s + (c[config.yAxisPrimary] ?? 0), 0) / matching.length
        return Math.round(avg * 100) / 100
      })
      series.push({ name: groupName, type: 'bar', data, itemStyle: { color }, label: { show: props.showLabels, position: 'top', fontSize: 10, formatter: () => groupName } })
    } else {
      const sortedCells = isLine
        ? [...groupCells].sort((a, b) => (a[config.xAxis] ?? 0) - (b[config.xAxis] ?? 0))
        : groupCells
      const data = sortedCells.map(c => [c[config.xAxis], c[config.yAxisPrimary]])
      series.push({
        name: groupName,
        type: isLine ? 'line' : 'scatter',
        data,
        smooth: false,
        symbol: 'circle',
        symbolSize: isLine ? 5 : 8,
        lineStyle: { width: 2 },
        itemStyle: { color },
        label: {
          show: props.showLabels,
          position: 'top',
          fontSize: 10,
          formatter: () => groupName
        }
      })
    }

    // Secondary Y-axis series
    if (config.yAxisSecondary) {
      if (isBarSec) {
        // isBarSec is only true when primary is also bar (xCategories always exists here)
        const data = xCategories.map(xCat => {
          const matching = groupCells.filter(c => String(c[config.xAxis]) === xCat)
          if (!matching.length) return null
          const avg = matching.reduce((s, c) => s + (c[config.yAxisSecondary] ?? 0), 0) / matching.length
          return Math.round(avg * 100) / 100
        })
        series.push({
          name: `${groupName} (${getAxisLabel(config.yAxisSecondary)})`,
          type: 'bar',
          yAxisIndex: 1,
          data,
          itemStyle: { color, opacity: 0.6 },
          barGap: '30%',
          label: {
            show: props.showLabels,
            position: 'top',
            fontSize: 10,
            formatter: () => groupName
          }
        })
      } else {
        const sortedCells = isLineSec
          ? [...groupCells].sort((a, b) => (a[config.xAxis] ?? 0) - (b[config.xAxis] ?? 0))
          : groupCells
        const data = sortedCells.map(c => [c[config.xAxis], c[config.yAxisSecondary]])
        series.push({
          name: `${groupName} (${getAxisLabel(config.yAxisSecondary)})`,
          type: isLineSec ? 'line' : 'scatter',
          yAxisIndex: 1,
          data,
          symbol: isLineSec ? 'triangle' : 'diamond',
          symbolSize: isLineSec ? 5 : 8,
          lineStyle: { width: 1, type: 'dashed' },
          itemStyle: { color },
          label: {
            show: props.showLabels,
            position: 'top',
            fontSize: 10,
            formatter: () => groupName
          }
        })
      }
    }
  })

  const option = {
    title: {
      text: props.chartData.builderName,
      left: 'center',
      textStyle: { fontSize: 14 }
    },
    tooltip: {
      trigger: isBar ? 'axis' : 'item',
      formatter(params) {
        if (!Array.isArray(params)) params = [params]
        if (isBar) {
          const xVal = params[0]?.name
          let html = `<strong>${getAxisLabel(config.xAxis)}: ${xVal}</strong><br/>`
          params.forEach(p => {
            if (p.value != null) {
              html += `<span style="color:${p.color}">●</span> ${p.seriesName}: ${p.value}<br/>`
            }
          })
          return html
        }
        let html = ''
        params.forEach(p => {
          const [x, y] = Array.isArray(p.data) ? p.data : [null, p.data]
          html += `<span style="color:${p.color}">●</span> <strong>${p.seriesName}</strong><br/>`
          html += `&nbsp;&nbsp;${getAxisLabel(config.xAxis)}: ${x}<br/>`
          html += `&nbsp;&nbsp;${getAxisLabel(p.yAxisIndex === 1 ? config.yAxisSecondary : config.yAxisPrimary)}: ${y}<br/>`
        })
        return html
      }
    },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      right: 10,
      top: 'middle',
      itemGap: 10,
      itemWidth: 16,
      itemHeight: 10,
      pageIconSize: 10,
      pageTextStyle: { fontSize: 11, color: '#909399' },
      textStyle: { fontSize: 11, color: '#606266' }
    },
    grid: {
      left: 60,
      right: config.yAxisSecondary ? 220 : 170,
      top: 50,
      bottom: 40
    },
    toolbox: {
      show: true,
      right: 20,
      top: 10,
      feature: {
        dataZoom: { yAxisIndex: 'none', title: { zoom: 'Box Zoom', back: 'Reset Zoom' } },
        restore: { title: 'Reset' },
        saveAsImage: { title: 'Save PNG' }
      }
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, start: 5, end: 95, filterMode: 'none' },
      { type: 'inside', yAxisIndex: 0, start: 5, end: 95, filterMode: 'none' }
    ],
    xAxis: isBar
      ? {
          type: 'category',
          data: xCategories,
          name: getAxisLabel(config.xAxis),
          nameLocation: 'center',
          nameGap: 30
        }
      : {
          type: 'value',
          name: getAxisLabel(config.xAxis),
          nameLocation: 'center',
          nameGap: 30
        },
    yAxis: [
      {
        type: 'value',
        name: getAxisLabel(config.yAxisPrimary),
        nameLocation: 'center',
        nameGap: 40
      }
    ],
    series
  }

  if (config.yAxisSecondary) {
    option.yAxis.push({
      type: 'value',
      name: getAxisLabel(config.yAxisSecondary),
      nameLocation: 'center',
      nameGap: 40,
      position: 'right'
    })
  }

  // Build cellId -> (seriesIndex, dataIndex) mapping for highlight
  const cellMap = new Map()
  let sIdx = 0
  groups.forEach((groupCells, groupName) => {
    if (isBar) {
      // For bar charts, cells within a group map to xCategory indices
      groupCells.forEach(cell => {
        const xCat = String(cell[config.xAxis])
        const dIdx = xCategories.indexOf(xCat)
        if (dIdx !== -1) cellMap.set(cell.id, { seriesIndex: sIdx, dataIndex: dIdx })
      })
    } else {
      const sortedCells = isLine
        ? [...groupCells].sort((a, b) => (a[config.xAxis] ?? 0) - (b[config.xAxis] ?? 0))
        : groupCells
      sortedCells.forEach((cell, dIdx) => {
        cellMap.set(cell.id, { seriesIndex: sIdx, dataIndex: dIdx })
      })
    }
    sIdx++ // primary series
    if (config.yAxisSecondary) sIdx++ // secondary series
  })
  option._cellMap = cellMap

  return option
})

function renderChart() {
  if (!chartContainer.value) return
  if (!chartInstance) {
    chartInstance = echarts.init(chartContainer.value)
  }
  chartInstance.setOption(chartOption.value, true)
}

let resizeObserver = null
const handleWindowResize = () => chartInstance?.resize()

onMounted(() => {
  renderChart()
  window.addEventListener('resize', handleWindowResize)
  if (typeof ResizeObserver !== 'undefined' && chartContainer.value) {
    resizeObserver = new ResizeObserver(() => chartInstance?.resize())
    resizeObserver.observe(chartContainer.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
  resizeObserver?.disconnect()
  chartInstance?.dispose()
  chartInstance = null
})

watch(chartOption, () => renderChart(), { deep: true })

defineExpose({
  getChartImage: (pixelRatio = 2) =>
    chartInstance?.getDataURL({ type: 'png', pixelRatio, backgroundColor: '#fff' }) ?? null,
  resize: () => chartInstance?.resize(),
  highlightCells(cellIds) {
    if (!chartInstance) return
    chartInstance.dispatchAction({ type: 'downplay' })
    const cellMap = chartOption.value._cellMap
    if (!cellMap) return
    cellIds.forEach(id => {
      const entry = cellMap.get(id)
      if (entry) {
        chartInstance.dispatchAction({
          type: 'highlight',
          seriesIndex: entry.seriesIndex,
          dataIndex: entry.dataIndex
        })
      }
    })
  },
  unhighlightAll() {
    chartInstance?.dispatchAction({ type: 'downplay' })
  }
})
</script>

<template>
  <div class="chart-display">
    <div ref="chartContainer" class="chart-container" />
  </div>
</template>

<style scoped>
.chart-display {
  height: 100%;
}

.chart-container {
  width: 100%;
  height: 100%;
  min-height: 460px;
}
</style>
