import { CHECKIN_SYMPTOMS, checkinFlags } from '@azza/shared'
import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const EvaluateCheckinSchema = z.object({
  symptoms: z.array(z.enum(CHECKIN_SYMPTOMS)).max(CHECKIN_SYMPTOMS.length).default([]),
  systolic: z.number().int().min(50).max(260).nullish(),
  diastolic: z.number().int().min(30).max(180).nullish(),
})

class EvaluateCheckinDto extends createZodDto(EvaluateCheckinSchema) {}

const EvaluationSchema = z.object({
  urgent: z.boolean(),
  flags: z.array(z.string()),
})

class EvaluationDto extends createZodDto(EvaluationSchema) {}

/**
 * Stateless evaluation of check-in answers with the shared clinical rules, so the web form,
 * the mobile app and the API always judge the same answers the same way. Stores nothing.
 */
@ApiTags('checkins')
@Controller('checkins')
export class CheckinsController {
  @Post('evaluate')
  @HttpCode(200)
  @ApiOkResponse({ type: EvaluationDto })
  evaluate(@Body() body: EvaluateCheckinDto): EvaluationDto {
    const flags = checkinFlags(body)
    return { urgent: flags.length > 0, flags }
  }
}
