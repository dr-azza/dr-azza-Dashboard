import type { StaffListItemDto } from '@azza/shared'
import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { AuthStaff } from '../auth/auth.types'
import { CurrentStaff } from '../auth/decorators'
import { PrismaService } from '../prisma/prisma.service'

/** Staff who can sign in now, e.g. to choose who an appointment is with. Names and roles only. */
@ApiTags('staff')
@Controller('staff')
export class StaffController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentStaff() staff: AuthStaff): Promise<StaffListItemDto[]> {
    return this.prisma.staffMember.findMany({
      // Invited members who haven't set a password yet can't sign in, so they aren't offered.
      where: { clinicId: staff.clinicId, isActive: true, passwordHash: { not: null } },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, role: true },
    })
  }
}
