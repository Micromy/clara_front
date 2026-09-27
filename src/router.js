import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import PpaApp from './views/PpaApp.vue'
import LibraryReportView from './views/library-report/LibraryReportView.vue'

// GitHub Pages serves each branch under its own subdirectory with no
// server-side rewrite, so a direct load of a sub-route (deep link, page
// refresh) 404s under history mode there — the hash portion never reaches
// the server, so hash mode sidesteps it. The internal nginx deploy already
// rewrites unknown paths to index.html (see nginx.conf), so it doesn't need
// this and keeps clean URLs. VITE_ROUTER_HASH is set only by the GitHub
// Pages workflow.
const useHash = import.meta.env.VITE_ROUTER_HASH === 'true'

export const router = createRouter({
  history: useHash
    ? createWebHashHistory(import.meta.env.BASE_URL)
    : createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'ppa', component: PpaApp },
    { path: '/library-report', name: 'library-report', component: LibraryReportView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
