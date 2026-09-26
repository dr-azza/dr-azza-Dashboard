import {
  ALLOWED_UPLOAD_TYPES,
  type AttachmentDto,
  type AttachmentKindCode,
  type AttachmentMetaInput,
  MAX_UPLOAD_BYTES,
} from '@azza/shared'
import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common'
import { createHash, randomUUID } from 'node:crypto'
import type { AuthStaff } from '../auth/auth.types'
import { fromIsoDayOrNull, STAFF_REF_SELECT, staffRef, toIsoDayOrNull } from '../common/format'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { sniffMimeType, StorageService } from '../storage/storage.service'
import { PatientScope } from './patient-scope.service'

type Row = Prisma.AttachmentGetPayload<{ include: { uploadedBy: typeof STAFF_REF_SELECT } }>

export const toAttachmentDto = (a: Row): AttachmentDto => ({
  id: a.id,
  kind: a.kind,
  title: a.title,
  fileName: a.fileName,
  mimeType: a.mimeType,
  sizeBytes: a.sizeBytes,
  takenAt: toIsoDayOrNull(a.takenAt),
  paymentId: a.paymentId,
  createdAt: a.createdAt.toISOString(),
  uploadedBy: staffRef(a.uploadedBy),
})

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
}

/** Keeps a readable, safe file name for downloads (no paths, no control characters). */
const safeFileName = (name: string) =>
  [...name]
    // Drop control characters and quotes; replace path separators.
    .filter((ch) => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) !== 0x7f && ch !== '"')
    .join('')
    .replace(/[/\\]/g, '_')
    .trim()
    .slice(0, 150) || 'file'

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: PatientScope,
    private readonly storage: StorageService,
  ) {}

  async list(staff: AuthStaff, patientId: string, kind?: AttachmentKindCode) {
    await this.scope.require(staff, patientId)
    const rows = await this.prisma.attachment.findMany({
      where: { patientId, deletedAt: null, ...(kind && { kind }) },
      orderBy: { createdAt: 'desc' },
      include: { uploadedBy: STAFF_REF_SELECT },
    })
    return rows.map(toAttachmentDto)
  }

  async upload(
    staff: AuthStaff,
    patientId: string,
    meta: AttachmentMetaInput,
    file: { fileName: string; bytes: Buffer; truncated: boolean },
  ) {
    const patient = await this.scope.require(staff, patientId)
    if (file.truncated || file.bytes.length > MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException(`Files can be at most ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`)
    }
    if (file.bytes.length === 0) throw new BadRequestException('The file is empty')

    const mimeType = sniffMimeType(file.bytes)
    if (!mimeType || !(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(mimeType)) {
      throw new BadRequestException('Only JPEG, PNG, WebP, HEIC images and PDF files can be uploaded')
    }
    if (meta.paymentId) {
      const ok = await this.prisma.payment.count({ where: { id: meta.paymentId, patientId } })
      if (!ok) throw new BadRequestException('Payment does not belong to this patient')
    }

    const id = randomUUID()
    const storageKey = `${patient.clinicId}/${patientId}/${id}.${EXTENSION[mimeType]}`
    await this.storage.put(storageKey, file.bytes)
    try {
      const row = await this.prisma.attachment.create({
        data: {
          patientId,
          uploadedById: staff.id,
          paymentId: meta.paymentId ?? null,
          kind: meta.paymentId ? 'PAYMENT_PROOF' : meta.kind,
          title: meta.title,
          fileName: safeFileName(file.fileName),
          mimeType,
          sizeBytes: file.bytes.length,
          sha256: createHash('sha256').update(file.bytes).digest('hex'),
          storageKey,
          takenAt: fromIsoDayOrNull(meta.takenAt),
        },
        include: { uploadedBy: STAFF_REF_SELECT },
      })
      return toAttachmentDto(row)
    } catch (error) {
      await this.storage.remove(storageKey) // don't leave orphaned bytes behind
      throw error
    }
  }

  async open(staff: AuthStaff, patientId: string, attachmentId: string) {
    await this.scope.require(staff, patientId)
    const row = await this.prisma.attachment.findFirst({ where: { id: attachmentId, patientId, deletedAt: null } })
    if (!row) throw new NotFoundException('File not found')
    return {
      stream: this.storage.read(row.storageKey),
      mimeType: row.mimeType,
      fileName: row.fileName,
      sizeBytes: row.sizeBytes,
    }
  }

  /** Soft delete: the record and bytes are retained for the medical record, just hidden. */
  async remove(staff: AuthStaff, patientId: string, attachmentId: string) {
    await this.scope.require(staff, patientId)
    const { count } = await this.prisma.attachment.updateMany({
      where: { id: attachmentId, patientId, deletedAt: null },
      data: { deletedAt: new Date() },
    })
    if (!count) throw new NotFoundException('File not found')
  }
}
