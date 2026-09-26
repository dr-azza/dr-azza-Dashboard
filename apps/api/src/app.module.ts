import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { ZodValidationPipe } from 'nestjs-zod'
import { AuditModule } from './audit/audit.module'
import { AuditInterceptor } from './audit/audited'
import { AuthModule } from './auth/auth.module'
import { CaseTypesModule } from './case-types/case-types.module'
import { CheckinsModule } from './checkins/checkins.module'
import { ConfigModule } from './config/config.module'
import { HealthModule } from './health/health.module'
import { PatientsModule } from './patients/patients.module'
import { PrismaModule } from './prisma/prisma.module'
import { StaffModule } from './staff/staff.module'
import { StorageModule } from './storage/storage.module'

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuditModule,
    StorageModule,
    AuthModule,
    CaseTypesModule,
    HealthModule,
    CheckinsModule,
    PatientsModule,
    StaffModule,
  ],
  providers: [
    // Every request body, query and param with a Zod DTO is validated before reaching a handler.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Handlers marked @Audited() are written to the audit log after they succeed.
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
