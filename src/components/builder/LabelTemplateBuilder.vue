<script setup>
import { computed, ref } from 'vue'
import { useBuilderStore } from '../../stores/builderStore.js'

const store = useBuilderStore()
const popoverVisible = ref(false)

const template = computed(() => store.activeBuilder?.labelTemplate || [])
const hasNote = computed(() => template.value.some(t => t.type === 'note'))

const fieldLabelMap = computed(() => {
  const m = {}
  store.labelableFields.forEach(f => { m[f.value] = f.label })
  return m
})

function tokenLabel(tok) {
  if (tok.type === 'field') return fieldLabelMap.value[tok.field] || tok.field
  if (tok.type === 'note') return 'Note'
  return '?'
}

function tokenDesc(tok) {
  if (tok.type === 'field') return `Field: ${tokenLabel(tok)}`
  if (tok.type === 'note') return 'Per-cell user note'
  return ''
}

function onAddField(value) {
  store.addLabelToken({ type: 'field', field: value })
  popoverVisible.value = false
}

function onAddNote() {
  if (hasNote.value) return
  store.addLabelToken({ type: 'note' })
  popoverVisible.value = false
}

function onRemove(i) {
  store.removeLabelToken(i)
}

// Drag reorder
const dragFrom = ref(-1)
function onDragStart(e, i) {
  dragFrom.value = i
  e.dataTransfer.effectAllowed = 'move'
}
function onDragOver(e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}
function onDrop(i) {
  if (dragFrom.value < 0 || dragFrom.value === i) {
    dragFrom.value = -1
    return
  }
  store.moveLabelToken(dragFrom.value, i)
  dragFrom.value = -1
}
function onDragEnd() { dragFrom.value = -1 }
</script>

<template>
  <div class="label-template-builder">
    <span class="lt-label">Label</span>

    <div class="lt-chips">
      <div
        v-for="(tok, i) in template"
        :key="`${tok.type}-${tok.field || tok.text || ''}-${i}`"
        class="lt-chip"
        :class="[`lt-chip-${tok.type}`, { 'lt-chip-dragging': dragFrom === i }]"
        :title="tokenDesc(tok)"
        draggable="true"
        @dragstart="onDragStart($event, i)"
        @dragover="onDragOver"
        @drop.prevent="onDrop(i)"
        @dragend="onDragEnd"
      >
        <span class="lt-chip-text">{{ tokenLabel(tok) }}</span>
        <span class="lt-chip-x" @click.stop="onRemove(i)">×</span>
      </div>

      <el-popover
        v-model:visible="popoverVisible"
        trigger="click"
        placement="bottom-start"
        :width="280"
        popper-class="lt-popover"
      >
        <template #reference>
          <button class="lt-add-btn" :title="'Add field or note'">+</button>
        </template>
        <div class="lt-add-panel">
          <div class="lt-add-section">
            <div class="lt-section-title">Field</div>
            <div class="lt-field-list">
              <div
                v-for="f in store.labelableFields"
                :key="f.value"
                class="lt-add-item"
                @click="onAddField(f.value)"
              >{{ f.label }}</div>
            </div>
          </div>
          <div class="lt-add-section">
            <button
              class="lt-note-btn"
              :class="{ 'lt-note-btn-disabled': hasNote }"
              :disabled="hasNote"
              @click="onAddNote"
            >
              <span>+ Note (per-cell)</span>
              <span v-if="hasNote" class="lt-note-hint">already added</span>
            </button>
          </div>
        </div>
      </el-popover>
    </div>

    <span v-if="template.length === 0" class="lt-empty">empty — labels will be blank</span>
  </div>
</template>

<style scoped>
.label-template-builder {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 7px 12px;
  background: #f8fafb;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  font-size: 12.5px;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}
.label-template-builder.lt-flash {
  animation: lt-flash-anim 1.2s ease;
}
@keyframes lt-flash-anim {
  0%, 100% { box-shadow: 0 0 0 0 rgba(64,120,192,0); border-color: #ebeef5; }
  30% { box-shadow: 0 0 0 4px rgba(64,120,192,0.25); border-color: var(--clara-primary, #4078C0); }
}
.lt-label {
  color: #606266;
  font-weight: 600;
  letter-spacing: 0.3px;
  font-size: 11.5px;
  text-transform: uppercase;
}
.lt-chips {
  display: flex; flex-wrap: wrap; gap: 5px; align-items: center;
}
.lt-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 4px 2px 9px;
  border-radius: 11px;
  font-size: 12px;
  cursor: grab;
  user-select: none;
  background: #fff;
  border: 1px solid #dcdfe6;
  color: #303133;
  transition: opacity 0.15s ease, border-color 0.15s ease;
}
.lt-chip:hover { border-color: #c0c4cc; }
.lt-chip:active, .lt-chip-dragging { cursor: grabbing; opacity: 0.5; }
.lt-chip-note .lt-chip-text { font-style: italic; }
.lt-chip-text { font-weight: 500; line-height: 1; }
.lt-chip-x {
  font-size: 13px; cursor: pointer;
  padding: 0 4px;
  border-radius: 50%;
  opacity: 0.4;
  transition: opacity 0.15s ease, color 0.15s ease;
  line-height: 1;
}
.lt-chip-x:hover { opacity: 1; color: #f56c6c; }

.lt-add-btn {
  width: 22px; height: 22px;
  border-radius: 11px;
  border: 1px dashed #c0c4cc;
  background: transparent;
  color: #909399;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  display: inline-flex; align-items: center; justify-content: center;
  transition: all 0.15s ease;
  padding: 0;
}
.lt-add-btn:hover {
  border-color: var(--clara-primary, #4078C0);
  color: var(--clara-primary, #4078C0);
  background: rgba(64,120,192,0.06);
}
.lt-empty {
  color: #c0c4cc;
  font-style: italic;
  font-size: 11.5px;
}
</style>

<style>
.lt-popover { padding: 12px !important; }
.lt-add-panel { display: flex; flex-direction: column; gap: 10px; }
.lt-add-section { display: flex; flex-direction: column; gap: 4px; }
.lt-section-title {
  font-size: 10.5px; font-weight: 700; color: #909399;
  text-transform: uppercase; letter-spacing: 0.6px;
  margin: 0;
}
.lt-field-list {
  display: grid; grid-template-columns: 1fr 1fr; gap: 2px;
  max-height: 200px; overflow-y: auto;
}
.lt-add-item {
  padding: 5px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12.5px;
  color: #303133;
  transition: background 0.12s ease, color 0.12s ease;
}
.lt-add-item:hover {
  background: rgba(64,120,192,0.08);
  color: var(--clara-primary, #4078C0);
}
.lt-note-btn {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  height: 28px; padding: 0 10px;
  background: rgba(103,194,58,0.10);
  color: #5b8a26;
  border: 1px solid rgba(103,194,58,0.28);
  border-radius: 5px;
  cursor: pointer;
  font-size: 12.5px; font-weight: 500;
  transition: all 0.12s ease;
}
.lt-note-btn:hover:not(.lt-note-btn-disabled) { background: rgba(103,194,58,0.18); }
.lt-note-btn-disabled {
  background: #f5f7fa;
  color: #c0c4cc;
  border-color: #ebeef5;
  cursor: not-allowed;
}
.lt-note-hint { font-size: 10.5px; font-style: italic; }
</style>
