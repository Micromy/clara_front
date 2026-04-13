<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  chartData: { type: Object, required: true }
})

const chartContainer = ref(null)
let chartInstance = null

const COLORS = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
  '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#4dc9f6'
]

function getAxisLabel(key) {
  const labels = {
    voltage: 'Voltage (V)',
    currentMA: 'Current (mA)',
    currentUA: 'Current (μA)',
    temp: 'Temperature (°C)',
    vdd: 'VDD (V)'
  }
  return labels[key] || key
}

const chartOption = computed(() => {
  const { cells, config } = props.chartData
  if (!cells || cells.length === 0) return {}

  const series = cells.map((cell, idx) => {
    const data = cell.ivData.map(point => [point[config.xAxis], point[config.yAxisPrimary]])
    return {
      name: cell.alias || cell.cellName,
      type: config.chartType === 'scatter' ? 'scatter' : 'line',
      data,
      smooth: true,
      symbol: config.chartType === 'scatter' ? 'circle' : 'none',
      lineStyle: { width: 2 },
      itemStyle: { color: COLORS[idx % COLORS.length] }
    }
  })

  const option = {
    title: {
      text: `${props.chartData.builderName}`,
      left: 'center',
      textStyle: { fontSize: 14 }
    },
    tooltip: {
      trigger: 'axis',
      formatter(params) {
        if (!Array.isArray(params)) params = [params]
        let html = `<strong>${getAxisLabel(config.xAxis)}: ${params[0].data[0]}</strong><br/>`
        params.forEach(p => {
          html += `<span style="color:${p.color}">●</span> ${p.seriesName}: ${p.data[1]}<br/>`
        })
        return html
      }
    },
    legend: {
      type: 'scroll',
      orient: 'horizontal',
      bottom: 6,
      left: 'center',
      width: '92%',
      itemGap: 14,
      itemWidth: 16,
      itemHeight: 10,
      pageIconSize: 10,
      pageTextStyle: { fontSize: 11, color: '#909399' },
      textStyle: { fontSize: 11, color: '#606266' }
    },
    grid: {
      left: 60,
      right: config.yAxisSecondary ? 60 : 30,
      top: 50,
      bottom: 72
    },
    xAxis: {
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

  // Add secondary Y-axis
  if (config.yAxisSecondary) {
    option.yAxis.push({
      type: 'value',
      name: getAxisLabel(config.yAxisSecondary),
      nameLocation: 'center',
      nameGap: 40,
      position: 'right'
    })

    // Add secondary series
    cells.forEach((cell, idx) => {
      const data = cell.ivData.map(point => [point[config.xAxis], point[config.yAxisSecondary]])
      option.series.push({
        name: `${cell.alias || cell.cellName} (${getAxisLabel(config.yAxisSecondary)})`,
        type: config.chartType === 'scatter' ? 'scatter' : 'line',
        yAxisIndex: 1,
        data,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1, type: 'dashed' },
        itemStyle: { color: COLORS[idx % COLORS.length] }
      })
    })
  }

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
