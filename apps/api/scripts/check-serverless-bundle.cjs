// CI check: the serverless bundle must start and answer a request with require(esm) turned off,
// which is how Vercel's runtime behaves. Run: node --no-experimental-require-module <this file>
// No database is needed: /auth/me without a session is answered by the auth guard (401).
process.env.DATABASE_URL ??= 'postgresql://check:check@127.0.0.1:1/check'
process.env.NODE_ENV ??= 'production'
const { createApp } = require('../dist/serverless.bundle.cjs')

createApp()
  .then(async (app) => {
    await app.init()
    const fastify = app.getHttpAdapter().getInstance()
    await fastify.ready()
    const res = await fastify.inject({ method: 'GET', url: '/api/v1/auth/me' })
    await app.close()
    if (res.statusCode !== 401) throw new Error(`expected 401 from /api/v1/auth/me, got ${res.statusCode}`)
    console.log('serverless bundle: starts and answers without require(esm)')
  })
  .catch((error) => {
    console.error('serverless bundle check failed:', error)
    process.exit(1)
  })
