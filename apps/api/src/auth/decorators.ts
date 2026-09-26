import { createParamDecorator, type ExecutionContext, SetMetadata, UnauthorizedException } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import type { AuthStaff } from './auth.types'

export const IS_PUBLIC = 'isPublic'

/** Opens a route to unauthenticated callers. Everything else requires a staff session. */
export const Public = () => SetMetadata(IS_PUBLIC, true)

/** Injects the signed-in staff member. */
export const CurrentStaff = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthStaff => {
  const staff = ctx.switchToHttp().getRequest<FastifyRequest>().staff
  if (!staff) throw new UnauthorizedException()
  return staff
})
