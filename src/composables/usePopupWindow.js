import { ref, onBeforeUnmount } from 'vue'

/**
 * Opens a real browser window (window.open) and exposes a reactive root
 * element inside it. Use with <Teleport :to="popupRoot"> to render Vue
 * components into that window while keeping them in the main app's JS
 * context (so Pinia stores stay shared).
 *
 * Caveats:
 *   - Element Plus popovers default to teleporting into document.body of
 *     the MAIN window — set `teleported="false"` on popovers/popups inside
 *     the teleported subtree so they render next to their trigger in the
 *     popup DOM.
 *   - Vite HMR style additions after the popup opens are not synced.
 */
export function usePopupWindow() {
  const popupRoot = ref(null)
  const isOpen = ref(false)
  let popup = null
  let unloadHandler = null
  let pollInterval = null

  function copyStyles(targetDoc) {
    document.querySelectorAll('link[rel="stylesheet"]').forEach(node => {
      targetDoc.head.appendChild(node.cloneNode(true))
    })
    document.querySelectorAll('style').forEach(node => {
      const clone = targetDoc.createElement('style')
      if (node.sheet) {
        try {
          clone.textContent = Array.from(node.sheet.cssRules).map(r => r.cssText).join('\n')
        } catch {
          clone.textContent = node.textContent
        }
      } else {
        clone.textContent = node.textContent
      }
      targetDoc.head.appendChild(clone)
    })
  }

  function open({ title = 'Cell Search', width = 1400, height = 900, onClose } = {}) {
    if (popup && !popup.closed) {
      popup.focus()
      return
    }
    const features = [
      `width=${width}`,
      `height=${height}`,
      'menubar=no',
      'toolbar=no',
      'location=no',
      'status=no',
      'resizable=yes',
      'scrollbars=yes'
    ].join(',')

    popup = window.open('', '_blank', features)
    if (!popup) {
      console.warn('[usePopupWindow] popup blocked by browser')
      return
    }

    popup.document.open()
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><div id="popup-root"></div></body></html>`)
    popup.document.close()
    copyStyles(popup.document)

    popup.document.body.style.margin = '0'
    popup.document.body.style.background = '#f5f7fa'
    popup.document.body.style.fontFamily = 'inherit'

    popupRoot.value = popup.document.getElementById('popup-root')
    isOpen.value = true

    // Close main → close popup
    unloadHandler = () => { try { popup && popup.close() } catch {} }
    window.addEventListener('beforeunload', unloadHandler)

    // Detect popup close by user (no reliable event across all browsers)
    pollInterval = window.setInterval(() => {
      if (popup && popup.closed) {
        cleanup()
        if (onClose) onClose()
      }
    }, 400)
  }

  function close() {
    if (popup && !popup.closed) popup.close()
    cleanup()
  }

  function cleanup() {
    if (pollInterval) { window.clearInterval(pollInterval); pollInterval = null }
    if (unloadHandler) { window.removeEventListener('beforeunload', unloadHandler); unloadHandler = null }
    popupRoot.value = null
    isOpen.value = false
    popup = null
  }

  onBeforeUnmount(() => {
    try { close() } catch {}
  })

  return { popupRoot, isOpen, open, close }
}
