/**
 * Forms end to end: build, version, share, fill (shared and personal links), match, review.
 * Runs against a real database like the patient-record suite, in its own clinic.
 */
import { hash } from '@node-rs/argon2'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { PrismaPg } from '@prisma/adapter-pg'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app'
import { PrismaClient } from '../../src/generated/prisma/client'

const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('forms (integration)', () => {
  let app: NestFastifyApplication
  let db: PrismaClient
  let cookie = ''
  let patientId = ''
  let otherClinicFormToken = ''
  const run = randomUUID().slice(0, 8)
  const password = `test-${randomUUID()}`
  const email = `forms-${run}@azzah.test`
  // Unique per run so phone matching never hits another run's patients.
  const phone = `+2010${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`

  const call = (method: 'GET' | 'POST' | 'PATCH', path: string, payload?: object, withCookie = true) =>
    app.inject({ method, url: `/api/v1${path}`, payload, headers: withCookie && cookie ? { cookie } : {} })

  beforeAll(async () => {
    process.env.DATABASE_URL = url
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
    const clinic = await db.clinic.create({ data: { name: `Forms ${run}`, slug: `forms-${run}` } })
    await db.staffMember.create({
      data: { clinicId: clinic.id, email, fullName: 'Form Doctor', role: 'DOCTOR', passwordHash: await hash(password) },
    })
    const caseType = await db.caseType.create({ data: { clinicId: clinic.id, nameEn: 'Gynecology', nameAr: 'نساء' } })
    patientId = (
      await db.patient.create({
        data: {
          clinicId: clinic.id,
          fileNumber: 'P-1001',
          fullName: 'Salma Adel',
          fullNameAr: 'سلمى عادل',
          phone,
          caseTypeId: caseType.id,
        },
      })
    ).id
    const other = await db.clinic.create({ data: { name: `Other ${run}`, slug: `forms-other-${run}` } })
    otherClinicFormToken = (
      await db.form.create({
        data: {
          clinicId: other.id,
          title: 'Other',
          language: 'en',
          fields: [],
          publicToken: `other${run}xxxxxxxxxxxx`,
          versions: { create: { version: 1, title: 'Other', language: 'en', fields: [] } },
        },
      })
    ).publicToken

    app = await createApp()
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
    const login = await call('POST', '/auth/login', { email, password })
    cookie = String(login.headers['set-cookie']).split(';')[0]
  })

  afterAll(async () => {
    await app?.close()
    await db?.$disconnect()
  })

  const fields = [
    { id: 'preg1', type: 'yes_no', label: 'هل أنتِ حامل؟', required: true },
    {
      id: 'week1',
      type: 'number',
      label: 'في أي أسبوع؟',
      required: true,
      min: 1,
      max: 42,
      condition: { match: 'all', rules: [{ fieldId: 'preg1', op: 'equals', value: 'yes' }] },
    },
    { id: 'note1', type: 'long_text', label: 'ملاحظات' },
  ]
  let formId = ''
  let token = ''
  let v1 = ''

  it('builds a form and refuses questions whose logic points forward', async () => {
    const bad = await call('POST', '/forms', {
      title: 'x',
      language: 'ar',
      fields: [
        { ...fields[1], condition: { match: 'all', rules: [{ fieldId: 'preg1', op: 'equals', value: 'yes' }] } },
        fields[0],
      ],
    })
    expect(bad.statusCode).toBe(400)

    const created = await call('POST', '/forms', { title: 'استبيان الحمل', language: 'ar', fields })
    expect(created.statusCode).toBe(201)
    formId = created.json().id
    token = created.json().publicToken
    expect(created.json().version).toBe(1)

    // Saving the same content does not make a new version; changing it does.
    expect((await call('PATCH', `/forms/${formId}`, { fields })).json().version).toBe(1)
    const listed = (await call('GET', '/forms')).json()
    expect(listed.find((f: { id: string }) => f.id === formId).questionCount).toBe(3)
  })

  it('serves the shared link without login and validates answers with the same rules', async () => {
    const page = await call('GET', `/public/forms/${token}`, undefined, false)
    expect(page.statusCode).toBe(200)
    expect(page.json()).toMatchObject({ mode: 'shared', state: 'open', language: 'ar', greetingName: null })
    v1 = page.json().versionId

    // Visible required question left empty.
    const missing = await call(
      'POST',
      `/public/forms/${token}/responses`,
      { versionId: v1, answers: { preg1: 'yes' }, respondent: { name: 'Salma', phone: '01000000000' } },
      false,
    )
    expect(missing.statusCode).toBe(400)
    expect(missing.json().fieldErrors).toEqual({ week1: 'required' })

    // Shared link needs name and phone.
    const anonymous = await call(
      'POST',
      `/public/forms/${token}/responses`,
      { versionId: v1, answers: { preg1: 'no' } },
      false,
    )
    expect(anonymous.statusCode).toBe(400)
  })

  it('matches a shared-link response to the one patient with that phone, and drops hidden answers', async () => {
    const local = `0${phone.slice(3)}` // how patients type it: 010…
    const ok = await call(
      'POST',
      `/public/forms/${token}/responses`,
      {
        versionId: v1,
        answers: { preg1: 'no', week1: 12, note1: ' ok ' },
        respondent: { name: 'Salma', phone: local },
      },
      false,
    )
    expect(ok.statusCode).toBe(201)

    const list = (await call('GET', `/form-responses?formId=${formId}`)).json()
    expect(list.items).toHaveLength(1)
    expect(list.items[0]).toMatchObject({ matchedBy: 'PHONE', respondentPhone: phone, patient: { id: patientId } })
    const detail = (await call('GET', `/form-responses/${list.items[0].id}`)).json()
    expect(detail.answers).toEqual({ preg1: 'no', note1: 'ok' })
    expect(detail.fields).toHaveLength(3)

    // An unknown phone stays unmatched until staff link it.
    await call(
      'POST',
      `/public/forms/${token}/responses`,
      { versionId: v1, answers: { preg1: 'no' }, respondent: { name: 'Someone', phone: '+442079460958' } },
      false,
    )
    const unmatched = (await call('GET', `/form-responses?formId=${formId}&status=new`)).json().items[0]
    expect(unmatched.patient).toBeNull()
    const linked = await call('PATCH', `/form-responses/${unmatched.id}`, { patientId, reviewed: true })
    expect(linked.json()).toMatchObject({ matchedBy: 'STAFF', patient: { id: patientId } })
    expect(linked.json().reviewedAt).not.toBeNull()
    expect((await call('GET', '/form-responses/summary')).json().newCount).toBe(1)
  })

  it('keeps answers tied to the version the patient saw', async () => {
    const edited = await call('PATCH', `/forms/${formId}`, {
      fields: [...fields, { id: 'new1', type: 'short_text', label: 'سؤال جديد', required: true }],
    })
    expect(edited.json().version).toBe(2)
    // A patient who loaded version 1 can still submit against it.
    const late = await call(
      'POST',
      `/public/forms/${token}/responses`,
      { versionId: v1, answers: { preg1: 'no' }, respondent: { name: 'Late', phone: '+442079460959' } },
      false,
    )
    expect(late.statusCode).toBe(201)
    const newest = (await call('GET', `/form-responses?formId=${formId}`)).json().items[0]
    expect(newest.version).toBe(1)
  })

  it('lists responses across forms with filters that agree with the summary counts', async () => {
    const all = (await call('GET', '/form-responses')).json().items as { patient: unknown; form: { id: string } }[]
    const unlinked = (await call('GET', '/form-responses?linked=false')).json().items as { patient: unknown }[]
    const linked = (await call('GET', '/form-responses?linked=true')).json().items as { patient: unknown }[]
    expect(unlinked.length).toBeGreaterThan(0)
    expect(linked.length).toBeGreaterThan(0)
    expect(unlinked.every((r) => r.patient === null)).toBe(true)
    expect(linked.every((r) => r.patient !== null)).toBe(true)
    expect(unlinked.length + linked.length).toBe(all.length)

    const lastWeek = (await call('GET', '/form-responses?days=7')).json().items
    const summary = (await call('GET', '/form-responses/summary')).json()
    expect(summary.unlinkedCount).toBe(unlinked.length)
    expect(summary.lastWeekCount).toBe(lastWeek.length)
    expect(summary.newCount).toBe((await call('GET', '/form-responses?status=new')).json().items.length)

    // Archiving a form takes its responses out of both the counts and the clinic-wide lists,
    // but they stay reachable on the form itself.
    const extra = (await call('POST', '/forms', { title: 'Archived later', language: 'en', fields: [] })).json()
    const page = (await call('GET', `/public/forms/${extra.publicToken}`, undefined, false)).json()
    await call(
      'POST',
      `/public/forms/${extra.publicToken}/responses`,
      { versionId: page.versionId, answers: {}, respondent: { name: 'A', phone: '+442079460999' } },
      false,
    )
    expect((await call('GET', '/form-responses/summary')).json().unlinkedCount).toBe(summary.unlinkedCount + 1)
    await call('PATCH', `/forms/${extra.id}`, { archived: true })
    expect((await call('GET', '/form-responses/summary')).json().unlinkedCount).toBe(summary.unlinkedCount)
    expect((await call('GET', '/form-responses?linked=false')).json().items).toHaveLength(unlinked.length)
    expect((await call('GET', `/form-responses?formId=${extra.id}`)).json().items).toHaveLength(1)
    expect((await call('GET', `/forms/${formId}/responses`)).statusCode).toBe(404)
  })

  it('sends a personal link that greets the patient, fills her record, and works once', async () => {
    const created = await call('POST', `/patients/${patientId}/form-links`, { formId })
    expect(created.statusCode).toBe(201)
    const personal = created.json().token as string
    expect(created.json().status).toBe('waiting')

    const page = (await call('GET', `/public/forms/${personal}`, undefined, false)).json()
    expect(page).toMatchObject({ mode: 'personal', state: 'open', greetingName: 'سلمى' })

    const submit = () =>
      call(
        'POST',
        `/public/forms/${personal}/responses`,
        { versionId: page.versionId, answers: { preg1: 'yes', week1: 20, new1: 'x' } },
        false,
      )
    expect((await submit()).statusCode).toBe(201)
    expect((await submit()).statusCode).toBe(409)
    expect((await call('GET', `/public/forms/${personal}`, undefined, false)).json().state).toBe('submitted')

    const mine = (await call('GET', `/patients/${patientId}/forms`)).json()
    expect(mine.links[0].status).toBe('submitted')
    expect(mine.responses.some((r: { matchedBy: string }) => r.matchedBy === 'LINK')).toBe(true)
    // A personal-link response cannot be moved to another patient.
    expect((await call('PATCH', `/form-responses/${mine.links[0].responseId}`, { patientId: null })).statusCode).toBe(
      400,
    )

    // The patient's activity log shows the submission, and the timeline shows the form.
    const activity = (await call('GET', `/patients/${patientId}/activity`)).json()
    expect(activity.items.map((i: { action: string }) => i.action)).toContain('form.submit')
    const timeline = (await call('GET', `/patients/${patientId}/timeline`)).json()
    expect(timeline.some((e: { type: string }) => e.type === 'form')).toBe(true)
  })

  it('keeps the questions when only the settings change, and refuses stale saves', async () => {
    const before = (await call('GET', `/forms/${formId}`)).json()
    const closed = (await call('PATCH', `/forms/${formId}`, { acceptingResponses: false })).json()
    const archived = (await call('PATCH', `/forms/${formId}`, { archived: true })).json()
    const restored = (await call('PATCH', `/forms/${formId}`, { archived: false, acceptingResponses: true })).json()
    for (const f of [closed, archived, restored]) {
      expect(f.fields).toEqual(before.fields)
      expect(f.version).toBe(before.version)
    }
    expect((await call('GET', '/forms')).json().find((f: { id: string }) => f.id === formId).questionCount).toBe(4)

    // Someone saved in between: an editor still on the old version gets a conflict, not an overwrite.
    const stale = await call('PATCH', `/forms/${formId}`, { title: 'Stale', expectedVersion: before.version - 1 })
    expect(stale.statusCode).toBe(409)
    expect((await call('GET', `/forms/${formId}`)).json().title).not.toBe('Stale')
  })

  it('answers bad input with 400, never 500', async () => {
    const page = (await call('GET', `/public/forms/${token}`, undefined, false)).json()
    const typed = await call(
      'POST',
      `/public/forms/${token}/responses`,
      { versionId: page.versionId, answers: { preg1: true }, respondent: { name: 'X', phone: '01011112222' } },
      false,
    )
    expect(typed.statusCode).toBe(400)
    expect((await call('GET', `/form-responses?formId=${formId}&cursor=not-a-uuid`)).statusCode).toBe(400)
  })

  it('sends one patient as many forms as needed, the same one included, all usable at once', async () => {
    const second = (
      await call('POST', '/forms', {
        title: 'Second',
        language: 'en',
        fields: [{ id: 'aaaa1', type: 'short_text', label: 'Note' }],
      })
    ).json()
    const links = [
      (await call('POST', `/patients/${patientId}/form-links`, { formId })).json(),
      (await call('POST', `/patients/${patientId}/form-links`, { formId })).json(),
      (await call('POST', `/patients/${patientId}/form-links`, { formId: second.id })).json(),
    ]
    expect(new Set(links.map((l) => l.token)).size).toBe(3)
    for (const l of links) {
      const page = (await call('GET', `/public/forms/${l.token}`, undefined, false)).json()
      expect(page.state).toBe('open')
      const answers = page.fields.some((f: { id: string }) => f.id === 'preg1') ? { preg1: 'no', new1: 'x' } : {}
      expect(
        (await call('POST', `/public/forms/${l.token}/responses`, { versionId: page.versionId, answers }, false))
          .statusCode,
      ).toBe(201)
    }
    const mine = (await call('GET', `/patients/${patientId}/forms`)).json()
    for (const l of links) expect(mine.links.find((x: { id: string }) => x.id === l.id).status).toBe('submitted')
  })

  it('closes, revokes and rotates links, and never leaks another clinic’s forms', async () => {
    const link = (await call('POST', `/patients/${patientId}/form-links`, { formId })).json()
    await call('POST', `/patients/${patientId}/form-links/${link.id}/revoke`)
    expect((await call('GET', `/public/forms/${link.token}`, undefined, false)).json().state).toBe('expired')

    await call('PATCH', `/forms/${formId}`, { acceptingResponses: false })
    expect((await call('GET', `/public/forms/${token}`, undefined, false)).json().state).toBe('closed')
    const closed = await call('POST', `/public/forms/${token}/responses`, { versionId: v1, answers: {} }, false)
    expect(closed.statusCode).toBe(410)

    const rotated = (await call('POST', `/forms/${formId}/rotate-link`)).json()
    expect(rotated.publicToken).not.toBe(token)
    expect((await call('GET', `/public/forms/${token}`, undefined, false)).statusCode).toBe(404)

    // Staff of this clinic can't open another clinic's form; the public page is fine (it's public).
    const otherForm = await db.form.findUnique({ where: { publicToken: otherClinicFormToken } })
    expect((await call('GET', `/forms/${otherForm!.id}`)).statusCode).toBe(404)
    expect((await call('GET', '/public/forms/not-a-real-token-at-all', undefined, false)).statusCode).toBe(404)
  })

  it('limits public submissions per address, whatever token is used', async () => {
    // A separate address, so this flood doesn't use up the rest of the suite's allowance.
    const flood = (token: string) =>
      app.inject({
        method: 'POST',
        url: `/api/v1/public/forms/${token}/responses`,
        remoteAddress: '10.9.9.9',
        payload: { versionId: '00000000-0000-7000-8000-000000000000', answers: {} },
      })
    const codes: number[] = []
    // Made-up tokens each time: they must not each get a fresh allowance.
    for (let i = 0; i < 31; i++) codes.push((await flood(`madeUpToken${String(i).padStart(10, '0')}`)).statusCode)
    expect(codes.slice(0, 30).every((c) => c !== 429)).toBe(true)
    expect(codes[30]).toBe(429)
    expect((await flood(token)).statusCode).toBe(429)
  })
})
