import { ref, onBeforeUnmount, createApp, h } from 'vue'
import ElementPlus from 'element-plus'
import * as ElementPlusIcons from '@element-plus/icons-vue'
import { getActivePinia } from 'pinia'

/**
 * Opens a real browser window (window.open) and mounts a fresh Vue sub-app
 * inside it so rendering, events, and lifecycle are cleanly scoped to that
 * window. Pinia is shared via getActivePinia() so stores stay in sync.
 *
 * Note on Element Plus teleports: the JS context is still the main window,
 * so `document.body` references the main document. Components that teleport
 * to body (el-select dropdown, el-popover, el-tooltip, …) render in the
 * main window unless we explicitly redirect them. The sub-app provides
 * `popupBody` via inject so descendants can set `append-to="popupBody"` or
 * `teleported="false"` as needed.
 */
function patchPopupScrollbars(popup) {
  if (!popup || popup.closed) return
  const doc = popup.document

  // Capture phase — intercept before Element Plus handler
  doc.addEventListener('mousedown', (e) => {
    const thumb = e.target.closest('.el-scrollbar__thumb')
    if (!thumb) return

    const bar = thumb.closest('.el-scrollbar__bar')
    const scrollbar = thumb.closest('.el-scrollbar')
    const wrap = scrollbar?.querySelector('.el-scrollbar__wrap')
    if (!bar || !wrap) return

    e.stopImmediatePropagation()
    e.preventDefault()

    const isHorizontal = bar.classList.contains('is-horizontal')
    const barRect = bar.getBoundingClientRect()
    const thumbRect = thumb.getBoundingClientRect()
    const offset = isHorizontal
      ? e.clientX - thumbRect.left
      : e.clientY - thumbRect.top

    function onMove(ev) {
      if (isHorizontal) {
        const pos = ev.clientX - barRect.left - offset
        const ratio = Math.max(0, Math.min(1, pos / (barRect.width - thumbRect.width)))
        wrap.scrollLeft = ratio * (wrap.scrollWidth - wrap.clientWidth)
      } else {
        const pos = ev.clientY - barRect.top - offset
        const ratio = Math.max(0, Math.min(1, pos / (barRect.height - thumbRect.height)))
        wrap.scrollTop = ratio * (wrap.scrollHeight - wrap.clientHeight)
      }
    }

    function onUp() {
      doc.removeEventListener('mousemove', onMove)
      doc.removeEventListener('mouseup', onUp)
    }

    doc.addEventListener('mousemove', onMove)
    doc.addEventListener('mouseup', onUp)
  }, true)  // capture: true
}

export function usePopupWindow() {
  const isOpen = ref(false)
  let popup = null
  let popupApp = null
  let pollInterval = null
  let unloadHandler = null
  let closeCallback = null
  let styleObserver = null

  function copyStyles(targetDoc) {
    document.querySelectorAll('link[rel="stylesheet"]').forEach(node => {
      targetDoc.head.appendChild(node.cloneNode(true))
    })
    document.querySelectorAll('style').forEach(node => {
      const clone = targetDoc.createElement('style')
      try {
        clone.textContent = Array.from(node.sheet.cssRules).map(r => r.cssText).join('\n')
      } catch {
        clone.textContent = node.textContent
      }
      targetDoc.head.appendChild(clone)
    })
  }

  function open({ title = 'Popup', width = 1400, height = 900, component, props = {}, onClose } = {}) {
    if (popup && !popup.closed) { popup.focus(); return }

    const features = [
      `width=${width}`, `height=${height}`,
      'resizable=yes', 'scrollbars=yes',
      'menubar=no', 'toolbar=no', 'location=no', 'status=no'
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

    // Fix el-scrollbar thumb drag in popup — Element Plus binds
    // mousemove/mouseup to main window's document. We re-bind them
    // to the popup's document so thumb drag works.
    setTimeout(() => patchPopupScrollbars(popup), 300)

    const mountEl = popup.document.getElementById('popup-root')
    const popupBody = popup.document.body

    popupApp = createApp({
      render: () => h(component, props)
    })
    popupApp.provide('popupBody', popupBody)
    const pinia = getActivePinia()
    if (pinia) popupApp.use(pinia)
    popupApp.use(ElementPlus)
    for (const [k, v] of Object.entries(ElementPlusIcons)) popupApp.component(k, v)
    popupApp.mount(mountEl)

    // Sync CSS custom properties AFTER mount so they override Element Plus defaults
    const mainStyles = getComputedStyle(document.documentElement)
    const varsToSync = []
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.style) {
            for (let i = 0; i < rule.style.length; i++) {
              const prop = rule.style[i]
              if (prop.startsWith('--')) varsToSync.push(prop)
            }
          }
        }
      } catch {}
    }
    const unique = [...new Set(varsToSync)]
    unique.forEach(v => {
      const val = mainStyles.getPropertyValue(v)
      if (val) popup.document.documentElement.style.setProperty(v, val.trim())
    })

    // Mirror any new <style> tags injected by Vite after mount
    styleObserver = new MutationObserver((mutations) => {
      if (!popup || popup.closed) return
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.tagName === 'STYLE') {
            const clone = popup.document.createElement('style')
            clone.textContent = node.textContent
            popup.document.head.appendChild(clone)
          }
        })
      })
    })
    styleObserver.observe(document.head, { childList: true })

    isOpen.value = true
    closeCallback = onClose

    unloadHandler = () => { try { popup && popup.close() } catch {} }
    window.addEventListener('beforeunload', unloadHandler)

    pollInterval = window.setInterval(() => {
      if (popup && popup.closed) {
        cleanup()
        if (closeCallback) closeCallback()
      }
    }, 400)
  }

  function close() {
    if (popup && !popup.closed) popup.close()
    cleanup()
  }

  function cleanup() {
    if (styleObserver) { styleObserver.disconnect(); styleObserver = null }
    if (popupApp) { try { popupApp.unmount() } catch {}; popupApp = null }
    if (pollInterval) { window.clearInterval(pollInterval); pollInterval = null }
    if (unloadHandler) { window.removeEventListener('beforeunload', unloadHandler); unloadHandler = null }
    isOpen.value = false
    popup = null
  }

  onBeforeUnmount(() => { try { close() } catch {} })

  return { isOpen, open, close }
}
