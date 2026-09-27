import { CreateStaffSchema, SetPasswordSchema, UpdateStaffSchema } from '@azza/shared'
import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common'
import { RouteConfig } from '@nestjs/platform-fastify'
import { ApiTags } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { Audited } from '../audit/audited'
import type { AuthStaff } from '../auth/auth.types'
import { CurrentStaff, Public } from '../auth/decorators'
import { UuidPipe } from '../common/uuid.pipe'
import { TeamService } from './team.service'

class CreateStaffDto extends createZodDto(CreateStaffSchema) {}
class UpdateStaffDto extends createZodDto(UpdateStaffSchema) {}
class SetPasswordDto extends createZodDto(SetPasswordSchema) {}

@ApiTags('team')
@Controller('team')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  list(@CurrentStaff() staff: AuthStaff) {
    return this.team.list(staff)
  }

  @Post()
  @Audited('team.member.create', 'staff')
  create(@CurrentStaff() staff: AuthStaff, @Body() body: CreateStaffDto) {
    return this.team.create(staff, body)
  }

  @Patch(':memberId')
  @Audited('team.member.update', 'staff')
  update(
    @CurrentStaff() staff: AuthStaff,
    @Param('memberId', UuidPipe) memberId: string,
    @Body() body: UpdateStaffDto,
  ) {
    return this.team.update(staff, memberId, body)
  }

  @Post(':memberId/link')
  @HttpCode(200)
  @Audited('team.member.link', 'staff')
  sendLink(@CurrentStaff() staff: AuthStaff, @Param('memberId', UuidPipe) memberId: string) {
    return this.team.sendLink(staff, memberId)
  }
}

/** The set-password page behind an invite or reset link. No session; rate limited. */
@ApiTags('team')
@Controller('public/invites')
@Public()
export class PublicInvitesController {
  constructor(private readonly team: TeamService) {}

  @Get(':token')
  @RouteConfig({ rateLimit: { max: 30, timeWindow: '1 minute' } })
  get(@Param('token') token: string) {
    return this.team.getInvite(token)
  }

  @Post(':token')
  @HttpCode(200)
  @RouteConfig({ rateLimit: { max: 10, timeWindow: '1 minute' } })
  accept(@Param('token') token: string, @Body() body: SetPasswordDto) {
    return this.team.acceptInvite(token, body.password)
  }
}
