<script setup>
import { useBuilderStore } from '../../stores/builderStore.js'

const store = useBuilderStore()

function updateAlias(cellId, value) {
  store.setCellAlias(store.activeBuilder.id, cellId, value)
}

function getAlias(cellId) {
  return store.getCellAlias(store.activeBuilder.id, cellId)
}

function removeCell(cellId) {
  store.toggleCellSelection(cellId)
}
</script>

<template>
  <div class="selected-cells-panel">
    <h3 class="panel-title">Selected Cells</h3>
    <el-table
      :data="store.selectedCells"
      border
      stripe
      size="small"
      max-height="240"
      empty-text="No cells selected. Select cells from the table above."
    >
      <el-table-column label="Alias" width="140">
        <template #default="{ row }">
          <el-input
            :model-value="getAlias(row.id)"
            @update:model-value="val => updateAlias(row.id, val)"
            size="small"
            :placeholder="row.cellName"
          />
        </template>
      </el-table-column>
      <el-table-column prop="cellName" label="Cell Name" width="150" show-overflow-tooltip />
      <el-table-column prop="lot" label="Lot" width="100" />
      <el-table-column prop="wafer" label="Wafer" width="80" />
      <el-table-column prop="gateLength" label="Gate Length" width="90" />
      <el-table-column prop="cpp" label="CPP" width="70" />
      <el-table-column prop="nanosheet" label="Nanosheet" width="100" />
      <el-table-column prop="driveStrength" label="Drive Str." width="90" />
      <el-table-column prop="feolCorner" label="FEOL" width="80" />
      <el-table-column prop="beolCorner" label="BEOL" width="80" />
      <el-table-column label="" width="50" fixed="right">
        <template #default="{ row }">
          <el-button
            type="danger"
            link
            size="small"
            @click="removeCell(row.id)"
          >✕</el-button>
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
