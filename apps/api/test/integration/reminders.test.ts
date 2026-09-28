/**
 * Team reminders end to end: add, assign, list mine and everyone's, complete and reopen,
 * who may delete, clinic isolation, and the patient's activity log. Also the patient's visit
 * mode (in clinic or online). Own clinic per run.
 */
import { hash } from '@node-rs/argon2'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { PrismaPg } from '@prisma/adapter-pg'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app'
import { PrismaClient } from '../../src/generated/prisma/client'

const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('reminders (integration)', () => {
  let app: NestFastifyApplication
  let db: PrismaClient
  let owner = ''
  let nurse = ''
  let outsider = ''
  let ownerId = ''
  let nurseId = ''
  let caseTypeId = ''
  const run = randomUUID().slice(0, 8)
  const password = `pw-${randomUUID()}`

  const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, payload?: object, cookie?: string) =>
    app.inject({ method, url: `/api/v1${path}`, payload, headers: cookie ? { cookie } : {} })
  const login = async (email: string) => {
    const res = await call('POST', '/auth/login', { email, password })
    return String(res.headers['set-cookie']).split(';')[0]
  }
  const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString()

  beforeAll(async () => {
    process.env.DATABASE_URL = url
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
    const passwordHash = await hash(password)
    const clinic = await db.clinic.create({ data: { name: `Rem ${run}`, slug: `rem-${run}` } })
    const other = await db.clinic.create({ data: { name: `Rem other ${run}`, slug: `rem-other-${run}` } })
    const staff = (clinicId: string, name: string, role: 'OWNER' | 'NURSE') =>
      db.staffMember.create({
        data: { clinicId, email: `${name}-${run}@azzah.test`, fullName: name, role, passwordHash },
      })
    ownerId = (await staff(clinic.id, 'owner', 'OWNER')).id
    nurseId = (await staff(clinic.id, 'nurse', 'NURSE')).id
    await staff(other.id, 'outsider', 'OWNER')
    caseTypeId = (await db.caseType.create({ data: { clinicId: clinic.id, nameEn: 'Gynecology', nameAr: 'نساء' } })).id
    app = await createApp()
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
    owner = await login(`owner-${run}@azzah.test`)
    nurse = await login(`nurse-${run}@azzah.test`)
    outsider = await login(`outsider-${run}@azzah.test`)
  })

  afterAll(async () => {
    await app?.close()
    await db?.$disconnect()
  })

  let patientId = ''

  it('records whether a patient is seen in clinic or online, and filters by it', async () => {
    const base = { phone: '+201011112222', caseTypeId, consentGiven: true }
    const online = await call('POST', '/patients', { ...base, fullName: 'Online Patient', visitMode: 'ONLINE' }, owner)
    expect(online.statusCode).toBe(201)
    expect(online.json().visitMode).toBe('ONLINE')
    const clinic = await call('POST', '/patients', { ...base, fullName: 'Clinic Patient' }, owner)
    expect(clinic.json().visitMode).toBe('IN_CLINIC')
    patientId = clinic.json().id

    const bad = await call('POST', '/patients', { ...base, fullName: 'Bad', visitMode: 'HOME' }, owner)
    expect(bad.statusCode).toBe(400)

    const onlineOnly = (await call('GET', '/patients?visitMode=ONLINE', undefined, owner)).json()
    expect(onlineOnly.items.map((p: { fullName: string }) => p.fullName)).toEqual(['Online Patient'])

    const moved = await call('PATCH', `/patients/${patientId}`, { visitMode: 'ONLINE' }, owner)
    expect(moved.json().visitMode).toBe('ONLINE')
  })

  let taskId = ''

  it('adds a reminder for a colleague about a patient, and lists it for them', async () => {
    const res = await call(
      'POST',
      '/reminders',
      {
        title: 'Call about lab results',
        notes: 'CBC came back',
        dueAt: inHours(2),
        priority: 'HIGH',
        assigneeId: nurseId,
        patientId,
      },
      owner,
    )
    expect(res.statusCode).toBe(201)
    const task = res.json()
    expect(task).toMatchObject({
      title: 'Call about lab results',
      priority: 'HIGH',
      assignee: { id: nurseId },
      patient: { id: patientId },
      createdBy: { id: ownerId },
      completedAt: null,
    })
    taskId = task.id

    await call('POST', '/reminders', { title: 'Order gloves', dueAt: inHours(-3) }, owner)

    const mine = (await call('GET', '/reminders?assignee=me', undefined, nurse)).json()
    expect(mine.items.map((t: { id: string }) => t.id)).toEqual([taskId])
    // Everyone's, soonest first: the overdue one leads.
    const all = (await call('GET', '/reminders', undefined, nurse)).json()
    expect(all.items.map((t: { title: string }) => t.title)).toEqual(['Order gloves', 'Call about lab results'])
    const unassigned = (await call('GET', '/reminders?assignee=unassigned', undefined, nurse)).json()
    expect(unassigned.items).toHaveLength(1)
    const forPatient = (await call('GET', `/reminders?patientId=${patientId}`, undefined, nurse)).json()
    expect(forPatient.items.map((t: { id: string }) => t.id)).toEqual([taskId])
  })

  it('rejects bad input, strangers and other clinics', async () => {
    expect((await call('POST', '/reminders', { title: '', dueAt: inHours(1) }, owner)).statusCode).toBe(400)
    expect((await call('POST', '/reminders', { title: 'x', dueAt: 'tomorrow' }, owner)).statusCode).toBe(400)
    const foreign = await call('POST', '/reminders', { title: 'x', dueAt: inHours(1), assigneeId: randomUUID() }, owner)
    expect(foreign.statusCode).toBe(400)
    expect((await call('GET', '/reminders')).statusCode).toBe(401)
    // Another clinic neither sees nor touches it.
    expect((await call('GET', '/reminders', undefined, outsider)).json().items).toHaveLength(0)
    expect((await call('POST', `/reminders/${taskId}/complete`, undefined, outsider)).statusCode).toBe(404)
    const otherPatient = await call('POST', '/reminders', { title: 'x', dueAt: inHours(1), patientId }, outsider)
    expect(otherPatient.statusCode).toBe(404)
  })

  it('edits, completes and reopens, recording who did it', async () => {
    const edited = await call('PATCH', `/reminders/${taskId}`, { title: 'Call Mona', assigneeId: null }, nurse)
    expect(edited.json()).toMatchObject({ title: 'Call Mona', assignee: null, priority: 'HIGH' })

    const done = await call('POST', `/reminders/${taskId}/complete`, undefined, nurse)
    expect(done.statusCode).toBe(200)
    expect(done.json()).toMatchObject({ completedBy: { id: nurseId } })
    expect(done.json().completedAt).not.toBeNull()
    // Completing again keeps the first completion.
    const again = await call('POST', `/reminders/${taskId}/complete`, undefined, owner)
    expect(again.json().completedBy.id).toBe(nurseId)

    const open = (await call('GET', '/reminders', undefined, owner)).json()
    expect(open.items.some((t: { id: string }) => t.id === taskId)).toBe(false)
    const finished = (await call('GET', '/reminders?status=done', undefined, owner)).json()
    expect(finished.items.map((t: { id: string }) => t.id)).toEqual([taskId])

    const reopened = await call('POST', `/reminders/${taskId}/reopen`, undefined, owner)
    expect(reopened.json()).toMatchObject({ completedAt: null, completedBy: null })
  })

  it("puts reminder changes in the patient's activity log", async () => {
    const log = (await call('GET', `/patients/${patientId}/activity`, undefined, owner)).json()
    const actions = log.items.map((a: { action: string }) => a.action)
    for (const action of ['reminder.create', 'reminder.update', 'reminder.complete', 'reminder.reopen']) {
      expect(actions).toContain(action)
    }
  })

  it('lets only the author or an owner delete', async () => {
    const nurseTask = (await call('POST', '/reminders', { title: 'Restock', dueAt: inHours(24) }, nurse)).json()
    const ownerTask = (await call('POST', '/reminders', { title: 'Pay rent', dueAt: inHours(24) }, owner)).json()
    expect((await call('DELETE', `/reminders/${ownerTask.id}`, undefined, nurse)).statusCode).toBe(403)
    expect((await call('DELETE', `/reminders/${nurseTask.id}`, undefined, nurse)).statusCode).toBe(200)
    expect((await call('DELETE', `/reminders/${taskId}`, undefined, owner)).statusCode).toBe(200)
    expect((await call('DELETE', `/reminders/${taskId}`, undefined, owner)).statusCode).toBe(404)
  })
})
