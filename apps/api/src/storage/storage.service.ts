import { Inject, Injectable } from '@nestjs/common'
import { createReadStream } from 'node:fs'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ENV, type Env } from '../config/env'

/**
 * File storage behind a small interface. Development writes to a local folder; production will
 * swap in an S3-compatible bucket (private, encrypted) with the same methods.
 */
@Injectable()
export class StorageService {
  private readonly root: string

  constructor(@Inject(ENV) env: Env) {
    this.root = path.resolve(env.STORAGE_DIR)
  }

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

  async exists(key: string) {
    return stat(this.resolve(key)).then(
      () => true,
      () => false,
    )
  }

  read(key: string) {
    return createReadStream(this.resolve(key))
  }

  async remove(key: string) {
    await rm(this.resolve(key), { force: true })
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
