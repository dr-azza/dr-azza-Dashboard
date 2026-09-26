import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { FastifyRequest } from 'fastify'
import { AuthService } from './auth.service'
import { SESSION_COOKIE } from './auth.types'
import { IS_PUBLIC } from './decorators'

/**
 * Global guard: every route needs a valid staff session unless marked @Public().
 * The web app sends an httpOnly cookie; the mobile app will send `Authorization: Bearer <token>`.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true

    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const header = request.headers.authorization
    const token = header?.startsWith('Bearer ') ? header.slice(7) : request.cookies?.[SESSION_COOKIE]
    if (!token) throw new UnauthorizedException('Sign in required')

    const staff = await this.auth.authenticate(token)
    if (!staff) throw new UnauthorizedException('Session expired, please sign in again')
    request.staff = staff
    return true
  }
}
