import { LoginSchema, type MeDto } from '@azza/shared'
import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { createZodDto } from 'nestjs-zod'
import { ENV, type Env } from '../config/env'
import { AuthService } from './auth.service'
import { type AuthStaff, SESSION_COOKIE } from './auth.types'
import { CurrentStaff, Public } from './decorators'

class LoginDto extends createZodDto(LoginSchema) {}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(204)
  async login(@Body() body: LoginDto, @Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const { token, expiresAt } = await this.auth.login(body.email, body.password, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    })
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: this.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    })
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentStaff() staff: AuthStaff,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.auth.logout(staff, req.ip)
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
  }

  @Get('me')
  me(@CurrentStaff() staff: AuthStaff): MeDto {
    return {
      id: staff.id,
      fullName: staff.fullName,
      email: staff.email,
      role: staff.role,
      clinic: { id: staff.clinicId, name: staff.clinicName },
    }
  }
}
