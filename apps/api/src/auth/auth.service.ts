import { hash, verify } from '@node-rs/argon2'
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { createHash, randomBytes } from 'node:crypto'
import { AuditService } from '../audit/audit.service'
import { ENV, type Env } from '../config/env'
import { PrismaService } from '../prisma/prisma.service'
import type { AuthStaff } from './auth.types'

/** OWASP-recommended Argon2id parameters (19 MiB, 2 iterations). */
const ARGON2 = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const
/** Only touch last_seen_at every few minutes, not on every request. */
const TOUCH_AFTER_MS = 5 * 60 * 1000

export const hashPassword = (password: string) => hash(password, ARGON2)
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
/** 256 random bits, URL-safe: sessions, invite links and personal form links all use this. */
export const newSecretToken = () => randomBytes(32).toString('base64url')
export const DAY_MS = 24 * 60 * 60 * 1000

@Injectable()
export class AuthService {
  /** Compared against when the email is unknown, so response time doesn't reveal which emails exist. */
  private readonly dummyHash = hashPassword(randomBytes(16).toString('hex'))

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  get sessionTtlMs() {
    return this.env.SESSION_TTL_HOURS * 60 * 60 * 1000
  }

  async login(email: string, password: string, meta: { ip?: string; userAgent?: string }) {
    const staff = await this.prisma.staffMember.findFirst({
      where: { email, isActive: true },
      include: { clinic: { select: { id: true, name: true } } },
    })
    const ok = await verify(staff?.passwordHash ?? (await this.dummyHash), password).catch(() => false)
    if (!staff?.passwordHash || !ok) {
      await this.audit.log({
        clinicId: staff?.clinicId,
        action: 'auth.login_failed',
        entity: 'staff',
        meta: { email },
        ip: meta.ip,
      })
      throw new UnauthorizedException('Email or password is incorrect')
    }

    const token = newSecretToken()
    const session = await this.prisma.session.create({
      data: {
        staffId: staff.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + this.sessionTtlMs),
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 300),
      },
    })
    await this.prisma.staffMember.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } })
    await this.audit.log({
      clinicId: staff.clinicId,
      actorId: staff.id,
      action: 'auth.login',
      entity: 'session',
      entityId: session.id,
      ip: meta.ip,
    })
    return { token, expiresAt: session.expiresAt }
  }

  /** Resolves a raw token to the signed-in staff member, sliding the expiry on activity. */
  async authenticate(token: string): Promise<AuthStaff | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { staff: { include: { clinic: { select: { id: true, name: true } } } } },
    })
    const now = Date.now()
    if (!session || session.revokedAt || session.expiresAt.getTime() <= now || !session.staff.isActive) return null

    if (now - session.lastSeenAt.getTime() > TOUCH_AFTER_MS) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(now), expiresAt: new Date(now + this.sessionTtlMs) },
      })
    }
    const { staff } = session
    return {
      id: staff.id,
      clinicId: staff.clinicId,
      clinicName: staff.clinic.name,
      email: staff.email,
      fullName: staff.fullName,
      role: staff.role,
      sessionId: session.id,
    }
  }

  async logout(staff: AuthStaff, ip?: string) {
    await this.prisma.session.update({ where: { id: staff.sessionId }, data: { revokedAt: new Date() } })
    await this.audit.log({
      clinicId: staff.clinicId,
      actorId: staff.id,
      action: 'auth.logout',
      entity: 'session',
      entityId: staff.sessionId,
      ip,
    })
  }
}
