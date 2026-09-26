import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app'
import type * as prismaServiceModule from '../src/prisma/prisma.service'
import { PrismaService } from '../src/prisma/prisma.service'

// These tests exercise the real HTTP stack (Fastify, validation, versioning) without a database.
const isHealthy = vi.fn(async () => true)

vi.mock('../src/prisma/prisma.service', async (importOriginal) => {
  const actual = await importOriginal<typeof prismaServiceModule>()
  class FakePrisma {
    isHealthy = isHealthy
    async onModuleDestroy() {}
  }
  return { ...actual, PrismaService: FakePrisma }
})

let app: NestFastifyApplication

beforeAll(async () => {
  app = await createApp()
  await app.init()
  await app.getHttpAdapter().getInstance().ready()
  expect(app.get(PrismaService)).toBeDefined()
})

afterAll(async () => {
  await app?.close()
})

describe('GET /api/health', () => {
  it('reports ok when the database answers', async () => {
    isHealthy.mockResolvedValueOnce(true)
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok', database: 'up' })
  })

  it('returns 503 when the database is down', async () => {
    isHealthy.mockResolvedValueOnce(false)
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toMatchObject({ status: 'degraded', database: 'down' })
  })
})

describe('POST /api/v1/checkins/evaluate', () => {
  it('flags high blood pressure with a headache', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/checkins/evaluate',
      payload: { symptoms: ['headache'], systolic: 145, diastolic: 95 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ urgent: true, flags: ['high-bp', 'headache'] })
  })

  it('returns no flags for a normal check-in', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/checkins/evaluate',
      payload: { symptoms: ['none'], systolic: 118, diastolic: 76 },
    })
    expect(res.json()).toEqual({ urgent: false, flags: [] })
  })

  it('rejects impossible readings and unknown symptoms with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/checkins/evaluate',
      payload: { symptoms: ['sneezing'], systolic: 900 },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('security headers', () => {
  it('sets helmet headers on every response', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })
})
