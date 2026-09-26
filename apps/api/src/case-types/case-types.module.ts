import { Global, Module } from '@nestjs/common'
import { CaseTypesController } from './case-types.controller'
import { CaseTypesService } from './case-types.service'

@Global()
@Module({ controllers: [CaseTypesController], providers: [CaseTypesService], exports: [CaseTypesService] })
export class CaseTypesModule {}
