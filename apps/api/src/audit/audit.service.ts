import { Injectable, Logger } from '@nestjs/common'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export interface AuditEntry {
  clinicId?: string | null
  actorId?: string | null
  /** Dotted verb, e.g. "patient.view", "prescription.create". */
  action: string
  entity: string
  entityId?: string | null
  ip?: string | null
  meta?: Prisma.InputJsonValue
}

/** Append-only record of who read or changed medical data. Never store clinical content in `meta`. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name)

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry) {
    try {
      await this.prisma.auditLog.create({ data: entry })
    } catch (error) {
      // A failed audit write must be visible to operators, but must not hide the original result.
      this.logger.error(`Audit write failed for ${entry.action}`, error as Error)
    }
  }
}
