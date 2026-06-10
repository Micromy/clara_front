import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: '/clara/',
    plugins: [
      vue(),
      {
        // Dev-only: mimic the prod entrypoint sed so window.__ENV__'s placeholder gets a
        // real value during `npm run dev`. The build output keeps the placeholder so the
        // container entrypoint can substitute it at runtime.
        name: 'local-env-substitution',
        apply: 'serve',
        transformIndexHtml: (html) =>
          html.replaceAll('__VITE_API_BASE_URL__', env.VITE_API_BASE_URL || ''),
      },
    ],
  }
})
