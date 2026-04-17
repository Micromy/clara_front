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
export function usePopupWindow() {
  const isOpen = ref(false)
  let popup = null
  let popupApp = null
  let pollInterval = null
  let unloadHandler = null
  let closeCallback = null

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

    const rootStyle = getComputedStyle(document.documentElement)
    const vars = ['--clara-primary', '--el-color-primary', '--el-color-primary-light-3',
      '--el-color-primary-light-5', '--el-color-primary-light-7', '--el-color-primary-light-9',
      '--el-color-primary-dark-2']
    vars.forEach(v => {
      const val = rootStyle.getPropertyValue(v)
      if (val) popup.document.documentElement.style.setProperty(v, val)
    })

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
    if (popupApp) { try { popupApp.unmount() } catch {}; popupApp = null }
    if (pollInterval) { window.clearInterval(pollInterval); pollInterval = null }
    if (unloadHandler) { window.removeEventListener('beforeunload', unloadHandler); unloadHandler = null }
    isOpen.value = false
    popup = null
  }

  onBeforeUnmount(() => { try { close() } catch {} })

  return { isOpen, open, close }
}
