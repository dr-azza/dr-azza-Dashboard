import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { createReadStream } from 'node:fs'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { ENV, type Env } from '../config/env'
import { PrismaService } from '../prisma/prisma.service'

/** What every storage backend provides. Keys are opaque paths like "attachments/<uuid>". */
interface StorageDriver {
  /** Never overwrites: putting an existing key fails. */
  put(key: string, bytes: Buffer): Promise<void>
  exists(key: string): Promise<boolean>
  /** NotFoundException when the key has no bytes. */
  read(key: string): Promise<Readable>
  remove(key: string): Promise<void>
}

/** A local folder: development. */
class LocalStorage implements StorageDriver {
  constructor(private readonly root: string) {}

  /** Resolves a key inside the storage root, refusing anything that would escape it. */
  private resolve(key: string) {
    const full = path.resolve(this.root, key)
    if (!full.startsWith(this.root + path.sep)) throw new Error('Invalid storage key')
    return full
  }

  async put(key: string, bytes: Buffer) {
    const full = this.resolve(key)
    await mkdir(path.dirname(full), { recursive: true })
    await writeFile(full, bytes, { flag: 'wx' })
  }

  exists(key: string) {
    return stat(this.resolve(key)).then(
      () => true,
      () => false,
    )
  }

  async read(key: string) {
    if (!(await this.exists(key))) throw new NotFoundException('File not found')
    return createReadStream(this.resolve(key))
  }

  async remove(key: string) {
    await rm(this.resolve(key), { force: true })
  }
}

/** Rows in `stored_files`: hosts whose disk is wiped on restart (free test deployments). */
class DatabaseStorage implements StorageDriver {
  constructor(private readonly prisma: PrismaService) {}

  async put(key: string, bytes: Buffer) {
    // create, not upsert: an existing key is never overwritten. A Buffer is already a Uint8Array
    // (Prisma's type only differs in the backing-buffer generic), so it is passed without a copy.
    await this.prisma.storedFile.create({ data: { key, bytes: bytes as Uint8Array<ArrayBuffer> } })
  }

  async exists(key: string) {
    return (await this.prisma.storedFile.count({ where: { key } })) > 0
  }

  async read(key: string) {
    const file = await this.prisma.storedFile.findUnique({ where: { key }, select: { bytes: true } })
    if (!file) throw new NotFoundException('File not found')
    // A view over the same memory, not a second copy of the file.
    return Readable.from(Buffer.from(file.bytes.buffer, file.bytes.byteOffset, file.bytes.byteLength))
  }

  async remove(key: string) {
    await this.prisma.storedFile.deleteMany({ where: { key } })
  }
}

/**
 * File storage, backed by the driver chosen with STORAGE_DRIVER: a local folder (development) or
 * the database (free test deployments). Production will add an S3-compatible bucket as another
 * driver with the same four methods.
 */
@Injectable()
export class StorageService implements StorageDriver {
  private readonly driver: StorageDriver

  constructor(@Inject(ENV) env: Env, prisma: PrismaService) {
    this.driver =
      env.STORAGE_DRIVER === 'database' ? new DatabaseStorage(prisma) : new LocalStorage(path.resolve(env.STORAGE_DIR))
  }

  put(key: string, bytes: Buffer) {
    return this.driver.put(key, bytes)
  }

  exists(key: string) {
    return this.driver.exists(key)
  }

  read(key: string) {
    return this.driver.read(key)
  }

  remove(key: string) {
    return this.driver.remove(key)
  }
}

/** Detects the real file type from its first bytes. The browser-supplied MIME type is never trusted. */
export function sniffMimeType(bytes: Buffer): string | null {
  const at = (offset: number, sig: number[]) => sig.every((b, i) => bytes[offset + i] === b)
  if (at(0, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return 'image/webp'
  if (at(0, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf'
  // HEIC/HEIF: ISO box "ftyp" at offset 4 with a HEIF brand.
  if (at(4, [0x66, 0x74, 0x79, 0x70])) {
    const brand = bytes.subarray(8, 12).toString('ascii')
    if (['heic', 'heix', 'hevc', 'mif1', 'msf1'].includes(brand)) return 'image/heic'
  }
  return null
}
