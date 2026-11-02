/**
 * Clinic finances end to end: owner-only access, categories, income and expenses, voiding,
 * receipts, recurring expenses, the daily and monthly summary (with patient payments and the
 * clinic's time zone), the ledger and the CSV export. Own clinic per run.
 */
import { addMonths, monthBounds } from '@azza/shared'
import { hash } from '@node-rs/argon2'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { PrismaPg } from '@prisma/adapter-pg'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app'
import { PrismaClient } from '../../src/generated/prisma/client'
import { clinicToday } from '../../src/patients/patient-scope.service'

const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('finance (integration)', () => {
  let app: NestFastifyApplication
  let db: PrismaClient
  let owner = ''
  let doctor = ''
  let outsider = ''
  let clinicId = ''
  const run = randomUUID().slice(0, 8)
  const password = `pw-${randomUUID()}`
  const today = clinicToday('Africa/Cairo')
  const month = today.slice(0, 7)

  const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, payload?: object, cookie = owner) =>
    app.inject({ method, url: `/api/v1${path}`, payload, headers: cookie ? { cookie } : {} })
  const login = async (email: string) => {
    const res = await call('POST', '/auth/login', { email, password }, '')
    return String(res.headers['set-cookie']).split(';')[0]
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
    const passwordHash = await hash(password)
    clinicId = (await db.clinic.create({ data: { name: `Fin ${run}`, slug: `fin-${run}` } })).id
    const other = await db.clinic.create({ data: { name: `Fin other ${run}`, slug: `fin-other-${run}` } })
    const staff = (cid: string, name: string, role: 'OWNER' | 'DOCTOR') =>
      db.staffMember.create({
        data: { clinicId: cid, email: `${name}-${run}@azzah.test`, fullName: name, role, passwordHash },
      })
    await staff(clinicId, 'owner', 'OWNER')
    await staff(clinicId, 'doctor', 'DOCTOR')
    await staff(other.id, 'outsider', 'OWNER')
    app = await createApp()
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
    owner = await login(`owner-${run}@azzah.test`)
    doctor = await login(`doctor-${run}@azzah.test`)
    outsider = await login(`outsider-${run}@azzah.test`)
  })

  afterAll(async () => {
    await app?.close()
    await db?.$disconnect()
  })

  it('is for owners only', async () => {
    const range = `from=${today}&to=${today}`
    expect((await call('GET', `/finance/summary?${range}`, undefined, '')).statusCode).toBe(401)
    for (const path of [
      `/finance/summary?${range}`,
      `/finance/transactions?${range}`,
      '/finance/categories',
      '/finance/recurring',
    ]) {
      expect((await call('GET', path, undefined, doctor)).statusCode).toBe(403)
    }
    expect((await call('POST', '/finance/entries', {}, doctor)).statusCode).toBe(403)
  })

  const cat: Record<string, string> = {}

  it('starts every clinic with editable categories', async () => {
    const list = (await call('GET', '/finance/categories')).json()
    expect(list.filter((c: { kind: string }) => c.kind === 'EXPENSE').length).toBe(7)
    expect(list.filter((c: { kind: string }) => c.kind === 'INCOME').length).toBe(2)
    for (const c of list) cat[c.systemKey] = c.id
    // Asking again doesn't duplicate them.
    expect((await call('GET', '/finance/categories')).json()).toHaveLength(9)

    const lab = await call('POST', '/finance/categories', { kind: 'EXPENSE', nameEn: 'Lab fees', nameAr: 'رسوم معامل' })
    expect(lab.statusCode).toBe(201)
    cat.LAB = lab.json().id
    const renamed = await call('PATCH', `/finance/categories/${cat.RENT}`, { nameEn: 'Clinic rent' })
    expect(renamed.json().name).toEqual({ en: 'Clinic rent', ar: 'الإيجار' })
    await call('PATCH', `/finance/categories/${cat.LAB}`, { archived: true })
    expect((await call('GET', '/finance/categories')).json()).toHaveLength(9)
    expect((await call('GET', '/finance/categories?includeArchived=true')).json()).toHaveLength(10)
  })

  const entry = (body: object, cookie = owner) =>
    call('POST', '/finance/entries', { method: 'CASH', occurredOn: today, description: 'x', ...body }, cookie)

  it('records income and expenses with exact amounts, and refuses bad ones', async () => {
    const rent = await entry({
      categoryId: cat.RENT,
      amount: 12000,
      description: 'November rent',
      counterparty: 'Landlord',
    })
    expect(rent.statusCode).toBe(201)
    expect(rent.json()).toMatchObject({ kind: 'EXPENSE', amount: '12000.00', counterparty: 'Landlord' })
    const commission = await entry({ categoryId: cat.LAB_COMMISSION, amount: 450.5, method: 'INSTAPAY' })
    expect(commission.json()).toMatchObject({ kind: 'INCOME', amount: '450.50' })

    expect((await entry({ categoryId: cat.RENT, amount: -5 })).statusCode).toBe(400)
    expect((await entry({ categoryId: cat.RENT, amount: 1.005 })).statusCode).toBe(400)
    expect((await entry({ categoryId: cat.RENT, amount: 5, occurredOn: '2026-02-30' })).statusCode).toBe(400)
    expect((await entry({ categoryId: cat.LAB, amount: 5 })).statusCode).toBe(400) // archived
    // Another clinic's category is invisible.
    const foreign = (await call('GET', '/finance/categories', undefined, outsider)).json()[0].id
    expect((await entry({ categoryId: foreign, amount: 5 })).statusCode).toBe(404)
    expect((await call('GET', `/finance/entries/${rent.json().id}`, undefined, outsider)).statusCode).toBe(404)
  })

  it('voids once, with a reason, and keeps voided entries out of the totals', async () => {
    const wrong = (await entry({ categoryId: cat.SUPPLIES, amount: 999 })).json()
    const voided = await call('POST', `/finance/entries/${wrong.id}/void`, { reason: 'Typed twice' })
    expect(voided.statusCode).toBe(200)
    expect(voided.json()).toMatchObject({ voidReason: 'Typed twice' })
    expect((await call('POST', `/finance/entries/${wrong.id}/void`, { reason: 'again' })).statusCode).toBe(409)
    expect((await call('PATCH', `/finance/entries/${wrong.id}`, { amount: 1 })).statusCode).toBe(409)
    const summary = (await call('GET', `/finance/summary?from=${today}&to=${today}`)).json()
    expect(summary.totals.expenses).toBe('12000.00')
  })

  it('counts patient payments as revenue on the clinic-local day', async () => {
    const caseTypeId = (await db.caseType.create({ data: { clinicId, nameEn: 'Gyn', nameAr: 'نساء' } })).id
    const patient = (
      await call('POST', '/patients', {
        fullName: 'Paying Patient',
        phone: '+201011112222',
        caseTypeId,
        consentGiven: true,
      })
    ).json()
    // 22:30 UTC on 14 March is 00:30 on the 15th in Cairo (UTC+2 then). A fixed past day, so it
    // never overlaps today's entries from the other tests.
    const pay = (paidAt: string, amount: number) =>
      call('POST', `/patients/${patient.id}/payments`, { amount, method: 'CARD', purpose: 'Visit', paidAt })
    expect((await pay('2026-03-14T22:30:00.000Z', 700)).statusCode).toBe(201)
    await pay('2026-03-14T21:30:00.000Z', 300)
    const voided = (await pay('2026-03-14T12:00:00.000Z', 5000)).json()
    await call('POST', `/patients/${patient.id}/payments/${voided.id}/void`, { reason: 'Wrong patient' })

    const s = (await call('GET', '/finance/summary?from=2026-03-14&to=2026-03-15')).json()
    expect(s.series).toEqual([
      { period: '2026-03-14', revenue: '300.00', expenses: '0.00', net: '300.00' },
      { period: '2026-03-15', revenue: '700.00', expenses: '0.00', net: '700.00' },
    ])
    expect(s.totals.patientPayments).toBe('1000.00')
    expect(s.revenueByMethod).toEqual([{ method: 'CARD', total: '1000.00' }])

    const ledger = (await call('GET', '/finance/transactions?from=2026-03-14&to=2026-03-15')).json()
    expect(
      ledger.items.map((t: { date: string; amount: string; voided: boolean }) => [t.date, t.amount, t.voided]),
    ).toEqual([
      ['2026-03-15', '700.00', false],
      ['2026-03-14', '300.00', false],
      ['2026-03-14', '5000.00', true],
    ])
    expect(ledger.items[0].patient).toMatchObject({ fullName: 'Paying Patient' })
  })

  it('summarises a month by day and a year by month, with breakdowns', async () => {
    const { from, to } = monthBounds(month)
    const s = (await call('GET', `/finance/summary?from=${from}&to=${to}`)).json()
    expect(s.series.length).toBe(Number(to.slice(8)))
    expect(s.series.find((p: { period: string }) => p.period === today)).toMatchObject({
      revenue: '450.50',
      expenses: '12000.00',
      net: '-11549.50',
    })
    expect(s.todayTotals).toMatchObject({ otherIncome: '450.50', expenses: '12000.00', net: '-11549.50' })
    expect(s.expensesByCategory).toEqual([
      { category: { id: cat.RENT, name: { en: 'Clinic rent', ar: 'الإيجار' } }, total: '12000.00' },
    ])
    expect(s.revenueBySource[0].category).toBeNull()
    expect(s.revenueBySource[1]).toMatchObject({ category: { id: cat.LAB_COMMISSION }, total: '450.50' })

    const year = (await call('GET', `/finance/summary?from=${addMonths(month, -11)}-01&to=${to}&groupBy=month`)).json()
    expect(year.series).toHaveLength(12)
    expect(year.series.at(-1).period).toBe(month)

    expect((await call('GET', `/finance/summary?from=${to}&to=${from}`)).statusCode).toBe(400)
    expect((await call('GET', '/finance/summary?from=2024-01-01&to=2026-01-01')).statusCode).toBe(400)
  })

  it('keeps receipts with entries, images and PDFs only', async () => {
    const rent = (await call('GET', `/finance/transactions?from=${today}&to=${today}&type=expense`)).json().items[0]
    const boundary = '----fin' + run
    const send = (bytes: Buffer, name: string) =>
      app.inject({
        method: 'POST',
        url: `/api/v1/finance/entries/${rent.id}/receipts`,
        headers: { cookie: owner, 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: Buffer.concat([
          Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
          ),
          bytes,
          Buffer.from(`\r\n--${boundary}--\r\n`),
        ]),
      })
    const pdf = Buffer.from('%PDF-1.4\n% receipt\n')
    const ok = await send(pdf, 'rent.pdf')
    expect(ok.statusCode).toBe(201)
    expect(ok.json()).toMatchObject({ fileName: 'rent.pdf', mimeType: 'application/pdf' })
    expect((await send(Buffer.from('hello'), 'note.txt')).statusCode).toBe(400)

    const file = await call('GET', `/finance/receipts/${ok.json().id}/file`)
    expect(file.rawPayload.equals(pdf)).toBe(true)
    expect(file.headers['cache-control']).toBe('private, no-store')
    expect((await call('GET', `/finance/receipts/${ok.json().id}/file`, undefined, outsider)).statusCode).toBe(404)
    expect((await call('GET', `/finance/entries/${rent.id}`)).json().receipts).toHaveLength(1)
    expect((await call('DELETE', `/finance/receipts/${ok.json().id}`)).statusCode).toBe(204)
    expect((await call('GET', `/finance/entries/${rent.id}`)).json().receipts).toHaveLength(0)
  })

  it('adds recurring expenses every month, once, and skips paused months', async () => {
    const start = `${addMonths(month, -2)}-01`
    const res = await call('POST', '/finance/recurring', {
      categoryId: cat.SALARIES,
      amount: 8000,
      method: 'BANK_TRANSFER',
      description: 'Nurse salary',
      dayOfMonth: 1,
      startsOn: start,
    })
    expect(res.statusCode).toBe(201)
    const rec = res.json()
    const added = () => db.financeEntry.count({ where: { recurringId: rec.id } })
    expect(await added()).toBe(3) // two past months and this one (the 1st has passed)
    await call('GET', '/finance/recurring')
    await call('GET', `/finance/summary?from=${today}&to=${today}`)
    expect(await added()).toBe(3) // reading again never duplicates
    expect(rec.nextOn).toBe(`${addMonths(month, 1)}-01`)

    // Income categories can't recur; too far back is refused.
    expect(
      (
        await call('POST', '/finance/recurring', {
          ...{
            categoryId: cat.OTHER_INCOME,
            amount: 1,
            method: 'CASH',
            description: 'x',
            dayOfMonth: 1,
            startsOn: today,
          },
        })
      ).statusCode,
    ).toBe(400)
    expect(
      (
        await call('POST', '/finance/recurring', {
          categoryId: cat.RENT,
          amount: 1,
          method: 'CASH',
          description: 'x',
          dayOfMonth: 1,
          startsOn: '2020-01-01',
        })
      ).statusCode,
    ).toBe(400)
    expect(
      (
        await call('POST', '/finance/recurring', {
          categoryId: cat.RENT,
          amount: 1,
          method: 'CASH',
          description: 'x',
          dayOfMonth: 31,
          startsOn: today,
        })
      ).statusCode,
    ).toBe(400)

    const paused = await call('PATCH', `/finance/recurring/${rec.id}`, { paused: true })
    expect(paused.json()).toMatchObject({ paused: true, nextOn: null })
    // Pretend it was paused for months: resuming continues from today, nothing is back-filled.
    await db.recurringExpense.update({
      where: { id: rec.id },
      data: { materializedThrough: new Date(`${addMonths(month, -6)}-01T00:00:00Z`) },
    })
    const resumed = await call('PATCH', `/finance/recurring/${rec.id}`, { paused: false })
    expect(resumed.json()).toMatchObject({ paused: false, startsOn: start })
    expect(await added()).toBe(3)

    // A category with a running recurring expense can't be archived.
    const archive = await call('PATCH', `/finance/categories/${cat.SALARIES}`, { archived: true })
    expect(archive.statusCode).toBe(409)
    expect(archive.json().code).toBe('CATEGORY_HAS_RECURRING')
  })

  it('restarting an ended recurring expense does not add the months it was off', async () => {
    const ended = (
      await call('POST', '/finance/recurring', {
        categoryId: cat.UTILITIES,
        amount: 300,
        method: 'CASH',
        description: 'Water',
        dayOfMonth: 1,
        startsOn: `${addMonths(month, -5)}-01`,
        endsOn: `${addMonths(month, -4)}-01`,
      })
    ).json()
    const count = () => db.financeEntry.count({ where: { recurringId: ended.id } })
    expect(await count()).toBe(2) // the two months before it ended
    await call('PATCH', `/finance/recurring/${ended.id}`, { endsOn: null })
    await call('GET', '/finance/recurring')
    expect(await count()).toBe(2)
  })

  it('accepts every two-decimal amount, including ones floats cannot hold exactly', async () => {
    for (const amount of [1.1, 0.29, 1.15, 0.57, 19.99]) {
      expect((await entry({ categoryId: cat.MARKETING, amount })).json().amount).toBe(amount.toFixed(2))
    }
  })

  it('logs receipt uploads under the receipt, not the entry', async () => {
    const e = (await entry({ categoryId: cat.MARKETING, amount: 10 })).json()
    const boundary = '----audit' + run
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/finance/entries/${e.id}/receipts`,
      headers: { cookie: owner, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="r.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
        ),
        Buffer.from('%PDF-1.4\n'),
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]),
    })
    expect(res.statusCode).toBe(201)
    const log = await db.auditLog.findFirst({ where: { action: 'finance.receipt.upload' }, orderBy: { id: 'desc' } })
    expect(log?.entityId).toBe(res.json().id)
  })

  it('exports the ledger as Excel-friendly CSV, safe from formulas', async () => {
    await entry({ categoryId: cat.MARKETING, amount: 50, description: '=HYPERLINK("http://evil")' })
    const res = await call('GET', `/finance/export?from=${today}&to=${today}&lang=ar`)
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toContain(`azzah-finance-${today}-to-${today}.csv`)
    const text = res.body
    expect(text.charCodeAt(0)).toBe(0xfeff)
    expect(text).toContain('"التاريخ"')
    expect(text).toContain(`"'=HYPERLINK(""http://evil"")"`)
    expect(text).toContain('"إجمالي المصروفات"')
    expect((await call('GET', `/finance/export?from=${today}&to=${today}`, undefined, doctor)).statusCode).toBe(403)
  })
})
