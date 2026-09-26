import type { CreatePaymentInput, PaymentDto, PaymentsDto } from '@azza/shared'
import { Injectable, NotFoundException } from '@nestjs/common'
import type { AuthStaff } from '../auth/auth.types'
import { STAFF_REF_SELECT, staffRef } from '../common/format'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { toAttachmentDto } from './attachments.service'
import { PatientScope } from './patient-scope.service'

const INCLUDE = {
  receivedBy: STAFF_REF_SELECT,
  proofs: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' }, include: { uploadedBy: STAFF_REF_SELECT } },
} satisfies Prisma.PaymentInclude

type Row = Prisma.PaymentGetPayload<{ include: typeof INCLUDE }>

const toDto = (p: Row): PaymentDto => ({
  id: p.id,
  amount: p.amount.toFixed(2),
  currency: p.currency,
  method: p.method,
  purpose: p.purpose,
  reference: p.reference,
  paidAt: p.paidAt.toISOString(),
  notes: p.notes,
  voidedAt: p.voidedAt?.toISOString() ?? null,
  voidReason: p.voidReason,
  receivedBy: staffRef(p.receivedBy),
  proofs: p.proofs.map(toAttachmentDto),
})

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: PatientScope,
  ) {}

  async list(staff: AuthStaff, patientId: string): Promise<PaymentsDto> {
    await this.scope.require(staff, patientId)
    const rows = await this.prisma.payment.findMany({
      where: { patientId },
      orderBy: { paidAt: 'desc' },
      include: INCLUDE,
    })
    // Sum with Decimal arithmetic in the database: money never goes through floats.
    const sum = await this.prisma.payment.aggregate({ where: { patientId, voidedAt: null }, _sum: { amount: true } })
    return { items: rows.map(toDto), totalPaid: (sum._sum.amount ?? new Prisma.Decimal(0)).toFixed(2), currency: 'EGP' }
  }

  async create(staff: AuthStaff, patientId: string, input: CreatePaymentInput) {
    await this.scope.require(staff, patientId)
    const row = await this.prisma.payment.create({
      data: {
        patientId,
        receivedById: staff.id,
        amount: new Prisma.Decimal(input.amount.toFixed(2)),
        method: input.method,
        purpose: input.purpose,
        reference: input.reference ?? null,
        paidAt: new Date(input.paidAt),
        notes: input.notes ?? null,
      },
      include: INCLUDE,
    })
    return toDto(row)
  }

  /** Payments are never deleted; a wrong entry is voided with a reason and excluded from totals. */
  async void(staff: AuthStaff, patientId: string, paymentId: string, reason: string) {
    await this.scope.require(staff, patientId)
    const found = await this.prisma.payment.count({ where: { id: paymentId, patientId, voidedAt: null } })
    if (!found) throw new NotFoundException('Payment not found')
    const row = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { voidedAt: new Date(), voidReason: reason },
      include: INCLUDE,
    })
    return toDto(row)
  }
}
