import { Module } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { ZodValidationPipe } from 'nestjs-zod'
import { CheckinsModule } from './checkins/checkins.module'
import { ConfigModule } from './config/config.module'
import { HealthModule } from './health/health.module'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [ConfigModule, PrismaModule, HealthModule, CheckinsModule],
  providers: [
    // Every request body, query and param with a Zod DTO is validated before reaching a handler.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule {}
