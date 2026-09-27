import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor, SetMetadata } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { FastifyRequest } from 'fastify'
import { concatMap } from 'rxjs'
import { AuditService } from './audit.service'

const AUDIT = 'audit'

interface AuditMeta {
  action: string
  entity: string
}

/**
 * Records a successful call in the audit log: who, what, which patient and record.
 * Only identifiers are logged, never clinical content.
 */
export const Audited = (action: string, entity: string) => SetMetadata(AUDIT, { action, entity } satisfies AuditMeta)

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const meta = this.reflector.get<AuditMeta | undefined>(AUDIT, context.getHandler())
    if (!meta) return next.handle()

    const request = context.switchToHttp().getRequest<FastifyRequest<{ Params: Record<string, string> }>>()
    return next.handle().pipe(
      // Awaited before the response goes out, so a client that re-reads the activity log right
      // after a change always sees it. AuditService.log never throws.
      concatMap(async (result: unknown) => {
        const params = request.params ?? {}
        const resultId = result && typeof result === 'object' && 'id' in result ? String(result.id) : undefined
        const entityId = params.entryId ?? params.itemId ?? resultId ?? params.patientId ?? null
        // Every patient route is under /patients/:patientId; creating a patient links to the new one.
        const resultPatientId =
          result &&
          typeof result === 'object' &&
          'patient' in result &&
          result.patient &&
          typeof result.patient === 'object' &&
          'id' in result.patient
            ? String(result.patient.id)
            : undefined
        // A record that belongs to a patient (e.g. a form response) also lands in her activity log.
        const patientId =
          params.patientId || (meta.entity === 'patient' ? resultId : undefined) || resultPatientId || null
        await this.audit.log({
          clinicId: request.staff?.clinicId,
          actorId: request.staff?.id,
          action: meta.action,
          entity: meta.entity,
          entityId,
          patientId,
          ip: request.ip,
        })
        return result
      }),
    )
  }
}
