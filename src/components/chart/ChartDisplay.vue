<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  chartData: { type: Object, required: true }
})

const chartContainer = ref(null)
let chartInstance = null
const labelsOn = ref(false)

const LABEL_ICON_OFF = 'image://data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4078C0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="4" x2="18" y2="4"/><line x1="12" y1="4" x2="12" y2="20"/></svg>')
const LABEL_ICON_ON = 'image://data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><rect x="1" y="1" width="22" height="22" rx="4" fill="#4078C0"/><line x1="7" y1="6" x2="17" y2="6" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><line x1="12" y1="6" x2="12" y2="19" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>')

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
    title: {
      text: props.chartData.builderName,
      left: 0,
      top: 0,
      textStyle: { fontSize: 14, fontWeight: 600, color: '#303133', fontFamily: 'Segoe UI, system-ui, -apple-system, sans-serif' }
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
      right: 30,
      top: 55,
      bottom: 20,
      width: 240,
      itemGap: 8,
      itemWidth: 14,
      itemHeight: 10,
      pageIconSize: 10,
      pageTextStyle: { fontSize: 11, color: '#909399' },
      textStyle: { fontSize: 11, color: '#606266', overflow: 'truncate', width: 200 }
    },
    grid: {
      left: 80,
      right: config.yAxisSecondary ? 300 : 240,
      top: 50,
      bottom: 50
    },
    toolbox: {
      show: true,
      right: 230,
      top: 6,
      itemSize: 16,
      itemGap: 12,
      showTitle: false,
      tooltip: { show: true },
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
        restore: {
          title: 'Reset',
          icon: 'image://data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4078C0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 105.64-11.36L1 10"/></svg>')
        },
        saveAsImage: {
          title: 'Save PNG',
          icon: 'image://data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4078C0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>')
        }
      }
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, yAxisIndex: 0, filterMode: 'none',
        zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: false,
        minSpan: 0, maxSpan: 100, startValue: null, endValue: null }
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
          name: getAxisLabel(config.xAxis),
          nameLocation: 'center',
          nameGap: 30
        },
    yAxis: [
      {
        type: 'value',
        scale: true,
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
      labelLayout: val ? { moveOverlap: 'shiftY', hideOverlap: true } : undefined
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
