<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  chartData: { type: Object, required: true }
})

const chartContainer = ref(null)
let chartInstance = null
const labelsOn = ref(false)
const labelOverlays = ref([])
const labelOffsets = ref({})
let labelDragState = null
let overlayRaf = 0
let measureCanvas = null

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
  const isXLabel = config.xAxis === '__label__' || config.xAxis === 'label'

  // Secondary type must be compatible with primary's x-axis type
  const rawSecType = config.chartTypeSecondary || config.chartType
  const secType = isBar
    ? (rawSecType === 'bar' ? 'bar' : 'line')
    : (rawSecType === 'bar' ? 'scatter' : rawSecType)
  const isBarSec = secType === 'bar'
  const isLineSec = secType === 'line'

  const EMPTY_LABEL = '(no label)'
  const labelOf = c => c.label || EMPTY_LABEL
  const xValueOf = c => isXLabel ? labelOf(c) : c[config.xAxis]

  // Series grouping rules:
  //   bar          → single series (X already encodes the grouping dimension)
  //   scatter/line → group by cell.label (each unique label is a series/color)
  const groups = new Map()
  if (isBar) {
    groups.set('All', cells)
  } else {
    cells.forEach(cell => {
      const key = labelOf(cell)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(cell)
    })
  }

  // For bar chart: collect unique X values as categories (sorted)
  let xCategories = null
  if (isBar) {
    const xVals = new Set(cells.map(xValueOf))
    xCategories = [...xVals].map(v => v == null ? '' : String(v)).sort((a, b) => {
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
        const matching = groupCells.filter(c => {
          const v = xValueOf(c)
          return (v == null ? '' : String(v)) === xCat
        })
        if (!matching.length) return null
        const ys = matching.map(c => c[config.yAxisPrimary]).filter(v => typeof v === 'number')
        if (!ys.length) return null
        return ys.reduce((s, v) => s + v, 0) / ys.length
      })
      series.push({
        name: groupName, type: 'bar', data, itemStyle: { color },
        emphasis: { focus: 'self', itemStyle: { borderWidth: 2, borderColor: '#000' } },
        blur: { itemStyle: { opacity: 0.5 }, lineStyle: { opacity: 0.3 } },
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
        blur: { itemStyle: { opacity: 0.5 }, lineStyle: { opacity: 0.3 } },
      })
    }

    // Secondary Y-axis series
    if (config.yAxisSecondary) {
      if (isBarSec) {
        // isBarSec is only true when primary is also bar (xCategories always exists here)
        const data = xCategories.map(xCat => {
          const matching = groupCells.filter(c => {
            const v = xValueOf(c)
            return (v == null ? '' : String(v)) === xCat
          })
          if (!matching.length) return null
          const ys = matching.map(c => c[config.yAxisSecondary]).filter(v => typeof v === 'number')
          if (!ys.length) return null
          return ys.reduce((s, v) => s + v, 0) / ys.length
        })
        series.push({
          name: `${groupName} (${getAxisLabel(config.yAxisSecondary)})`,
          type: 'bar',
          yAxisIndex: 1,
          data,
          itemStyle: { color, opacity: 0.6 },
          emphasis: { focus: 'self', itemStyle: { borderWidth: 2, borderColor: '#000' } },
        blur: { itemStyle: { opacity: 0.5 }, lineStyle: { opacity: 0.3 } },
          barGap: '30%',
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
        blur: { itemStyle: { opacity: 0.5 }, lineStyle: { opacity: 0.3 } },
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
          onclick: async function() {
            const url = await exportChartImage(2)
            if (!url) return
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
        const v = xValueOf(cell)
        const xCat = v == null ? '' : String(v)
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

function rebuildLabelOverlays() {
  if (!labelsOn.value || !chartInstance) {
    labelOverlays.value = []
    return
  }

  const option = chartOption.value
  const overlays = []
  const xCategories = Array.isArray(option.xAxis?.data) ? option.xAxis.data : []

  option.series.forEach((series, seriesIndex) => {
    const yAxisIndex = series.yAxisIndex || 0

    if (series.type === 'bar') {
      series.data.forEach((yVal, dataIndex) => {
        if (yVal == null) return
        const xVal = xCategories[dataIndex]
        const pixel = chartInstance.convertToPixel({ xAxisIndex: 0, yAxisIndex }, [xVal, yVal])
        if (!Array.isArray(pixel) || !Number.isFinite(pixel[0]) || !Number.isFinite(pixel[1])) return
        const key = `${seriesIndex}:${dataIndex}`
        const offset = labelOffsets.value[key] || { dx: 10, dy: -28 }
        overlays.push({
          key,
          text: series.name,
          anchorX: pixel[0],
          anchorY: pixel[1],
          x: pixel[0] + offset.dx,
          y: pixel[1] + offset.dy
        })
      })
      return
    }

    series.data.forEach((point, dataIndex) => {
      if (!Array.isArray(point) || point.length < 2) return
      const [xVal, yVal] = point
      if (xVal == null || yVal == null) return
      const pixel = chartInstance.convertToPixel({ xAxisIndex: 0, yAxisIndex }, [xVal, yVal])
      if (!Array.isArray(pixel) || !Number.isFinite(pixel[0]) || !Number.isFinite(pixel[1])) return
      const key = `${seriesIndex}:${dataIndex}`
      const offset = labelOffsets.value[key] || { dx: 10, dy: -28 }
      overlays.push({
        key,
        text: series.name,
        anchorX: pixel[0],
        anchorY: pixel[1],
        x: pixel[0] + offset.dx,
        y: pixel[1] + offset.dy
      })
    })
  })

  labelOverlays.value = overlays
}

function scheduleLabelOverlayRebuild() {
  if (!labelsOn.value) return
  if (overlayRaf) cancelAnimationFrame(overlayRaf)
  overlayRaf = requestAnimationFrame(() => {
    overlayRaf = 0
    rebuildLabelOverlays()
  })
}

function measureLabelBox(text) {
  if (!measureCanvas) measureCanvas = document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  ctx.font = '12px Segoe UI, system-ui, -apple-system, sans-serif'
  const textWidth = Math.ceil(ctx.measureText(text).width)
  return {
    width: textWidth + 12,
    height: 22,
    textX: 6
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function drawOverlayLabels(ctx, pixelRatio) {
  ctx.save()
  ctx.scale(pixelRatio, pixelRatio)

  labelOverlays.value.forEach(label => {
    const box = measureLabelBox(label.text)

    ctx.beginPath()
    ctx.moveTo(label.anchorX, label.anchorY)
    ctx.lineTo(label.x + 8, label.y + 13)
    ctx.strokeStyle = '#c7cbd4'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#dcdfe6'
    ctx.lineWidth = 1
    ctx.fillRect(label.x, label.y, box.width, box.height)
    ctx.strokeRect(label.x, label.y, box.width, box.height)

    ctx.font = '12px Segoe UI, system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#303133'
    ctx.fillText(label.text, label.x + box.textX, label.y + (box.height / 2))
  })

  ctx.restore()
}

async function exportChartImage(pixelRatio = 2) {
  if (!chartInstance || !chartContainer.value) return null
  const baseUrl = chartInstance.getDataURL({ type: 'png', pixelRatio, backgroundColor: '#fff' })
  if (!labelsOn.value) return baseUrl

  const rect = chartContainer.value.getBoundingClientRect()
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(rect.width * pixelRatio)
  canvas.height = Math.round(rect.height * pixelRatio)
  const ctx = canvas.getContext('2d')
  if (!ctx) return baseUrl

  const img = await loadImage(baseUrl)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  drawOverlayLabels(ctx, pixelRatio)
  return canvas.toDataURL('image/png')
}

function syncDraggedOverlay(key, dx, dy) {
  const target = labelOverlays.value.find(l => l.key === key)
  if (!target) return
  target.x = target.anchorX + dx
  target.y = target.anchorY + dy
}

function stopLabelDrag() {
  labelDragState = null
  document.removeEventListener('pointermove', onLabelPointerMove)
  document.removeEventListener('pointerup', stopLabelDrag)
}

function onLabelPointerMove(e) {
  if (!labelDragState) return
  const dx = labelDragState.baseDx + (e.clientX - labelDragState.startX)
  const dy = labelDragState.baseDy + (e.clientY - labelDragState.startY)
  labelOffsets.value = {
    ...labelOffsets.value,
    [labelDragState.key]: { dx, dy }
  }
  syncDraggedOverlay(labelDragState.key, dx, dy)
}

function onLabelPointerDown(e, label) {
  if (e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  const base = labelOffsets.value[label.key] || { dx: 10, dy: -28 }
  labelDragState = {
    key: label.key,
    startX: e.clientX,
    startY: e.clientY,
    baseDx: base.dx,
    baseDy: base.dy
  }
  document.addEventListener('pointermove', onLabelPointerMove)
  document.addEventListener('pointerup', stopLabelDrag, { once: true })
}

function renderChart() {
  if (!chartContainer.value) return
  if (!chartInstance) {
    chartInstance = echarts.init(chartContainer.value)
    chartInstance.on('finished', () => {
      updateLegendPosition()
      scheduleLabelOverlayRebuild()
    })
    chartInstance.on('datazoom', scheduleLabelOverlayRebuild)
    chartInstance.on('restore', () => {
      updateLegendPosition()
      scheduleLabelOverlayRebuild()
    })
    chartInstance.on('georoam', scheduleLabelOverlayRebuild)
  }
  chartInstance.setOption(chartOption.value, true)
  updateLegendPosition()
  scheduleLabelOverlayRebuild()
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
    resizeObserver = new ResizeObserver(() => {
      chartInstance?.resize()
      updateLegendPosition()
      scheduleLabelOverlayRebuild()
    })
    resizeObserver.observe(chartContainer.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  chartContainer.value?.removeEventListener('dblclick', onChartDblClick)
  stopLabelDrag()
  if (overlayRaf) cancelAnimationFrame(overlayRaf)
  resizeObserver?.disconnect()
  chartInstance?.dispose()
  chartInstance = null
})

watch(chartOption, () => renderChart(), { deep: true })
watch(labelsOn, (val) => {
  if (!val) {
    labelOverlays.value = []
    return
  }
  scheduleLabelOverlayRebuild()
})

defineExpose({
  getChartImage: async (pixelRatio = 2) =>
    exportChartImage(pixelRatio),
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
    <div v-if="labelsOn" class="label-layer">
      <svg class="label-lines" aria-hidden="true">
        <line
          v-for="label in labelOverlays"
          :key="`${label.key}-line`"
          :x1="label.anchorX"
          :y1="label.anchorY"
          :x2="label.x + 8"
          :y2="label.y + 13"
        />
      </svg>
      <div
        v-for="label in labelOverlays"
        :key="label.key"
        class="label-chip"
        :style="{ transform: `translate(${label.x}px, ${label.y}px)` }"
        @pointerdown="onLabelPointerDown($event, label)"
      >
        {{ label.text }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-display {
  position: relative;
  height: 100%;
  overflow: hidden;
}

.chart-container {
  width: 100%;
  height: 100%;
  min-height: 460px;
}

.label-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}

.label-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.label-lines line {
  stroke: #c7cbd4;
  stroke-width: 1;
}

.label-chip {
  position: absolute;
  pointer-events: auto;
  user-select: none;
  cursor: grab;
  white-space: nowrap;
  font-size: 12px;
  color: #303133;
  background: #fff;
  border: 1px solid #dcdfe6;
  padding: 3px 6px;
  line-height: 1.3;
  transform-origin: top left;
}

.label-chip:active {
  cursor: grabbing;
}
</style>
