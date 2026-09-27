/** The database storage driver (used where the host's disk is wiped on restart). */
import { PrismaPg } from '@prisma/adapter-pg'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Env } from '../../src/config/env'
import { PrismaClient } from '../../src/generated/prisma/client'
import { StorageService } from '../../src/storage/storage.service'

const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('database storage driver (integration)', () => {
  let db: PrismaClient
  let storage: StorageService

  beforeAll(() => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
    storage = new StorageService({ STORAGE_DIR: './unused', STORAGE_DRIVER: 'database' } as Env, db as never)
  })
  afterAll(() => db?.$disconnect())

  it('stores, reads back byte-for-byte, refuses overwrites, and removes', async () => {
    const key = `test/${randomUUID()}.bin`
    const bytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0x10])
    await storage.put(key, bytes)
    expect(await storage.exists(key)).toBe(true)
    const chunks: Buffer[] = []
    for await (const chunk of await storage.read(key)) chunks.push(Buffer.from(chunk))
    expect(Buffer.concat(chunks).equals(bytes)).toBe(true)
    await expect(storage.put(key, Buffer.from('x'))).rejects.toThrow()
    await storage.remove(key)
    expect(await storage.exists(key)).toBe(false)
  })
})
