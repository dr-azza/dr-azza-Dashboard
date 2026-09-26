/**
 * Integration tests against a real PostgreSQL database (migrated). Runs when TEST_DATABASE_URL is
 * set: locally `pnpm --filter @azza/api test:integration`, and in CI with a Postgres service.
 * Each run creates its own clinic, so runs never interfere with each other or with dev data.
 */
import { hash } from '@node-rs/argon2'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { PrismaPg } from '@prisma/adapter-pg'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app'
import { PrismaClient } from '../../src/generated/prisma/client'

const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('patient record (integration)', () => {
  let app: NestFastifyApplication
  let db: PrismaClient
  let storageDir: string
  let cookie = ''
  let otherClinicPatientId = ''
  const run = randomUUID().slice(0, 8)
  const password = `test-${randomUUID()}`
  const email = `doctor-${run}@azzah.test`

  const call = (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url: `/api/v1${url}`, payload, headers: cookie ? { cookie } : {} })

  beforeAll(async () => {
    process.env.DATABASE_URL = url
    storageDir = await mkdtemp(path.join(os.tmpdir(), 'azzah-files-'))
    process.env.STORAGE_DIR = storageDir

    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
    const clinic = await db.clinic.create({ data: { name: `Test ${run}`, slug: `test-${run}` } })
    await db.staffMember.create({
      data: { clinicId: clinic.id, email, fullName: 'Test Doctor', role: 'DOCTOR', passwordHash: await hash(password) },
    })
    const other = await db.clinic.create({ data: { name: `Other ${run}`, slug: `other-${run}` } })
    const otherCase = await db.caseType.create({ data: { clinicId: other.id, nameEn: 'Gynecology', nameAr: 'نساء' } })
    otherClinicPatientId = (
      await db.patient.create({
        data: {
          clinicId: other.id,
          fileNumber: 'P-0001',
          fullName: 'Other Clinic Patient',
          phone: '+201000000000',
          caseTypeId: otherCase.id,
        },
      })
    ).id

    app = await createApp()
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterAll(async () => {
    await app?.close()
    await db?.$disconnect()
    if (storageDir) await rm(storageDir, { recursive: true, force: true })
  })

  it('rejects requests without a session', async () => {
    expect((await call('GET', '/patients')).statusCode).toBe(401)
  })

  it('rejects a wrong password and accepts the right one with an httpOnly cookie', async () => {
    expect((await call('POST', '/auth/login', { email, password: 'nope' })).statusCode).toBe(401)
    const res = await call('POST', '/auth/login', { email, password })
    expect(res.statusCode).toBe(204)
    const setCookie = String(res.headers['set-cookie'])
    expect(setCookie).toMatch(/azzah_session=/)
    expect(setCookie).toMatch(/HttpOnly/i)
    cookie = setCookie.split(';')[0]
  })

  let patientId = ''
  let pregnancyCaseId = ''
  let customCaseId = ''

  it('gives every clinic the built-in cases and lets staff add their own', async () => {
    const list = await call('GET', '/case-types')
    expect(list.statusCode).toBe(200)
    const cases = list.json() as { id: string; systemKey: string | null; name: { en: string } }[]
    expect(cases.map((c) => c.systemKey)).toEqual(['PREGNANCY', 'GYNECOLOGY', 'POSTPARTUM', 'FERTILITY'])
    pregnancyCaseId = cases[0].id

    const added = await call('POST', '/case-types', { nameEn: 'Menopause', nameAr: 'سن اليأس' })
    expect(added.statusCode).toBe(201)
    expect(added.json()).toMatchObject({ name: { en: 'Menopause', ar: 'سن اليأس' }, systemKey: null })
    customCaseId = added.json().id

    expect((await call('POST', '/case-types', { nameEn: 'Menopause', nameAr: 'x' })).statusCode).toBe(409)
    expect((await call('PATCH', `/case-types/${pregnancyCaseId}`, { archived: true })).statusCode).toBe(400)
  })

  it('creates patients with an automatic, sequential file number, and requires consent', async () => {
    const noConsent = await call('POST', '/patients', {
      fullName: 'Sara Test',
      phone: '+20 100 000 1111',
      caseTypeId: pregnancyCaseId,
      consentGiven: false,
    })
    expect(noConsent.statusCode).toBe(400)

    const res = await call('POST', '/patients', {
      fullName: 'Sara Test',
      fullNameAr: 'سارة',
      phone: '+20 100 000 1111',
      dateOfBirth: '1994-05-01',
      caseTypeId: pregnancyCaseId,
      consentGiven: true,
      fileNumber: 'HACK-1', // ignored: file numbers can't be chosen by the client
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.fileNumber).toBe('P-0001')
    expect(body.phone).toBe('+201000001111')
    expect(body.caseType).toMatchObject({ id: pregnancyCaseId, systemKey: 'PREGNANCY' })
    patientId = body.id

    const second = await call('POST', '/patients', {
      fullName: 'Mona Test',
      phone: '+201000002222',
      caseTypeId: customCaseId,
      consentGiven: true,
    })
    expect(second.json().fileNumber).toBe('P-0002')
  })

  it('filters the patient list by any case, including custom ones', async () => {
    const custom = (await call('GET', `/patients?caseTypeId=${customCaseId}`)).json()
    expect(custom.items.map((p: { fullName: string }) => p.fullName)).toEqual(['Mona Test'])
    const counts = (await call('GET', '/case-types')).json() as { id: string; patientCount: number }[]
    expect(counts.find((c) => c.id === customCaseId)?.patientCount).toBe(1)
  })

  it('refuses a case that belongs to another clinic', async () => {
    const otherCase = await db.caseType.findFirstOrThrow({
      where: { patients: { some: { id: otherClinicPatientId } } },
    })
    const res = await call('POST', '/patients', {
      fullName: 'Wrong Clinic',
      phone: '+201000003333',
      caseTypeId: otherCase.id,
      consentGiven: true,
    })
    expect(res.statusCode).toBe(400)
  })

  it('never exposes another clinic’s patient', async () => {
    expect((await call('GET', `/patients/${otherClinicPatientId}`)).statusCode).toBe(404)
    expect((await call('GET', `/patients/${otherClinicPatientId}/visits`)).statusCode).toBe(404)
  })

  it('records history, a pregnancy and visits with gestational age and BP flags', async () => {
    const history = await call('PUT', `/patients/${patientId}/medical-history`, {
      allergies: [{ substance: 'Penicillin', severity: 'severe' }],
      bloodGroup: 'A+',
      cycleLengthDays: 30,
    })
    expect(history.statusCode).toBe(200)
    expect(history.json().allergies[0]).toMatchObject({ substance: 'Penicillin', severity: 'severe', reaction: null })

    await call('POST', `/patients/${patientId}/obstetric-history`, {
      year: 2021,
      outcome: 'LIVE_BIRTH',
      deliveryMode: 'CESAREAN',
    })

    const lmp = new Date(Date.now() - 100 * 86_400_000).toISOString().slice(0, 10)
    const pregnancy = await call('POST', `/patients/${patientId}/pregnancies`, { lmp })
    expect(pregnancy.statusCode).toBe(201)
    expect(pregnancy.json().weeks).toBeGreaterThanOrEqual(14)
    expect((await call('POST', `/patients/${patientId}/pregnancies`, { lmp })).statusCode).toBe(409)

    const visit = await call('POST', `/patients/${patientId}/visits`, {
      visitedAt: new Date().toISOString(),
      systolic: 150,
      diastolic: 92,
      weightKg: 70.4,
    })
    expect(visit.statusCode).toBe(201)
    expect(visit.json()).toMatchObject({ highBloodPressure: true, weightKg: '70.4', pregnancyId: pregnancy.json().id })
    expect(visit.json().gestation.weeks).toBeGreaterThanOrEqual(14)

    const oneSidedBp = await call('POST', `/patients/${patientId}/visits`, {
      visitedAt: new Date().toISOString(),
      systolic: 120,
    })
    expect(oneSidedBp.statusCode).toBe(400)

    const record = (await call('GET', `/patients/${patientId}`)).json()
    expect(record).toMatchObject({ gravida: 2, para: 1, bloodGroup: 'A+' })
    expect(record.activePregnancy).not.toBeNull()
  })

  it('issues and voids prescriptions without editing them', async () => {
    const rx = await call('POST', `/patients/${patientId}/prescriptions`, {
      diagnosis: 'Anemia',
      items: [
        { drugName: 'Ferrous sulfate', dose: '200 mg', frequency: 'Once daily' },
        { drugName: 'Folic acid', dose: '5 mg' },
      ],
    })
    expect(rx.statusCode).toBe(201)
    expect(rx.json().number).toMatch(/^RX-\d{6}-[0-9A-Z]{4}$/)
    expect(rx.json().items.map((i: { drugName: string }) => i.drugName)).toEqual(['Ferrous sulfate', 'Folic acid'])

    const voided = await call('POST', `/patients/${patientId}/prescriptions/${rx.json().id}/void`, {
      reason: 'Wrong dose',
    })
    expect(voided.json().voidedAt).not.toBeNull()
  })

  it('records payments in exact decimals, attaches a proof and excludes voided payments', async () => {
    const paidAt = new Date().toISOString()
    const a = (
      await call('POST', `/patients/${patientId}/payments`, { amount: 0.1, method: 'CASH', purpose: 'Test', paidAt })
    ).json()
    await call('POST', `/patients/${patientId}/payments`, { amount: 0.2, method: 'INSTAPAY', purpose: 'Test', paidAt })
    const voidMe = (
      await call('POST', `/patients/${patientId}/payments`, { amount: 999, method: 'CARD', purpose: 'Mistake', paidAt })
    ).json()
    await call('POST', `/patients/${patientId}/payments/${voidMe.id}/void`, { reason: 'Entered twice' })

    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
    const boundary = '----azzah' + run
    const multipart = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\nPAYMENT_PROOF\r\n` +
          `--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\nReceipt\r\n` +
          `--${boundary}\r\nContent-Disposition: form-data; name="paymentId"\r\n\r\n${a.id}\r\n` +
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="receipt.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
      ),
      pdf,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ])
    const upload = await app.inject({
      method: 'POST',
      url: `/api/v1/patients/${patientId}/attachments`,
      headers: { cookie, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: multipart,
    })
    expect(upload.statusCode).toBe(201)
    expect(upload.json()).toMatchObject({ kind: 'PAYMENT_PROOF', mimeType: 'application/pdf', paymentId: a.id })

    const payments = (await call('GET', `/patients/${patientId}/payments`)).json()
    expect(payments.totalPaid).toBe('0.30') // not 0.30000000000000004, and the voided 999 is excluded
    expect(payments.items.find((p: { id: string }) => p.id === a.id).proofs).toHaveLength(1)

    const file = await call('GET', `/patients/${patientId}/attachments/${upload.json().id}/file`)
    expect(file.headers['cache-control']).toBe('private, no-store')
    expect(file.rawPayload.equals(pdf)).toBe(true)
  })

  it('writes an audit entry for reads and changes', async () => {
    const actions = await db.auditLog.findMany({
      where: { meta: { path: ['patientId'], equals: patientId } },
      select: { action: true },
    })
    const names = new Set(actions.map((a) => a.action))
    for (const expected of [
      'patient.view',
      'visit.create',
      'prescription.create',
      'payment.create',
      'file.upload',
      'file.download',
    ]) {
      expect(names).toContain(expected)
    }
  })

  it('invalidates the session on logout', async () => {
    expect((await call('POST', '/auth/logout')).statusCode).toBe(204)
    expect((await call('GET', '/auth/me')).statusCode).toBe(401)
  })
})
