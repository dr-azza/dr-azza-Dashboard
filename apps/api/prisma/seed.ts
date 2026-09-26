/**
 * Development seed: one clinic, its staff and a few sample patients. All data is fictional.
 * Run with `pnpm --filter @azza/api db:seed`. Safe to re-run: records are upserted by natural keys.
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set (copy apps/api/.env.example to .env)')
if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed a production database')

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

const daysAgo = (n: number) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d
}

async function main() {
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
  for (const s of staff) {
    await prisma.staffMember.upsert({
      where: { clinicId_email: { clinicId: clinic.id, email: s.email } },
      update: {},
      create: { ...s, clinicId: clinic.id },
    })
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

  for (const { pregnancy, ...data } of patients) {
    const patient = await prisma.patient.upsert({
      where: { clinicId_fileNumber: { clinicId: clinic.id, fileNumber: data.fileNumber } },
      update: {},
      create: { ...data, clinicId: clinic.id, consentAt: new Date() },
    })
    if (pregnancy && (await prisma.pregnancy.count({ where: { patientId: patient.id } })) === 0) {
      const { gaDays, ...details } = pregnancy
      await prisma.pregnancy.create({ data: { ...details, patientId: patient.id, lmp: daysAgo(gaDays) } })
    }
  }

  console.log(`Seeded clinic "${clinic.name}" with ${staff.length} staff and ${patients.length} patients.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
