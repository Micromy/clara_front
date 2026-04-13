import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/builder/1'
  },
  {
    path: '/builder/:id',
    name: 'Builder',
    component: () => import('../views/BuilderView.vue')
  },
  {
    path: '/chart/:builderId',
    name: 'Chart',
    component: () => import('../views/ChartView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
