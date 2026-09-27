/* global process, console, fetch, URL, setTimeout */
// CI check: the Vercel function (api/index.js, which loads the serverless bundle) must start and
// answer a request with require(esm) turned off, as Vercel's runtime behaves. It runs the real
// function file behind a plain HTTP server, the way Vercel calls it.
// Run: node --no-experimental-require-module apps/api/scripts/check-serverless-bundle.mjs
// No database is needed: /auth/me without a session is answered by the auth guard (401).
import http from 'node:http'

process.env.DATABASE_URL ??= 'postgresql://check:check@127.0.0.1:1/check'
process.env.NODE_ENV ??= 'production'
const { default: handler } = await import(new URL('../../../api/index.js', import.meta.url).href)

const server = http.createServer((req, res) => handler(req, res))
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const { port } = server.address()
try {
  const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/me`)
  if (res.status !== 401) throw new Error(`expected 401 from /api/v1/auth/me, got ${res.status}`)
  console.log('serverless function: starts and answers without require(esm)')
} catch (error) {
  console.error('serverless function check failed:', error)
  process.exitCode = 1
} finally {
  server.close()
  // The app keeps handles (e.g. the database pool) open; the check is done either way.
  setTimeout(() => process.exit(), 100).unref()
}
