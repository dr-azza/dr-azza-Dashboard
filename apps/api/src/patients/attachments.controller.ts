import { ATTACHMENT_KINDS, type AttachmentKindCode, AttachmentMetaSchema } from '@azza/shared'
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common'
import { ApiConsumes, ApiTags } from '@nestjs/swagger'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { Audited } from '../audit/audited'
import type { AuthStaff } from '../auth/auth.types'
import { CurrentStaff } from '../auth/decorators'
import { UuidPipe } from '../common/uuid.pipe'
import { AttachmentsService } from './attachments.service'

@ApiTags('patients · files')
@Controller('patients/:patientId/attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get()
  @Audited('file.list', 'attachment')
  list(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Query('kind') kind?: string,
  ) {
    if (kind && !(ATTACHMENT_KINDS as readonly string[]).includes(kind))
      throw new BadRequestException('Unknown file kind')
    return this.attachments.list(staff, patientId, kind as AttachmentKindCode | undefined)
  }

  /** multipart/form-data with fields `kind`, `title`, optional `takenAt`, `paymentId`, then one `file`. */
  @Post()
  @ApiConsumes('multipart/form-data')
  @Audited('file.upload', 'attachment')
  async upload(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Req() req: FastifyRequest,
  ) {
    if (!req.isMultipart()) throw new BadRequestException('Send the file as multipart/form-data')
    const part = await req.file()
    if (!part) throw new BadRequestException('No file was sent')

    const bytes = await part.toBuffer()
    const fields = Object.fromEntries(
      Object.entries(part.fields).flatMap(([name, field]) =>
        field && !Array.isArray(field) && field.type === 'field'
          ? [[name, field.value === '' ? undefined : field.value]]
          : [],
      ),
    )
    const meta = AttachmentMetaSchema.safeParse(fields)
    if (!meta.success) {
      throw new BadRequestException({ statusCode: 400, message: 'Validation failed', errors: meta.error.issues })
    }
    return this.attachments.upload(staff, patientId, meta.data, {
      fileName: part.filename,
      bytes,
      truncated: part.file.truncated,
    })
  }

  @Get(':itemId/file')
  @Audited('file.download', 'attachment')
  async download(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Param('itemId', UuidPipe) id: string,
    @Query('download') download: string | undefined,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const file = await this.attachments.open(staff, patientId, id)
    const disposition = download === '1' ? 'attachment' : 'inline'
    reply.headers({
      'content-type': file.mimeType,
      'content-length': String(file.sizeBytes),
      'content-disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      // Medical files must never be kept by shared caches.
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    })
    return new StreamableFile(file.stream)
  }

  @Delete(':itemId')
  @HttpCode(204)
  @Audited('file.delete', 'attachment')
  remove(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Param('itemId', UuidPipe) id: string,
  ) {
    return this.attachments.remove(staff, patientId, id)
  }
}
