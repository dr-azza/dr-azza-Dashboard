import { defineConfig } from 'tsdown'

// Node consumers (the API, later the mobile build) use dist; the web app reads src via the `source` condition.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
})
