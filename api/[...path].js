// Vercel Function for the whole API: the catch-all file name routes every /api/* request here with
// its original URL, so Fastify sees exactly the path the browser asked for.
// The NestJS app is created once per function instance and reused across requests; each request
// is handed to Fastify as-is, so routing, validation, auth and audit work exactly as on a server.
let ready

export default async function handler(req, res) {
  ready ??= (async () => {
    const { createApp } = await import('../apps/api/dist/serverless.js')
    const app = await createApp()
    await app.init()
    const fastify = app.getHttpAdapter().getInstance()
    await fastify.ready()
    return fastify
  })()
  const fastify = await ready
  fastify.server.emit('request', req, res)
}
