<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  chartData: { type: Object, required: true }
})

const chartContainer = ref(null)
let chartInstance = null
const labelsOn = ref(false)

const LABEL_ICON_OFF = 'image://data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4078C0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>')
const LABEL_ICON_ON = 'image://data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" fill="#4078C0" stroke="#4078C0" stroke-width="2"/><circle cx="7" cy="7" r="1.5" fill="#fff"/></svg>')

const COLORS = [
  '#2563EB', '#E63946', '#2D9F46', '#E88C1E', '#8B5CF6',
  '#0891B2', '#DC2626', '#16A34A', '#CA8A04', '#7C3AED'
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

  const animationDuration = 300

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
  if (config.grouping === '__none__') {
    groups.set('All', cells)
  } else {
    cells.forEach(cell => {
      const raw = cell[config.grouping]
      const key = (raw != null && String(raw).trim() !== '') ? String(raw) : cell.cellName
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(cell)
    })
  }

  // For bar chart: collect unique X values as categories (sorted)
  let xCategories = null
  if (isBar) {
    const xVals = new Set(cells.map(c => c[config.xAxis]))
    xCategories = [...xVals].map(String).sort((a, b) => {
      const numA = Number(a), numB = Number(b)
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB
      return a.localeCompare(b)
    })
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
      series.push({
        name: groupName, type: 'bar', data, itemStyle: { color },
        emphasis: { focus: 'self', itemStyle: { borderWidth: 2, borderColor: '#000' } },
        blur: { itemStyle: { opacity: 0.3 }, lineStyle: { opacity: 0.15 } },
        label: { show: props.showLabels, position: 'top', fontSize: 10, formatter: () => groupName }
      })
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
        symbolSize: isLine ? 6 : 10,
        lineStyle: { width: 2 },
        itemStyle: { color },
        emphasis: { focus: 'self', itemStyle: { borderWidth: 2, borderColor: '#000' } },
        blur: { itemStyle: { opacity: 0.3 }, lineStyle: { opacity: 0.15 } },
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
          emphasis: { focus: 'self', itemStyle: { borderWidth: 2, borderColor: '#000' } },
        blur: { itemStyle: { opacity: 0.3 }, lineStyle: { opacity: 0.15 } },
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
          symbolSize: isLineSec ? 6 : 10,
          lineStyle: { width: 1, type: 'dashed' },
          itemStyle: { color },
          emphasis: { focus: 'self', itemStyle: { borderWidth: 2, borderColor: '#000' } },
        blur: { itemStyle: { opacity: 0.3 }, lineStyle: { opacity: 0.15 } },
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
    animationDuration,
    animationDurationUpdate: animationDuration,
    title: {
      text: props.chartData.builderName,
      left: 0,
      top: 0,
      textStyle: { fontSize: 14, fontWeight: 600, color: '#303133', fontFamily: 'Segoe UI, system-ui, -apple-system, sans-serif' }
    },
    tooltip: {
      trigger: isBar ? 'axis' : 'item',
      formatter(params) {
        const fmt = v => typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(8) : v
        if (!Array.isArray(params)) params = [params]
        if (isBar) {
          const xVal = params[0]?.name
          let html = `<strong>${getAxisLabel(config.xAxis)}: ${fmt(xVal)}</strong><br/>`
          params.forEach(p => {
            if (p.value != null) {
              html += `<span style="color:${p.color}">●</span> ${p.seriesName}: ${fmt(p.value)}<br/>`
            }
          })
          return html
        }
        let html = ''
        params.forEach(p => {
          const [x, y] = Array.isArray(p.data) ? p.data : [null, p.data]
          html += `<span style="color:${p.color}">●</span> <strong>${p.seriesName}</strong><br/>`
          html += `&nbsp;&nbsp;${getAxisLabel(config.xAxis)}: ${fmt(x)}<br/>`
          html += `&nbsp;&nbsp;${getAxisLabel(p.yAxisIndex === 1 ? config.yAxisSecondary : config.yAxisPrimary)}: ${fmt(y)}<br/>`
        })
        return html
      }
    },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      top: 50,
      bottom: 20,
      itemGap: 8,
      itemWidth: 14,
      itemHeight: 10,
      pageIconSize: 10,
      pageTextStyle: { fontSize: 11, color: '#909399' },
      textStyle: { fontSize: 11, color: '#606266', overflow: 'truncate', width: 320 }
    },
    grid: {
      left: 60,
      right: config.yAxisSecondary ? 390 : 370,
      top: 50,
      bottom: 40
    },
    toolbox: {
      show: true,
      right: 360,
      top: 5,
      itemSize: 18,
      itemGap: 12,
      showTitle: false,
      tooltip: {
        show: true,
        formatter: function(param) { return param.title }
      },
      iconStyle: {
        borderColor: 'transparent',
        borderWidth: 0
      },
      emphasis: {
        iconStyle: {
          borderColor: 'transparent'
        }
      },
      feature: {
        myLabels: {
          show: true,
          title: labelsOn.value ? 'Hide Labels' : 'Show Labels',
          icon: labelsOn.value ? LABEL_ICON_ON : LABEL_ICON_OFF,
          onclick: function() {
            labelsOn.value = !labelsOn.value
          }
        },
        dataZoom: {
          title: { zoom: 'Box zoom', back: 'Undo zoom' },
          icon: {
            zoom: 'image://data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4078C0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="11" y1="8" x2="11" y2="14"/></svg>'),
            back: 'image://data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4078C0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 00-4-4H4"/></svg>')
          }
        },
        myReset: {
          show: true,
          title: 'Reset view',
          icon: 'image://data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4078C0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 105.64-11.36L1 10"/></svg>'),
          onclick: function() {
            if (chartInstance) chartInstance.dispatchAction({ type: 'restore' })
            labelsOn.value = false
          }
        },
        mySave: {
          show: true,
          title: 'Save as image',
          icon: 'image://data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4078C0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'),
          onclick: function() {
            if (!chartInstance) return
            const url = chartInstance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' })
            const a = document.createElement('a')
            a.href = url
            a.download = 'chart.png'
            a.click()
          }
        }
      }
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, filterMode: 'none',
        zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: false,
        start: 0, end: 100, zoomLock: false, throttle: 50 }
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
          scale: true,
          boundaryGap: ['5%', '5%'],
          name: getAxisLabel(config.xAxis),
          nameLocation: 'center',
          nameGap: 30
        },
    yAxis: [
      {
        type: 'value',
        scale: true,
        boundaryGap: ['5%', '5%'],
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
      scale: true,
      boundaryGap: ['5%', '5%'],
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

function updateLegendPosition() {
  if (!chartInstance || !chartContainer.value) return
  const gridRight = chartOption.value.grid?.right || 370
  const containerWidth = chartContainer.value.clientWidth
  const legendLeft = containerWidth - gridRight + 15
  chartInstance.setOption({ legend: { left: legendLeft, width: gridRight - 30 } }, false)
}

function renderChart() {
  if (!chartContainer.value) return
  if (!chartInstance) {
    chartInstance = echarts.init(chartContainer.value)
  }
  chartInstance.setOption(chartOption.value, true)
  updateLegendPosition()
}

let resizeObserver = null
const handleWindowResize = () => { chartInstance?.resize(); updateLegendPosition() }

let shiftHeld = false
function onKeyDown(e) {
  if (e.key === 'Shift' && chartInstance && !shiftHeld) {
    shiftHeld = true
    chartInstance.dispatchAction({ type: 'takeGlobalCursor', key: 'dataZoomSelect', dataZoomSelectActive: true })
  }
}
function onKeyUp(e) {
  if (e.key === 'Shift' && chartInstance) {
    shiftHeld = false
    chartInstance.dispatchAction({ type: 'takeGlobalCursor', key: 'dataZoomSelect', dataZoomSelectActive: false })
  }
}

function onChartDblClick(e) {
  if (e.shiftKey && chartInstance) {
    chartInstance.dispatchAction({ type: 'dataZoom', start: 0, end: 100 })
  }
}

onMounted(() => {
  renderChart()
  window.addEventListener('resize', handleWindowResize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  chartContainer.value?.addEventListener('dblclick', onChartDblClick)
  if (typeof ResizeObserver !== 'undefined' && chartContainer.value) {
    resizeObserver = new ResizeObserver(() => { chartInstance?.resize(); updateLegendPosition() })
    resizeObserver.observe(chartContainer.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  chartContainer.value?.removeEventListener('dblclick', onChartDblClick)
  resizeObserver?.disconnect()
  chartInstance?.dispose()
  chartInstance = null
})

watch(chartOption, () => renderChart(), { deep: true })
watch(labelsOn, (val) => {
  if (!chartInstance) return
  const opt = chartInstance.getOption()
  chartInstance.setOption({
    series: opt.series.map(s => ({
      label: {
        show: val,
        position: 'top',
        fontSize: 12,
        color: '#303133',
        backgroundColor: '#fff',
        borderColor: '#dcdfe6',
        borderWidth: 1,
        padding: [3, 6],
        distance: 12,
        overflow: 'truncate',
        formatter: (p) => p.seriesName
      },
      labelLine: {
        show: val,
        lineStyle: { color: '#ccc', width: 1 }
      },
      labelLayout: val ? { moveOverlap: 'shiftY', hideOverlap: false } : undefined
    })),
    toolbox: {
      feature: {
        myLabels: {
          icon: val ? LABEL_ICON_ON : LABEL_ICON_OFF,
          title: val ? 'Hide Labels' : 'Show Labels'
        }
      }
    }
  })
})

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
  overflow: hidden;
}

.chart-container {
  width: 100%;
  height: 100%;
  min-height: 460px;
}
</style>
