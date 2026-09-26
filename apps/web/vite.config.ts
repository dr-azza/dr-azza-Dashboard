import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defaultClientConditions, defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    // Read workspace packages from their TypeScript source: no package build needed in dev, instant HMR.
    conditions: ['source', ...defaultClientConditions],
  },
  server: { port: 5173 },
})
