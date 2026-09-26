import { dueDate, gestationalAge, parseDay, trimester } from '@azza/shared'
import { Injectable, NotFoundException } from '@nestjs/common'
import type { AuthStaff } from '../auth/auth.types'
import { toIsoDay } from '../common/format'
import { PrismaService } from '../prisma/prisma.service'

/** Today's calendar date in the clinic's time zone, as YYYY-MM-DD. */
export function clinicToday(timeZone = 'Africa/Cairo', now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/**
 * Gestational facts from an LMP stored as a DATE. Dates are compared as calendar days in the
 * clinic's time zone, using the same rules as the web and mobile apps (@azza/shared).
 */
export function pregnancyFacts(lmp: Date, eddOverride: Date | null, onDay = clinicToday()) {
  const lmpDay = parseDay(toIsoDay(lmp))
  const ga = gestationalAge(lmpDay, parseDay(onDay))
  const edd = eddOverride ? toIsoDay(eddOverride) : localIsoDay(dueDate(lmpDay))
  return { weeks: ga.weeks, days: ga.days, totalDays: ga.totalDays, trimester: trimester(ga.weeks), edd }
}

/** Gestational age on a given instant (e.g. a visit), in the clinic's time zone. */
export function gestationOn(lmp: Date, at: Date, timeZone = 'Africa/Cairo') {
  const { weeks, days } = pregnancyFacts(lmp, null, clinicToday(timeZone, at))
  return { weeks, days }
}

const localIsoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Every patient sub-resource goes through here, so a staff member can only ever reach patients
 * of their own clinic. A patient from another clinic is indistinguishable from a missing one (404).
 */
@Injectable()
export class PatientScope {
  constructor(private readonly prisma: PrismaService) {}

  async require(staff: AuthStaff, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, clinicId: staff.clinicId, archivedAt: null },
      select: { id: true, clinicId: true, fullName: true, clinic: { select: { timezone: true } } },
    })
    if (!patient) throw new NotFoundException('Patient not found')
    return { id: patient.id, clinicId: patient.clinicId, fullName: patient.fullName, timeZone: patient.clinic.timezone }
  }
}
