import type { StaffListItemDto } from '@azza/shared'
import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { AuthStaff } from '../auth/auth.types'
import { CurrentStaff } from '../auth/decorators'
import { PrismaService } from '../prisma/prisma.service'

/** The clinic's active staff, e.g. to choose who an appointment is with. Names and roles only. */
@ApiTags('staff')
@Controller('staff')
export class StaffController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentStaff() staff: AuthStaff): Promise<StaffListItemDto[]> {
    return this.prisma.staffMember.findMany({
      where: { clinicId: staff.clinicId, isActive: true },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, role: true },
    })
  }
}
