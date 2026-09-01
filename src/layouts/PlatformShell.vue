<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { SERVICES, CURRENT_SERVICE, CURRENT_USER } from '../config/services.js'

const route = useRoute()
const open = ref(false)
const root = ref(null)

const service = computed(
  () => SERVICES.find(s => s.name === CURRENT_SERVICE) || SERVICES[0],
)
const pages = computed(() => service.value.pages)

function isActive(page) {
  return route.name === page.route
}

function onDocClick(e) {
  if (open.value && root.value && !root.value.contains(e.target)) open.value = false
}
function onEsc(e) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', onDocClick)
  document.addEventListener('keydown', onEsc)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick)
  document.removeEventListener('keydown', onEsc)
})
</script>

<template>
  <header class="plat-shell">
    <a class="plat-wordmark" href="/" title="DTCO Platform">
      <i style="background: #2f6fed"></i>
      <i style="background: #7a4fd6"></i>
      <i style="background: #c2632a"></i>
    </a>

    <div ref="root" class="plat-service-wrap">
      <button
        class="plat-service"
        type="button"
        aria-haspopup="menu"
        :aria-expanded="open"
        @click="open = !open"
      >
        <span class="plat-dot" :style="{ background: service.dot }"></span>
        <span class="plat-service-name">{{ service.name }}</span>
        <span class="plat-service-caret">▾</span>
      </button>

      <div v-if="open" class="plat-menu" role="menu">
        <a
          v-for="s in SERVICES"
          :key="s.name"
          class="plat-menu-item"
          :class="{ current: s.name === service.name }"
          href="/"
          role="menuitem"
        >
          <span class="plat-dot" :style="{ background: s.dot }"></span>
          <span class="plat-menu-name">{{ s.name }}</span>
          <span class="plat-menu-check">{{ s.name === service.name ? '✓' : '' }}</span>
        </a>
      </div>
    </div>

    <nav class="plat-pages" role="tablist">
      <router-link
        v-for="p in pages"
        :key="p.label"
        class="plat-page"
        :class="{ active: isActive(p) }"
        :style="isActive(p) ? { borderBottomColor: service.dot } : null"
        :to="{ name: p.route }"
        role="tab"
        :aria-selected="isActive(p)"
      >{{ p.label }}</router-link>
    </nav>

    <div class="plat-spacer"></div>
    <div class="plat-right">
      <span class="plat-user">{{ CURRENT_USER }}</span>
    </div>
  </header>
</template>

<style scoped>
.plat-shell {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: stretch;
  height: var(--clara-shell-height);
  background: var(--clara-shell-bg);
  color: #e6e9ef;
  flex-shrink: 0;
}

.plat-wordmark {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1px;
  padding: 0 10px;
}
.plat-wordmark i {
  display: block;
  width: 14px;
  height: 2px;
}

.plat-dot {
  display: block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.plat-service-wrap { position: relative; }
.plat-service {
  display: flex;
  align-items: center;
  gap: 6px;
  height: var(--clara-shell-height);
  padding: 0 10px;
  background: #1c2127;
  border: none;
  border-right: 1px solid #262c33;
  cursor: pointer;
  font: inherit;
}
.plat-service:hover { background: #232931; }
.plat-service:focus { outline: none; }
.plat-service:focus-visible { outline: 1px solid #4a525c; outline-offset: -2px; }
.plat-service-name {
  font-size: 12.5px;
  color: #fff;
}
.plat-service-caret {
  font-size: 10px;
  color: #9aa3ae;
}

.plat-menu {
  position: absolute;
  top: var(--clara-shell-height);
  left: 0;
  z-index: 50;
  width: 236px;
  padding: 4px 0;
  background: #fff;
  border: 1px solid #d5d9de;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(20, 24, 29, 0.16);
}
.plat-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 4px;
  padding: 7px 9px;
  border-radius: 4px;
  color: #1c1f24;
  text-decoration: none;
}
.plat-menu-item:hover { background: #f7f8fa; }
.plat-menu-item.current { background: #f7f8fa; }
.plat-menu-name {
  flex: 1;
  font-size: 12.5px;
}
.plat-menu-item.current .plat-menu-name { font-weight: 500; }
.plat-menu-check {
  font-family: var(--clara-mono);
  font-size: 11px;
  color: #8a929c;
}

.plat-pages {
  display: flex;
  align-items: center;
  height: var(--clara-shell-height);
  padding-left: 8px;
}
.plat-page {
  display: flex;
  align-items: center;
  height: var(--clara-shell-height);
  padding: 0 12px;
  border-bottom: 2px solid transparent;
  font-size: 12px;
  color: #9aa3ae;
  text-decoration: none;
}
.plat-page:hover { color: #fff; }
.plat-page.active {
  font-weight: 500;
  color: #fff;
}

.plat-spacer { flex: 1; }

.plat-right {
  display: flex;
  align-items: center;
  padding-right: 12px;
}
.plat-user {
  font-family: var(--clara-mono);
  font-size: 11px;
  color: #9aa3ae;
}
</style>
