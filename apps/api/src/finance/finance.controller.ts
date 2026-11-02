import {
  CreateFinanceCategorySchema,
  CreateFinanceEntrySchema,
  CreateRecurringExpenseSchema,
  FinanceExportQuerySchema,
  FinanceSummaryQuerySchema,
  FinanceTransactionsQuerySchema,
  UpdateFinanceCategorySchema,
  UpdateFinanceEntrySchema,
  UpdateRecurringExpenseSchema,
  VoidFinanceEntrySchema,
} from '@azza/shared'
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common'
import { ApiConsumes, ApiTags } from '@nestjs/swagger'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { createZodDto } from 'nestjs-zod'
import { Audited } from '../audit/audited'
import type { AuthStaff } from '../auth/auth.types'
import { CurrentStaff } from '../auth/decorators'
import { UuidPipe } from '../common/uuid.pipe'
import { FinanceAccessGuard } from './finance-access.guard'
import { FinanceCategoriesService } from './finance-categories.service'
import { FinanceEntriesService } from './finance-entries.service'
import { FinanceReportsService } from './finance-reports.service'
import { RecurringExpensesService } from './recurring-expenses.service'

class SummaryQueryDto extends createZodDto(FinanceSummaryQuerySchema) {}
class TransactionsQueryDto extends createZodDto(FinanceTransactionsQuerySchema) {}
class ExportQueryDto extends createZodDto(FinanceExportQuerySchema) {}
class CreateEntryDto extends createZodDto(CreateFinanceEntrySchema) {}
class UpdateEntryDto extends createZodDto(UpdateFinanceEntrySchema) {}
class VoidEntryDto extends createZodDto(VoidFinanceEntrySchema) {}
class CreateCategoryDto extends createZodDto(CreateFinanceCategorySchema) {}
class UpdateCategoryDto extends createZodDto(UpdateFinanceCategorySchema) {}
class CreateRecurringDto extends createZodDto(CreateRecurringExpenseSchema) {}
class UpdateRecurringDto extends createZodDto(UpdateRecurringExpenseSchema) {}

/** Clinic finances: reports, other income and expenses, receipts, recurring expenses. Owners only. */
@ApiTags('finance')
@UseGuards(FinanceAccessGuard)
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly reports: FinanceReportsService,
    private readonly entries: FinanceEntriesService,
    private readonly categories: FinanceCategoriesService,
    private readonly recurring: RecurringExpensesService,
  ) {}

  // --- Reports ---------------------------------------------------------------------

  @Get('summary')
  summary(@CurrentStaff() staff: AuthStaff, @Query() query: SummaryQueryDto) {
    return this.reports.summary(staff, query)
  }

  @Get('transactions')
  transactions(@CurrentStaff() staff: AuthStaff, @Query() query: TransactionsQueryDto) {
    return this.reports.transactions(staff, query)
  }

  @Get('export')
  @Audited('finance.export', 'finance')
  async export(
    @CurrentStaff() staff: AuthStaff,
    @Query() query: ExportQueryDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const csv = await this.reports.exportCsv(staff, query)
    reply.headers({
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="azzah-finance-${query.from}-to-${query.to}.csv"`,
      'cache-control': 'private, no-store',
    })
    return csv
  }

  // --- Entries and receipts ------------------------------------------------------

  @Post('entries')
  @Audited('finance.entry.create', 'finance_entry')
  createEntry(@CurrentStaff() staff: AuthStaff, @Body() body: CreateEntryDto) {
    return this.entries.create(staff, body)
  }

  @Get('entries/:itemId')
  getEntry(@CurrentStaff() staff: AuthStaff, @Param('itemId', UuidPipe) id: string) {
    return this.entries.get(staff, id)
  }

  @Patch('entries/:itemId')
  @Audited('finance.entry.update', 'finance_entry')
  updateEntry(@CurrentStaff() staff: AuthStaff, @Param('itemId', UuidPipe) id: string, @Body() body: UpdateEntryDto) {
    return this.entries.update(staff, id, body)
  }

  @Post('entries/:itemId/void')
  @HttpCode(200)
  @Audited('finance.entry.void', 'finance_entry')
  voidEntry(@CurrentStaff() staff: AuthStaff, @Param('itemId', UuidPipe) id: string, @Body() body: VoidEntryDto) {
    return this.entries.void(staff, id, body.reason)
  }

  /** multipart/form-data with one `file`. */
  @Post('entries/:itemId/receipts')
  @ApiConsumes('multipart/form-data')
  @Audited('finance.receipt.upload', 'finance_receipt')
  async uploadReceipt(
    @CurrentStaff() staff: AuthStaff,
    @Param('itemId', UuidPipe) id: string,
    @Req() req: FastifyRequest,
  ) {
    if (!req.isMultipart()) throw new BadRequestException('Send the file as multipart/form-data')
    const part = await req.file()
    if (!part) throw new BadRequestException('No file was sent')
    const bytes = await part.toBuffer()
    return this.entries.uploadReceipt(staff, id, { fileName: part.filename, bytes, truncated: part.file.truncated })
  }

  @Get('receipts/:itemId/file')
  @Audited('finance.receipt.download', 'finance_receipt')
  async downloadReceipt(
    @CurrentStaff() staff: AuthStaff,
    @Param('itemId', UuidPipe) id: string,
    @Query('download') download: string | undefined,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const file = await this.entries.openReceipt(staff, id)
    reply.headers({
      'content-type': file.mimeType,
      'content-length': String(file.sizeBytes),
      'content-disposition': `${download === '1' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    })
    return new StreamableFile(file.stream)
  }

  @Delete('receipts/:itemId')
  @HttpCode(204)
  @Audited('finance.receipt.delete', 'finance_receipt')
  removeReceipt(@CurrentStaff() staff: AuthStaff, @Param('itemId', UuidPipe) id: string) {
    return this.entries.removeReceipt(staff, id)
  }

  // --- Categories ------------------------------------------------------------------

  @Get('categories')
  listCategories(@CurrentStaff() staff: AuthStaff, @Query('includeArchived') includeArchived?: string) {
    return this.categories.list(staff, includeArchived === 'true')
  }

  @Post('categories')
  @Audited('finance.category.create', 'finance_category')
  createCategory(@CurrentStaff() staff: AuthStaff, @Body() body: CreateCategoryDto) {
    return this.categories.create(staff, body)
  }

  @Patch('categories/:itemId')
  @Audited('finance.category.update', 'finance_category')
  updateCategory(
    @CurrentStaff() staff: AuthStaff,
    @Param('itemId', UuidPipe) id: string,
    @Body() body: UpdateCategoryDto,
  ) {
    return this.categories.update(staff, id, body)
  }

  // --- Recurring expenses ----------------------------------------------------------

  @Get('recurring')
  listRecurring(@CurrentStaff() staff: AuthStaff) {
    return this.recurring.list(staff)
  }

  @Post('recurring')
  @Audited('finance.recurring.create', 'recurring_expense')
  createRecurring(@CurrentStaff() staff: AuthStaff, @Body() body: CreateRecurringDto) {
    return this.recurring.create(staff, body)
  }

  @Patch('recurring/:itemId')
  @Audited('finance.recurring.update', 'recurring_expense')
  updateRecurring(
    @CurrentStaff() staff: AuthStaff,
    @Param('itemId', UuidPipe) id: string,
    @Body() body: UpdateRecurringDto,
  ) {
    return this.recurring.update(staff, id, body)
  }
}
