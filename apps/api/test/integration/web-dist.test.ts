/** The API serving the built web app itself (WEB_DIST), as on a single server or Render. */
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app'

const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('serving the web app (integration)', () => {
  let app: NestFastifyApplication
  let dist: string

  beforeAll(async () => {
    dist = await mkdtemp(path.join(os.tmpdir(), 'azzah-dist-'))
    await mkdir(path.join(dist, 'assets'))
    await writeFile(path.join(dist, 'index.html'), '<!doctype html><title>AZZAH</title>')
    await writeFile(path.join(dist, 'assets', 'app-abc123.js'), 'console.log(1)')
    process.env.DATABASE_URL = url
    process.env.WEB_DIST = dist
    app = await createApp()
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterAll(async () => {
    delete process.env.WEB_DIST
    await app?.close()
    await rm(dist, { recursive: true, force: true })
  })

  const get = (u: string) => app.inject({ method: 'GET', url: u })

  it('serves the app for client routes, assets with long caching, and real 404s otherwise', async () => {
    for (const route of ['/', '/patients/abc', '/forms/x?tab=responses']) {
      const res = await get(route)
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toMatch(/text\/html/)
      expect(res.headers['cache-control']).toBe('no-cache')
    }
    const asset = await get('/assets/app-abc123.js')
    expect(asset.statusCode).toBe(200)
    expect(asset.headers['cache-control']).toMatch(/immutable/)
    // An old build's chunk and unknown API paths are 404s, never the app's HTML.
    for (const missing of ['/assets/old-999.js', '/api/v1/nope', '/api?x=1']) {
      const res = await get(missing)
      expect(res.statusCode).toBe(404)
      expect(res.headers['content-type']).toMatch(/json/)
    }
    expect((await get('/api/health')).statusCode).toBe(200)
  })
})
