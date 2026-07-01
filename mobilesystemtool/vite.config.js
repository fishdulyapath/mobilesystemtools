import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.VITE_DEV_PROXY_TARGET || 'http://localhost:47300'
  const base = env.VITE_BASE_PATH || '/'

  return {
    base,
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/service': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/smlstaffservice': {
          target: backendTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/smlstaffservice/, ''),
        },
      },
    },
  }
})
