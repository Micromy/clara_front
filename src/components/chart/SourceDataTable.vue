<script setup>
const props = defineProps({
  chartData: { type: Object, required: true }
})
</script>

<template>
  <div class="source-data-table">
    <h3 class="panel-title">Source Data</h3>
    <el-table
      :data="props.chartData.cells"
      border
      stripe
      size="small"
      max-height="440"
    >
      <el-table-column prop="alias" label="Alias" width="120" show-overflow-tooltip />
      <el-table-column prop="cellName" label="Cell Name" width="140" show-overflow-tooltip />
      <el-table-column label="Data Points" width="100">
        <template #default="{ row }">
          {{ row.ivData?.length || 0 }} pts
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.panel-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #303133;
}
</style>
