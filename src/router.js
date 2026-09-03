import { createRouter, createWebHashHistory } from 'vue-router'
import PpaApp from './views/PpaApp.vue'
import LibraryReportView from './views/library-report/LibraryReportView.vue'

// Hash mode: GitHub Pages serves each branch under its own subdirectory with
// no server-side rewrite, so a direct load of a sub-route (deep link, page
// refresh) would 404 under history mode. The hash portion never reaches the
// server, so this works the same way in every deploy target (internal nginx
// included) without any deploy-specific branching.
export const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'ppa', component: PpaApp },
    { path: '/library-report', name: 'library-report', component: LibraryReportView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
