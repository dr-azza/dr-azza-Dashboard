import { Module } from '@nestjs/common'
import { PublicInvitesController, TeamController } from './team.controller'
import { TeamService } from './team.service'

@Module({ controllers: [TeamController, PublicInvitesController], providers: [TeamService] })
export class TeamModule {}
