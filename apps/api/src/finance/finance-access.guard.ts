import { canSeeFinance } from '@azza/shared'
import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'

/** Clinic finances are for owners only. Runs after the global sign-in guard. */
@Injectable()
export class FinanceAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const staff = context.switchToHttp().getRequest<FastifyRequest>().staff
    if (!staff || !canSeeFinance(staff.role)) throw new ForbiddenException('Only clinic owners can see finances')
    return true
  }
}
