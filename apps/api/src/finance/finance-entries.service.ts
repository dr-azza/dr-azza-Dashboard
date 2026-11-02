import {
  type CreateFinanceEntryInput,
  type FinanceEntryDto,
  type FinanceReceiptDto,
  MAX_UPLOAD_BYTES,
  type UpdateFinanceEntryInput,
} from '@azza/shared'
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { createHash, randomUUID } from 'node:crypto'
import type { AuthStaff } from '../auth/auth.types'
import { fromIsoDay, STAFF_REF_SELECT, staffRef, toIsoDay } from '../common/format'
import { ENV, type Env } from '../config/env'
import type { FinanceReceipt, Prisma } from '../generated/prisma/client'
import { checkUpload, FILE_EXTENSION, safeFileName } from '../patients/attachments.service'
import { PrismaService } from '../prisma/prisma.service'
import { StorageService } from '../storage/storage.service'
import { CATEGORY_NAME_SELECT, categoryName, FinanceCategoriesService } from './finance-categories.service'

/** Enough for an invoice and its supporting pages, not a document store. */
const MAX_RECEIPTS_PER_ENTRY = 10

export const ENTRY_INCLUDE = {
  category: CATEGORY_NAME_SELECT,
  createdBy: STAFF_REF_SELECT,
  voidedBy: STAFF_REF_SELECT,
  receipts: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.FinanceEntryInclude

type EntryRow = Prisma.FinanceEntryGetPayload<{ include: typeof ENTRY_INCLUDE }>

const toReceiptDto = (r: FinanceReceipt): FinanceReceiptDto => ({
  id: r.id,
  fileName: r.fileName,
  mimeType: r.mimeType,
  sizeBytes: r.sizeBytes,
  createdAt: r.createdAt.toISOString(),
})

export const toEntryDto = (e: EntryRow): FinanceEntryDto => ({
  id: e.id,
  kind: e.kind,
  category: categoryName(e.category),
  amount: e.amount.toFixed(2),
  currency: e.currency,
  method: e.method,
  occurredOn: toIsoDay(e.occurredOn),
  description: e.description,
  counterparty: e.counterparty,
  reference: e.reference,
  notes: e.notes,
  recurringId: e.recurringId,
  createdBy: staffRef(e.createdBy),
  createdAt: e.createdAt.toISOString(),
  voidedAt: e.voidedAt?.toISOString() ?? null,
  voidReason: e.voidReason,
  voidedBy: staffRef(e.voidedBy),
  receipts: e.receipts.map(toReceiptDto),
})

/** Income and expenses beyond patient payments. Voided, never deleted. */
@Injectable()
export class FinanceEntriesService {
  private readonly maxBytes: number

  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: FinanceCategoriesService,
    private readonly storage: StorageService,
    @Inject(ENV) env: Env,
  ) {
    this.maxBytes = env.UPLOAD_MAX_BYTES ?? MAX_UPLOAD_BYTES
  }

  async get(staff: AuthStaff, entryId: string) {
    return toEntryDto(await this.require(staff, entryId))
  }

  /** Income or expense follows from the category. */
  async create(staff: AuthStaff, input: CreateFinanceEntryInput) {
    const category = await this.categories.requireAssignable(staff, input.categoryId)
    const row = await this.prisma.financeEntry.create({
      data: {
        clinicId: staff.clinicId,
        kind: category.kind,
        categoryId: category.id,
        amount: input.amount,
        method: input.method,
        occurredOn: fromIsoDay(input.occurredOn),
        description: input.description,
        counterparty: input.counterparty ?? null,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        createdById: staff.id,
      },
      include: ENTRY_INCLUDE,
    })
    return toEntryDto(row)
  }

  async update(staff: AuthStaff, entryId: string, input: UpdateFinanceEntryInput) {
    const entry = await this.require(staff, entryId)
    if (entry.voidedAt) throw new ConflictException('A voided entry cannot be changed')
    const category =
      input.categoryId && input.categoryId !== entry.categoryId
        ? await this.categories.requireAssignable(staff, input.categoryId)
        : null
    const row = await this.prisma.financeEntry.update({
      where: { id: entryId },
      data: {
        ...(category && { categoryId: category.id, kind: category.kind }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.method !== undefined && { method: input.method }),
        ...(input.occurredOn !== undefined && { occurredOn: fromIsoDay(input.occurredOn) }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.counterparty !== undefined && { counterparty: input.counterparty }),
        ...(input.reference !== undefined && { reference: input.reference }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
      include: ENTRY_INCLUDE,
    })
    return toEntryDto(row)
  }

  /** Conditional, so voiding twice (or racing) is refused rather than overwriting the reason. */
  async void(staff: AuthStaff, entryId: string, reason: string) {
    await this.require(staff, entryId)
    const { count } = await this.prisma.financeEntry.updateMany({
      where: { id: entryId, voidedAt: null },
      data: { voidedAt: new Date(), voidReason: reason, voidedById: staff.id },
    })
    if (!count) throw new ConflictException('This entry is already voided')
    return this.get(staff, entryId)
  }

  // --- Receipts --------------------------------------------------------------------

  async uploadReceipt(
    staff: AuthStaff,
    entryId: string,
    file: { fileName: string; bytes: Buffer; truncated: boolean },
  ) {
    const entry = await this.require(staff, entryId)
    if (entry.receipts.length >= MAX_RECEIPTS_PER_ENTRY) {
      throw new BadRequestException(`An entry can have at most ${MAX_RECEIPTS_PER_ENTRY} receipts`)
    }
    const mimeType = checkUpload(file, this.maxBytes)

    const id = randomUUID()
    const storageKey = `${staff.clinicId}/finance/${entryId}/${id}.${FILE_EXTENSION[mimeType]}`
    await this.storage.put(storageKey, file.bytes)
    try {
      const row = await this.prisma.financeReceipt.create({
        data: {
          entryId,
          uploadedById: staff.id,
          fileName: safeFileName(file.fileName),
          mimeType,
          sizeBytes: file.bytes.length,
          sha256: createHash('sha256').update(file.bytes).digest('hex'),
          storageKey,
        },
      })
      return toReceiptDto(row)
    } catch (error) {
      await this.storage.remove(storageKey) // don't leave orphaned bytes behind
      throw error
    }
  }

  async openReceipt(staff: AuthStaff, receiptId: string) {
    const row = await this.requireReceipt(staff, receiptId)
    return { stream: await this.storage.read(row.storageKey), ...toReceiptDto(row) }
  }

  /** Soft delete: the bytes stay, as the record behind the money. */
  async removeReceipt(staff: AuthStaff, receiptId: string) {
    await this.requireReceipt(staff, receiptId)
    await this.prisma.financeReceipt.update({ where: { id: receiptId }, data: { deletedAt: new Date() } })
  }

  private async requireReceipt(staff: AuthStaff, receiptId: string) {
    const row = await this.prisma.financeReceipt.findFirst({
      where: { id: receiptId, deletedAt: null, entry: { clinicId: staff.clinicId } },
    })
    if (!row) throw new NotFoundException('Receipt not found')
    return row
  }

  private async require(staff: AuthStaff, entryId: string) {
    const entry = await this.prisma.financeEntry.findFirst({
      where: { id: entryId, clinicId: staff.clinicId },
      include: ENTRY_INCLUDE,
    })
    if (!entry) throw new NotFoundException('Entry not found')
    return entry
  }
}
