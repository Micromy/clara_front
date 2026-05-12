import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIcons from '@element-plus/icons-vue'
import App from './App.vue'
import './assets/styles/global.css'

if (window.location.pathname !== '/') {
  window.history.replaceState(null, '', '/')
}

const app = createApp(App)
app.use(createPinia())
app.use(ElementPlus)

for (const [key, component] of Object.entries(ElementPlusIcons)) {
  app.component(key, component)
}

app.mount('#app')
