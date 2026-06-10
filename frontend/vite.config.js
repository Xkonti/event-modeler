import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// Dev proxy is the API seam (see notes/auth-build-plan.md §1 + §6 gotcha #2):
// the browser sees one origin (:5173); Vite forwards /api/* to the backend
// (:3000). This keeps the better-auth session cookie first-party, so
// credentials:'include' + default SameSite=lax just work — no CORS in dev.
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  // Vitest (unit) — src only; e2e/ belongs to Playwright.
  test: {
    include: ['src/**/*.test.js'],
  },
})
