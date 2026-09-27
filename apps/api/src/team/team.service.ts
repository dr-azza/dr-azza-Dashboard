import {
  canManageTeam,
  type CreateStaffInput,
  type PublicInviteDto,
  STAFF_INVITE_TTL_DAYS,
  type StaffInviteDto,
  type StaffStatus,
  type TeamMemberDto,
  type UpdateStaffInput,
} from '@azza/shared'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { AuditService } from '../audit/audit.service'
import { DAY_MS, hashPassword, hashToken, newSecretToken } from '../auth/auth.service'
import type { AuthStaff } from '../auth/auth.types'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

const MEMBER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  passwordHash: true,
  lastLoginAt: true,
  createdAt: true,
  invites: {
    where: { usedAt: null, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { expiresAt: true, createdBy: { select: { fullName: true } } },
  },
} as const
type MemberRow = Prisma.StaffMemberGetPayload<{ select: typeof MEMBER_SELECT }>

const statusOf = (m: { isActive: boolean; passwordHash: string | null }): StaffStatus =>
  !m.isActive ? 'inactive' : m.passwordHash ? 'active' : 'invited'

/**
 * The clinic's team. Everyone can see it; only owners change it. The clinic always keeps at
 * least one active owner, so it can never lock itself out. Nobody sets another person's
 * password: they get a one-time link (the raw token is returned once and stored hashed).
 */
@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(staff: AuthStaff): Promise<TeamMemberDto[]> {
    const rows = await this.prisma.staffMember.findMany({
      where: { clinicId: staff.clinicId },
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
      select: MEMBER_SELECT,
    })
    return rows.map((r) => this.toDto(r, staff))
  }

  async create(staff: AuthStaff, input: CreateStaffInput): Promise<StaffInviteDto> {
    this.requireManager(staff)
    try {
      // Member and first link together: never a member left without a link to join.
      return await this.prisma.$transaction(async (tx) => {
        const member = await tx.staffMember.create({
          data: {
            clinicId: staff.clinicId,
            fullName: input.fullName,
            email: input.email,
            phone: input.phone ?? null,
            role: input.role,
          },
          select: { id: true },
        })
        return this.issueLink(tx, staff, member.id)
      })
    } catch (error) {
      throw this.emailTaken(error)
    }
  }

  async update(staff: AuthStaff, memberId: string, input: UpdateStaffInput) {
    this.requireManager(staff)
    const current = await this.requireMember(staff, memberId)

    const losingOwner =
      current.role === 'OWNER' &&
      current.isActive &&
      ((input.role !== undefined && input.role !== 'OWNER') || input.active === false)
    if (memberId === staff.id && input.active === false) {
      throw new BadRequestException({ code: 'SELF_DEACTIVATE', message: 'You cannot deactivate your own account.' })
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (losingOwner) {
          // Lock the clinic's owners so two owners demoting each other at once can't both pass.
          const owners = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM staff_members
            WHERE clinic_id = ${staff.clinicId}::uuid AND role = 'OWNER' AND is_active
            FOR UPDATE`
          if (owners.length <= 1) {
            throw new BadRequestException({
              code: 'LAST_OWNER',
              message: 'The clinic needs at least one active owner. Make someone else an owner first.',
            })
          }
        }
        const row = await tx.staffMember.update({
          where: { id: memberId },
          data: {
            ...(input.fullName !== undefined && { fullName: input.fullName }),
            ...(input.email !== undefined && { email: input.email }),
            ...(input.phone !== undefined && { phone: input.phone ?? null }),
            ...(input.role !== undefined && { role: input.role }),
            ...(input.active !== undefined && { isActive: input.active }),
          },
          select: MEMBER_SELECT,
        })
        if (input.active === false) {
          // Deactivation takes effect now: open sessions end and pending links stop working.
          const now = new Date()
          await tx.session.updateMany({ where: { staffId: memberId, revokedAt: null }, data: { revokedAt: now } })
          await tx.staffInvite.updateMany({
            where: { staffId: memberId, usedAt: null, revokedAt: null },
            data: { revokedAt: now },
          })
        }
        return row
      })
      return this.toDto(updated, staff)
    } catch (error) {
      throw this.emailTaken(error)
    }
  }

  /** A new set-password link (first invite or reset). Any older unused link stops working. */
  async sendLink(staff: AuthStaff, memberId: string) {
    this.requireManager(staff)
    const member = await this.requireMember(staff, memberId)
    if (!member.isActive)
      throw new BadRequestException({
        code: 'INACTIVE_MEMBER',
        message: 'Reactivate this member before sending a link.',
      })
    return this.prisma.$transaction((tx) => this.issueLink(tx, staff, memberId))
  }

  // --- Public: the link itself ------------------------------------------------------

  async getInvite(token: string): Promise<PublicInviteDto> {
    const invite = await this.resolveInvite(token)
    return {
      fullName: invite.staff.fullName,
      email: invite.staff.email,
      clinicName: invite.staff.clinic.name,
      kind: invite.staff.passwordHash ? 'reset' : 'welcome',
    }
  }

  async acceptInvite(token: string, password: string) {
    const invite = await this.resolveInvite(token)
    const passwordHash = await hashPassword(password)
    const now = new Date()
    await this.prisma.$transaction(async (tx) => {
      // Single use, even if two tabs submit at once: only the first update matches. Expiry and the
      // member's status are checked again here, because hashing the password above takes a while.
      const { count } = await tx.staffInvite.updateMany({
        where: { id: invite.id, usedAt: null, revokedAt: null, expiresAt: { gt: now }, staff: { isActive: true } },
        data: { usedAt: now },
      })
      if (count === 0) throw new GoneException('This link can no longer be used.')
      await tx.staffMember.update({ where: { id: invite.staffId }, data: { passwordHash } })
      // A new password signs out every existing session (e.g. a reset after a lost phone).
      await tx.session.updateMany({ where: { staffId: invite.staffId, revokedAt: null }, data: { revokedAt: now } })
    })
    await this.audit.log({
      clinicId: invite.staff.clinicId,
      actorId: invite.staffId,
      action: invite.staff.passwordHash ? 'auth.password_reset' : 'auth.invite_accepted',
      entity: 'staff',
      entityId: invite.staffId,
    })
    return { email: invite.staff.email }
  }

  // --- Internals --------------------------------------------------------------------

  private async issueLink(tx: Prisma.TransactionClient, staff: AuthStaff, memberId: string): Promise<StaffInviteDto> {
    const token = newSecretToken()
    const expiresAt = new Date(Date.now() + STAFF_INVITE_TTL_DAYS * DAY_MS)
    await tx.staffInvite.updateMany({
      where: { staffId: memberId, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    await tx.staffInvite.create({
      data: { staffId: memberId, tokenHash: hashToken(token), expiresAt, createdById: staff.id },
    })
    const member = await tx.staffMember.findUniqueOrThrow({ where: { id: memberId }, select: MEMBER_SELECT })
    return { member: this.toDto(member, staff), token, expiresAt: expiresAt.toISOString() }
  }

  private async resolveInvite(token: string) {
    if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) throw new NotFoundException('Link not found')
    const invite = await this.prisma.staffInvite.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { staff: { include: { clinic: { select: { name: true } } } } },
    })
    if (!invite) throw new NotFoundException('Link not found')
    if (invite.usedAt) throw new GoneException('This link has already been used.')
    if (invite.revokedAt || invite.expiresAt <= new Date() || !invite.staff.isActive) {
      throw new GoneException('This link has expired. Ask the clinic for a new one.')
    }
    return invite
  }

  private requireManager(staff: AuthStaff) {
    if (!canManageTeam(staff.role)) throw new ForbiddenException('Only the clinic owner can manage the team.')
  }

  private async requireMember(staff: AuthStaff, memberId: string) {
    const member = await this.prisma.staffMember.findFirst({ where: { id: memberId, clinicId: staff.clinicId } })
    if (!member) throw new NotFoundException('Member not found')
    return member
  }

  private emailTaken(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException({ code: 'EMAIL_TAKEN', message: 'Someone already uses this email address.' })
    }
    return error
  }

  private toDto(r: MemberRow, staff: AuthStaff): TeamMemberDto {
    const invite = r.invites[0]
    return {
      id: r.id,
      fullName: r.fullName,
      email: r.email,
      phone: r.phone,
      role: r.role,
      status: statusOf(r),
      lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      pendingInvite:
        invite && invite.expiresAt > new Date()
          ? { expiresAt: invite.expiresAt.toISOString(), sentBy: invite.createdBy?.fullName ?? null }
          : null,
      isYou: r.id === staff.id,
    }
  }
}
