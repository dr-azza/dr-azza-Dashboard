import { BadRequestException, type PipeTransform } from '@nestjs/common'
import { z } from 'zod'

const Uuid = z.uuid()

/** Rejects malformed ids with 400 before they reach the database. */
export class UuidPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (!Uuid.safeParse(value).success) throw new BadRequestException('Invalid id')
    return value
  }
}
