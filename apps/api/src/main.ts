import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { existsSync } from 'node:fs'
import { createApp } from './app'
import { ENV, type Env } from './config/env'

// Local development reads .env; in production the platform provides real environment variables.
if (existsSync('.env')) process.loadEnvFile('.env')

async function bootstrap() {
  const app = await createApp()
  const env = app.get<Env>(ENV)
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  const docs = env.NODE_ENV === 'production' ? '' : ` · docs at http://localhost:${env.PORT}/api/docs`
  new Logger('Bootstrap').log(`AZZAH API listening on http://localhost:${env.PORT}/api${docs}`)
}

void bootstrap()
