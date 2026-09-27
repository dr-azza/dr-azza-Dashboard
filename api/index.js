// Vercel Function for the whole API: vercel.json rewrites every /api/* request here, and the
// request keeps its original URL, so Fastify sees exactly the path the browser asked for.
// The NestJS app is created once per function instance and reused across requests; each request
// is handed to Fastify as-is, so routing, validation, auth and audit work exactly as on a server.
import { createRequire } from 'node:module'

// The API as one CommonJS bundle (apps/api/scripts/bundle-serverless.mjs): Vercel's runtime can't
// require() the ES-module-only packages the unbundled build would load. It is loaded with require()
// because that returns its module.exports as-is under any loader; import() of a bundled CommonJS
// entry exposes no named exports (esbuild's wrapper can't be analysed), minified or not.
const require = createRequire(import.meta.url)

// Stack traces in the logs map back to the source through the bundle's source map.
process.setSourceMapsEnabled(true)

let app
let ready

export default async function handler(req, res) {
  ready ??= (async () => {
    const { createApp } = require('../apps/api/dist/serverless.bundle.cjs')
    app = await createApp()
    await app.init()
    const fastify = app.getHttpAdapter().getInstance()
    await fastify.ready()
    return fastify
  })().catch((error) => {
    // A failed start (e.g. the database still waking) must not stick: the next request retries.
    ready = undefined
    app = undefined
    throw error
  })
  const fastify = await ready
  fastify.server.emit('request', req, res)
}

/** Closes the app if it was started (used by the CI check; Vercel never calls it). */
export async function shutdown() {
  await app?.close()
}
