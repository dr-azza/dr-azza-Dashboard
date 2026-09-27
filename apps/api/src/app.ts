import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import rateLimit from '@fastify/rate-limit'
import { VersioningType } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { cleanupOpenApiDoc } from 'nestjs-zod'
import { MAX_UPLOAD_BYTES } from '@azza/shared'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { AppModule } from './app.module'
import { ENV, type Env, loadEnv } from './config/env'

/** Masks the token in public link URLs, e.g. /api/v1/public/invites/<token> → …/invites/[token]. */
export const redactTokens = (url: string) => url.replace(/(\/public\/(?:invites|forms))\/[^/?#]+/g, '$1/[token]')

/** Builds the configured application. Used by main.ts and by the tests. */
export async function createApp() {
  const { TRUST_PROXY_HOPS } = loadEnv()
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: TRUST_PROXY_HOPS || false,
      // Medical app: never log bodies, and keep request logs to method, path and status.
      logger: {
        level: process.env.NODE_ENV === 'test' ? 'error' : 'info',
        // One-time link tokens (invites, personal form links) are credentials: never log them.
        serializers: {
          req: (req: { method: string; url: string }) => ({ method: req.method, url: redactTokens(req.url) }),
        },
      },
      bodyLimit: 1024 * 1024,
    }),
    { logger: process.env.NODE_ENV === 'test' ? ['error'] : undefined },
  )
  const env = app.get<Env>(ENV)

  await app.register(helmet, {
    // The docs page needs inline scripts and styles; everything else keeps the strict defaults.
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
  })
  // API calls only: the web app's own files (scripts, fonts, images) never count against the limit.
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    allowList: (request) => !request.url.startsWith('/api'),
  })
  await app.register(cookie)
  // One file per request, capped at the upload limit; larger files are cut off and rejected.
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 10 } })
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true })

  // Routes live under /api/v1/…; a breaking change gets /api/v2 while v1 keeps working for older mobile builds.
  app.setGlobalPrefix('api')
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
  app.enableShutdownHooks()

  if (env.WEB_DIST) await serveWebApp(app, path.resolve(env.WEB_DIST))

  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('AZZAH API')
      .setDescription('Clinic operations API for the AZZAH dashboard and patient apps.')
      .setVersion('1')
      .build()
    SwaggerModule.setup('api/docs', app, cleanupOpenApiDoc(SwaggerModule.createDocument(app, config)))
  }

  return app
}

/**
 * Serves the built web app from the same origin as the API, so the session cookie stays
 * first-party and there is no CORS. Hashed assets are cached for a year; index.html never is, so
 * a deploy is picked up on the next page load. Any non-API path gets index.html (client routing).
 */
async function serveWebApp(app: NestFastifyApplication, root: string) {
  if (!existsSync(path.join(root, 'index.html'))) throw new Error(`WEB_DIST has no index.html: ${root}`)
  const fastify = app.getHttpAdapter().getInstance()
  await app.register(fastifyStatic, {
    root,
    wildcard: false,
    setHeaders: (res, filePath) => {
      const hashed = filePath.includes(`${path.sep}assets${path.sep}`)
      res.header('cache-control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache')
    },
  })
  fastify.get('/*', (request, reply) => {
    const pathname = request.url.split(/[?#]/)[0]
    // API paths and missing files (e.g. an old build's chunk after a deploy) are real 404s, so the
    // browser reports a failed load instead of silently receiving HTML.
    if (pathname === '/api' || pathname.startsWith('/api/') || /\.[a-z0-9]+$/i.test(pathname)) {
      return reply.callNotFound()
    }
    return reply.sendFile('index.html')
  })
}
