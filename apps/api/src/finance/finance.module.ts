import { Module } from '@nestjs/common'
import { FinanceController } from './finance.controller'
import { FinanceCategoriesService } from './finance-categories.service'
import { FinanceEntriesService } from './finance-entries.service'
import { FinanceReportsService } from './finance-reports.service'
import { RecurringExpensesService } from './recurring-expenses.service'

@Module({
  controllers: [FinanceController],
  providers: [FinanceCategoriesService, FinanceEntriesService, FinanceReportsService, RecurringExpensesService],
})
export class FinanceModule {}
