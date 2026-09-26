import { Controller, Get, HttpStatus, Res, VERSION_NEUTRAL } from '@nestjs/common'
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger'
import type { FastifyReply } from 'fastify'
import { PrismaService } from '../prisma/prisma.service'
import { Public } from '../auth/decorators'

@ApiTags('health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
@Public()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness and readiness in one: 200 when the database is reachable, 503 otherwise. */
  @Get()
  @ApiOkResponse({ description: 'API and database are up' })
  @ApiServiceUnavailableResponse({ description: 'Database is unreachable' })
  async check(@Res({ passthrough: true }) reply: FastifyReply) {
    const database = (await this.prisma.isHealthy()) ? 'up' : 'down'
    if (database === 'down') reply.status(HttpStatus.SERVICE_UNAVAILABLE)
    return { status: database === 'up' ? 'ok' : 'degraded', database, uptimeSeconds: Math.round(process.uptime()) }
  }
}
