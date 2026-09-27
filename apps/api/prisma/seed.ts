/**
 * Development seed: one clinic, its staff and a few sample patients. All data is fictional.
 * Run with `pnpm --filter @azza/api db:seed`. Safe to re-run: records are upserted by natural keys.
 */
import { hash } from '@node-rs/argon2'
import { PrismaPg } from '@prisma/adapter-pg'
import { DEFAULT_CASE_TYPES } from '../src/case-types/defaults'
import { PrismaClient } from '../src/generated/prisma/client'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set (copy apps/api/.env.example to .env)')
// A test deployment runs in production mode but may opt in to demo data (never a real clinic's DB).
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
  throw new Error('Refusing to seed a production database (set ALLOW_DEMO_SEED=true only for a test deployment)')
}

const staffPassword = process.env.SEED_STAFF_PASSWORD ?? ''
if (staffPassword.length < 10) throw new Error('Set SEED_STAFF_PASSWORD (10+ characters) in apps/api/.env')

/** Written last by a complete seed run. */
const SEED_DONE = 'system.demo_seed_completed'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

/** A calendar day `n` days before today, as the UTC-midnight Date that Prisma stores in DATE columns. */
const daysAgo = (n: number) => {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - n))
}

async function main() {
  // On a test deployment the seed runs at every deploy but fills the database only once, so what
  // testers create or change is kept. "Once" means the last run finished (the marker below is its
  // final write); an interrupted run is simply repeated, since every record is upserted.
  if (
    process.env.SEED_ONLY_IF_EMPTY === 'true' &&
    (await prisma.auditLog.count({ where: { action: SEED_DONE } })) > 0
  ) {
    console.log('Demo data already seeded; skipped.')
    return
  }
  const clinic = await prisma.clinic.upsert({
    where: { slug: 'azzah-main' },
    update: {},
    create: { name: 'AZZAH', slug: 'azzah-main' },
  })

  const staff = [
    { email: 'doctor@azzah.test', fullName: 'Doctor (sample)', role: 'OWNER' as const },
    { email: 'nurse@azzah.test', fullName: 'Nurse (sample)', role: 'NURSE' as const },
    { email: 'reception@azzah.test', fullName: 'Reception (sample)', role: 'RECEPTION' as const },
  ]
  const passwordHash = await hash(staffPassword, { memoryCost: 19_456, timeCost: 2, parallelism: 1 })
  const staffIds: Record<string, string> = {}
  for (const s of staff) {
    const row = await prisma.staffMember.upsert({
      where: { email: s.email },
      update: { passwordHash },
      create: { ...s, clinicId: clinic.id, passwordHash },
    })
    staffIds[s.role] = row.id
  }

  type SeedPatient = {
    fileNumber: string
    fullName: string
    fullNameAr: string
    phone: string
    caseType: 'PREGNANCY' | 'GYNECOLOGY' | 'POSTPARTUM' | 'FERTILITY'
    status: 'OK' | 'FLAGGED' | 'OVERDUE' | 'AWAITING'
    pregnancy?: { gaDays: number; gravida: number; para: number; bloodGroup: string }
  }
  const patients: SeedPatient[] = [
    {
      fileNumber: 'P-1187',
      fullName: 'Rana Tarek',
      fullNameAr: 'رنا طارق',
      phone: '+201000004410',
      caseType: 'PREGNANCY',
      status: 'FLAGGED',
      pregnancy: { gaDays: 215, gravida: 3, para: 2, bloodGroup: 'O+' },
    },
    {
      fileNumber: 'P-1203',
      fullName: 'Dina Samir',
      fullNameAr: 'دينا سمير',
      phone: '+201000007781',
      caseType: 'PREGNANCY',
      status: 'FLAGGED',
      pregnancy: { gaDays: 238, gravida: 1, para: 0, bloodGroup: 'A+' },
    },
    {
      fileNumber: 'P-1042',
      fullName: 'Mariam Adel',
      fullNameAr: 'مريم عادل',
      phone: '+201000002231',
      caseType: 'PREGNANCY',
      status: 'OK',
      pregnancy: { gaDays: 198, gravida: 2, para: 1, bloodGroup: 'B+' },
    },
    {
      fileNumber: 'P-0411',
      fullName: 'Nour El-Sayed',
      fullNameAr: 'نور السيد',
      phone: '+201200005518',
      caseType: 'GYNECOLOGY',
      status: 'OK',
    },
    {
      fileNumber: 'P-0988',
      fullName: 'Laila Nabil',
      fullNameAr: 'ليلى نبيل',
      phone: '+201200003302',
      caseType: 'POSTPARTUM',
      status: 'AWAITING',
    },
  ]

  // Built-in cases: the same list the API and the case_types migration use.
  await prisma.caseType.createMany({
    data: DEFAULT_CASE_TYPES.map((c) => ({ ...c, clinicId: clinic.id })),
    skipDuplicates: true,
  })
  const cases = await prisma.caseType.findMany({ where: { clinicId: clinic.id, systemKey: { not: null } } })
  const caseId = (key: string) => cases.find((c) => c.systemKey === key)!.id

  for (const { pregnancy, caseType, ...data } of patients) {
    const patient = await prisma.patient.upsert({
      where: { clinicId_fileNumber: { clinicId: clinic.id, fileNumber: data.fileNumber } },
      update: {},
      create: { ...data, caseTypeId: caseId(caseType), clinicId: clinic.id, consentAt: new Date() },
    })
    if (pregnancy && (await prisma.pregnancy.count({ where: { patientId: patient.id } })) === 0) {
      const { gaDays, ...details } = pregnancy
      await prisma.pregnancy.create({ data: { ...details, patientId: patient.id, lmp: daysAgo(gaDays) } })
    }
  }

  // A full record for one patient, so every tab of the patient file has something to show.
  const rana = await prisma.patient.findUniqueOrThrow({
    where: { clinicId_fileNumber: { clinicId: clinic.id, fileNumber: 'P-1187' } },
    include: { pregnancies: true, visits: true },
  })
  const doctorId = staffIds.OWNER
  if (!rana.visits.length) {
    await prisma.patient.update({ where: { id: rana.id }, data: { dateOfBirth: new Date('1991-03-14T00:00:00Z') } })
    await prisma.medicalHistory.upsert({
      where: { patientId: rana.id },
      update: {},
      create: {
        patientId: rana.id,
        allergies: [{ substance: 'Penicillin', reaction: 'Rash', severity: 'moderate' }],
        chronicConditions: [],
        currentMedications: ['Ferrous sulfate 200 mg once daily'],
        surgeries: [{ name: 'Cesarean section', year: 2023 }],
        bloodGroup: 'O+',
        familyHistory: 'Mother: type 2 diabetes',
        smoking: false,
        menarcheAge: 13,
        cycleLengthDays: 28,
        periodLengthDays: 5,
        cycleRegular: true,
        contraception: 'None (pregnant)',
        updatedById: doctorId,
      },
    })
    await prisma.obstetricHistoryEntry.createMany({
      data: [
        {
          patientId: rana.id,
          year: 2019,
          outcome: 'LIVE_BIRTH',
          deliveryMode: 'VAGINAL',
          gestationWeeks: 39,
          birthWeightG: 3200,
        },
        {
          patientId: rana.id,
          year: 2023,
          outcome: 'LIVE_BIRTH',
          deliveryMode: 'CESAREAN',
          gestationWeeks: 38,
          birthWeightG: 3400,
          complications: 'Failure to progress',
        },
      ],
    })
    const pregnancyId = rana.pregnancies[0]?.id
    const visit = (daysBack: number, v: Record<string, unknown>) => ({
      patientId: rana.id,
      pregnancyId,
      recordedById: doctorId,
      visitedAt: new Date(daysAgo(daysBack).getTime() + 10 * 60 * 60 * 1000),
      ...v,
    })
    await prisma.visit.createMany({
      data: [
        visit(98, { weightKg: 68.4, systolic: 116, diastolic: 74, fetalHeartRate: 152, notes: 'Routine visit' }),
        visit(70, {
          weightKg: 70.1,
          systolic: 118,
          diastolic: 76,
          fundalHeightCm: 20,
          fetalHeartRate: 150,
          notes: 'Anomaly scan normal',
        }),
        visit(42, {
          weightKg: 72.0,
          systolic: 122,
          diastolic: 78,
          fundalHeightCm: 24,
          fetalHeartRate: 148,
          notes: 'Routine visit, no concerns',
        }),
        visit(14, {
          weightKg: 74.2,
          systolic: 128,
          diastolic: 82,
          fundalHeightCm: 28,
          fetalHeartRate: 142,
          notes: 'Glucose test normal, Hb low, iron started',
        }),
        visit(0, {
          systolic: 145,
          diastolic: 95,
          isPatientReport: true,
          recordedById: null,
          notes: 'Home reading from weekly form, with headache',
        }),
      ],
    })
    await prisma.prescription.create({
      data: {
        patientId: rana.id,
        prescribedById: doctorId,
        number: 'RX-SEED-0001',
        issuedAt: daysAgo(14),
        diagnosis: 'Iron deficiency anemia in pregnancy',
        items: {
          create: [
            {
              position: 0,
              drugName: 'Ferrous sulfate',
              dose: '200 mg',
              frequency: 'Once daily',
              duration: '30 days',
              instructions: 'Take with orange juice, not with tea or milk',
            },
            {
              position: 1,
              drugName: 'Low-dose aspirin',
              dose: '81 mg',
              frequency: 'Once daily at night',
              duration: 'Until 36 weeks',
            },
          ],
        },
      },
    })
    await prisma.payment.create({
      data: {
        patientId: rana.id,
        receivedById: staffIds.RECEPTION,
        amount: '600.00',
        method: 'INSTAPAY',
        purpose: 'Antenatal visit + ultrasound',
        paidAt: daysAgo(14),
      },
    })
    await prisma.clinicalNote.create({
      data: {
        patientId: rana.id,
        authorId: doctorId,
        pinned: true,
        body: 'Previous C-section in 2023. Discuss VBAC vs repeat C-section at the 34-week visit. Recheck Hb at 34 weeks.',
      },
    })
  }

  await prisma.auditLog.create({ data: { clinicId: clinic.id, action: SEED_DONE, entity: 'system' } })
  console.log(`Seeded clinic "${clinic.name}" with ${staff.length} staff and ${patients.length} patients.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
