import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { VersioningType } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { cleanupOpenApiDoc } from 'nestjs-zod'
import { AppModule } from './app.module'
import { ENV, type Env } from './config/env'

/** Builds the configured application. Used by main.ts and by the tests. */
export async function createApp() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: true,
      // Medical app: never log bodies, and keep request logs to method, path and status.
      logger: { level: process.env.NODE_ENV === 'test' ? 'error' : 'info' },
      bodyLimit: 1024 * 1024,
    }),
    { logger: process.env.NODE_ENV === 'test' ? ['error'] : undefined },
  )
  const env = app.get<Env>(ENV)

  await app.register(helmet, {
    // The docs page needs inline scripts and styles; everything else keeps the strict defaults.
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
  })
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' })
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true })

  // Routes live under /api/v1/…; a breaking change gets /api/v2 while v1 keeps working for older mobile builds.
  app.setGlobalPrefix('api')
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
  app.enableShutdownHooks()

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
