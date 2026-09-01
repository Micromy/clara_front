import { createRouter, createWebHistory } from 'vue-router'
import PpaApp from './views/PpaApp.vue'
import LibraryReportView from './views/library-report/LibraryReportView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'ppa', component: PpaApp },
    { path: '/library-report', name: 'library-report', component: LibraryReportView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
