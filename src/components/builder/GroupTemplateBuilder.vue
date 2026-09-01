<script setup>
import { computed, ref } from 'vue'
import { useBuilderStore } from '../../stores/builderStore.js'

const store = useBuilderStore()
const popoverVisible = ref(false)

const template = computed(() => store.activeBuilder?.groupTemplate || [])
const hasTag = computed(() => template.value.some(t => t.type === 'tag'))

const fieldLabelMap = computed(() => {
  const m = {}
  store.groupableFields.forEach(f => { m[f.value] = f.label })
  return m
})

function tokenLabel(tok) {
  if (tok.type === 'field') return fieldLabelMap.value[tok.field] || tok.field
  if (tok.type === 'tag') return 'Tag'
  return '?'
}

function tokenDesc(tok) {
  if (tok.type === 'field') return `Field: ${tokenLabel(tok)}`
  if (tok.type === 'tag') return 'Per-cell user tag'
  return ''
}

function onAddField(value) {
  store.addGroupToken({ type: 'field', field: value })
  popoverVisible.value = false
}

function onAddTag() {
  if (hasTag.value) return
  store.addGroupToken({ type: 'tag' })
  popoverVisible.value = false
}

function onRemove(i) {
  store.removeGroupToken(i)
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
  store.moveGroupToken(dragFrom.value, i)
  dragFrom.value = -1
}
function onDragEnd() { dragFrom.value = -1 }
</script>

<template>
  <div class="group-template-builder">
    <span class="lt-label">Group</span>

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
                v-for="f in store.groupableFields"
                :key="f.value"
                class="lt-add-item"
                @click="onAddField(f.value)"
              >{{ f.label }}</div>
              <div
                class="lt-add-item"
                :class="{ 'lt-add-item-disabled': hasTag }"
                @click="!hasTag && onAddTag()"
              >Tag<span v-if="hasTag" class="lt-add-item-hint">already added</span></div>
            </div>
          </div>
        </div>
      </el-popover>
    </div>

    <span v-if="template.length === 0" class="lt-empty">empty — labels will be blank</span>
  </div>
</template>

<style scoped>
.group-template-builder {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 6px 10px;
  background: #f7f8fa;
  border: 1px solid #eef0f3;
  border-radius: 4px;
  font-size: 12.5px;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}
.group-template-builder.gt-flash {
  animation: gt-flash-anim 1.2s ease;
}
@keyframes gt-flash-anim {
  0%, 100% { box-shadow: 0 0 0 0 rgba(47,111,237,0); border-color: #eef0f3; }
  30% { box-shadow: 0 0 0 4px rgba(47,111,237,0.25); border-color: var(--clara-primary, #2f6fed); }
}
.lt-label {
  color: #4a525c;
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
  border: 1px solid #e2e5ea;
  color: #1c1f24;
  transition: opacity 0.15s ease, border-color 0.15s ease;
}
.lt-chip:hover { border-color: #b6bec8; }
.lt-chip:active, .lt-chip-dragging { cursor: grabbing; opacity: 0.5; }
.lt-chip-tag .lt-chip-text { font-style: italic; }
.lt-chip-text { font-weight: 500; line-height: 1; }
.lt-chip-x {
  font-size: 13px; cursor: pointer;
  padding: 0 4px;
  border-radius: 50%;
  opacity: 0.4;
  transition: opacity 0.15s ease, color 0.15s ease;
  line-height: 1;
}
.lt-chip-x:hover { opacity: 1; color: #b4451f; }

.lt-add-btn {
  width: 22px; height: 22px;
  border-radius: 11px;
  border: 1px dashed #b6bec8;
  background: transparent;
  color: #8a929c;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  display: inline-flex; align-items: center; justify-content: center;
  transition: all 0.15s ease;
  padding: 0;
}
.lt-add-btn:hover {
  border-color: var(--clara-primary, #2f6fed);
  color: var(--clara-primary, #2f6fed);
  background: rgba(47,111,237,0.06);
}
.lt-empty {
  color: #b6bec8;
  font-style: italic;
  font-size: 11.5px;
}
</style>

<style>
.lt-popover { padding: 12px !important; }
.lt-add-panel { display: flex; flex-direction: column; gap: 10px; }
.lt-add-section { display: flex; flex-direction: column; gap: 4px; }
.lt-section-title {
  font-size: 10.5px; font-weight: 700; color: #8a929c;
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
  color: #1c1f24;
  transition: background 0.12s ease, color 0.12s ease;
}
.lt-add-item:hover {
  background: rgba(47,111,237,0.07);
  color: var(--clara-primary, #2f6fed);
}
.lt-add-item-disabled {
  color: #b6bec8;
  cursor: not-allowed;
}
.lt-add-item-disabled:hover {
  background: transparent;
  color: #b6bec8;
}
.lt-add-item-hint {
  font-size: 10.5px;
  font-style: italic;
  color: #b6bec8;
  margin-left: 6px;
}
</style>
