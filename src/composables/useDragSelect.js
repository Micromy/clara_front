import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

/**
 * Click-and-drag to select/deselect multiple rows in an el-table with type="selection".
 *
 * Usage:
 *   const { onCellMouseEnter } = useDragSelect(tableRef)
 *
 *   <el-table ref="tableRef" @cell-mouse-enter="onCellMouseEnter">
 *
 * The composable attaches a native mousedown listener on the table element to
 * detect clicks on selection-column checkboxes, then toggles rows as the cursor
 * drags over them via the el-table cell-mouse-enter event.
 */
export function useDragSelect(tableRef) {
  const dragging = ref(false)
  let targetState = true // true = check, false = uncheck

  function getSelectedSet() {
    const tbl = tableRef.value
    if (!tbl) return new Set()
    const rows = tbl.getSelectionRows ? tbl.getSelectionRows() : []
    return new Set(rows.map(r => r.id))
  }

  /**
   * Given a mousedown target inside the table, walk up to find the <tr>,
   * then derive the row index and look it up in table data.
   */
  function getRowFromEvent(event) {
    const tbl = tableRef.value
    if (!tbl) return null

    // Check if the click is in the selection column (first column, has .el-checkbox)
    const td = event.target.closest('td')
    if (!td) return null
    const tr = td.closest('tr')
    if (!tr) return null

    // Must be in the selection column (contains a checkbox)
    if (!td.querySelector('.el-checkbox') && !td.closest('.el-table-column--selection')) {
      // Also check by cell index — selection column is typically the first
      const cellIndex = Array.from(tr.children).indexOf(td)
      if (cellIndex !== 0) return null
      // Even index 0 might not be selection — verify checkbox exists
      if (!td.querySelector('.el-checkbox')) return null
    }

    // Get the row index within the visible table body
    const tbody = tr.closest('.el-table__body tbody')
    if (!tbody) return null
    const rowIndex = Array.from(tbody.children).indexOf(tr)
    if (rowIndex < 0) return null

    // Access the table's current data to get the row object
    const data = tbl.data || []
    if (rowIndex >= data.length) return null
    return data[rowIndex]
  }

  // Suppress the click event that follows our mousedown toggle to prevent
  // Element Plus checkbox from double-toggling the selection.
  function suppressClick(e) {
    e.stopPropagation()
    e.preventDefault()
  }

  function onNativeMouseDown(event) {
    // Only handle left-click
    if (event.button !== 0) return

    const row = getRowFromEvent(event)
    if (!row) return

    // Prevent default checkbox behavior — we handle it ourselves
    event.preventDefault()
    event.stopPropagation()

    dragging.value = true
    const selected = getSelectedSet()
    targetState = !selected.has(row.id)
    tableRef.value?.toggleRowSelection(row, targetState)

    // Block the upcoming click event so Element Plus doesn't re-toggle
    document.addEventListener('click', suppressClick, { capture: true, once: true })
    document.addEventListener('mouseup', onMouseUp, { once: true })
  }

  function onCellMouseEnter(row, _column) {
    if (!dragging.value) return
    tableRef.value?.toggleRowSelection(row, targetState)
  }

  function onMouseUp() {
    dragging.value = false
  }

  // Attach / detach native mousedown on the table's body wrapper
  let tableEl = null

  function attachListener() {
    const tbl = tableRef.value
    if (!tbl || !tbl.$el) return
    tableEl = tbl.$el.querySelector('.el-table__body-wrapper')
    if (tableEl) {
      tableEl.addEventListener('mousedown', onNativeMouseDown)
    }
  }

  function detachListener() {
    if (tableEl) {
      tableEl.removeEventListener('mousedown', onNativeMouseDown)
      tableEl = null
    }
  }

  onMounted(() => {
    // tableRef might not be ready immediately if the table is conditionally rendered
    // Use a watch to attach once available
    if (tableRef.value) {
      attachListener()
    }
  })

  // Re-attach when tableRef becomes available (e.g. after v-if)
  watch(tableRef, (newVal, oldVal) => {
    if (oldVal) detachListener()
    if (newVal) attachListener()
  })

  onBeforeUnmount(() => {
    detachListener()
    document.removeEventListener('mouseup', onMouseUp)
  })

  return { onCellMouseEnter, onMouseUp, dragging }
}
