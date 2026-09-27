/* global process */
// Vercel Function for the whole API: vercel.json rewrites every /api/* request here, and the
// request keeps its original URL, so Fastify sees exactly the path the browser asked for.
// The NestJS app is created once per function instance and reused across requests; each request
// is handed to Fastify as-is, so routing, validation, auth and audit work exactly as on a server.
let ready

// Stack traces in the logs map back to the source through the bundle's source map.
process.setSourceMapsEnabled(true)

export default async function handler(req, res) {
  ready ??= (async () => {
    // One-file CommonJS bundle of the API (apps/api/scripts/bundle-serverless.mjs): Vercel's runtime
    // can't require() the ES-module-only packages the unbundled build would load.
    // A CommonJS module arrives as the default export; its named exports can't be detected
    // statically in minified output.
    const { default: bundle } = await import('../apps/api/dist/serverless.bundle.cjs')
    const { createApp } = bundle
    const app = await createApp()
    await app.init()
    const fastify = app.getHttpAdapter().getInstance()
    await fastify.ready()
    return fastify
  })().catch((error) => {
    // A failed start (e.g. the database still waking) must not stick: the next request retries.
    ready = undefined
    throw error
  })
  const fastify = await ready
  fastify.server.emit('request', req, res)
}
