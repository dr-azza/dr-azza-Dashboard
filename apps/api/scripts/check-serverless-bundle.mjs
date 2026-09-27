// CI check: the Vercel function (api/index.js, which loads the serverless bundle) must start,
// answer and shut down with require(esm) turned off, as Vercel's runtime behaves. It serves the
// real function file over HTTP, the closest local stand-in for Vercel (whose own module loader
// can't run here), and fails fast with a clear message.
// Run: node --no-experimental-require-module apps/api/scripts/check-serverless-bundle.mjs
// No database is needed: /auth/me without a session is answered by the auth guard (401).
import http from 'node:http'

process.env.DATABASE_URL ??= 'postgresql://check:check@127.0.0.1:1/check'
process.env.NODE_ENV ??= 'production'

const fail = (message, error) => {
  console.error(`serverless function check failed: ${message}`, error ?? '')
  process.exit(1)
}

const fn = await import(new URL('../../../api/index.js', import.meta.url).href)
const server = http.createServer((req, res) =>
  // A failed start must fail the check here, not hang the request or depend on how Node treats
  // unhandled rejections.
  fn.default(req, res).catch((error) => fail('the function threw while handling a request', error)),
)
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

try {
  const { port } = server.address()
  const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/me`, { signal: AbortSignal.timeout(30_000) })
  if (res.status !== 401) fail(`expected 401 from /api/v1/auth/me, got ${res.status}`)
  await fn.shutdown()
  console.log('serverless function: starts, answers and shuts down without require(esm)')
} catch (error) {
  fail('no answer', error)
} finally {
  server.close()
}
