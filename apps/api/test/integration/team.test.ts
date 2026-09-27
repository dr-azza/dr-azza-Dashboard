/**
 * Team management end to end: add a member, invite link, set password, sign in, roles,
 * deactivation, password reset, and the "always one owner" rule. Own clinic per run.
 */
import { hash } from '@node-rs/argon2'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { PrismaPg } from '@prisma/adapter-pg'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app'
import { PrismaClient } from '../../src/generated/prisma/client'

const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('team (integration)', () => {
  let app: NestFastifyApplication
  let db: PrismaClient
  let owner = ''
  let ownerId = ''
  const run = randomUUID().slice(0, 8)
  const ownerEmail = `owner-${run}@azzah.test`
  const ownerPassword = `owner-${randomUUID()}`
  const nurseEmail = `nurse-${run}@azzah.test`
  const nursePassword = 'nurse-password-1'

  const call = (method: 'GET' | 'POST' | 'PATCH', path: string, payload?: object, cookie?: string) =>
    app.inject({ method, url: `/api/v1${path}`, payload, headers: cookie ? { cookie } : {} })
  const login = async (email: string, password: string) => {
    const res = await call('POST', '/auth/login', { email, password })
    return res.statusCode === 204 ? String(res.headers['set-cookie']).split(';')[0] : null
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
    const clinic = await db.clinic.create({ data: { name: `Team ${run}`, slug: `team-${run}` } })
    ownerId = (
      await db.staffMember.create({
        data: {
          clinicId: clinic.id,
          email: ownerEmail,
          fullName: 'Clinic Owner',
          role: 'OWNER',
          passwordHash: await hash(ownerPassword),
        },
      })
    ).id
    app = await createApp()
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
    owner = (await login(ownerEmail, ownerPassword))!
  })

  afterAll(async () => {
    await app?.close()
    await db?.$disconnect()
  })

  let nurseId = ''
  let inviteToken = ''

  it('adds a member as invited, with a one-time link, and refuses a duplicate email', async () => {
    const res = await call(
      'POST',
      '/team',
      { fullName: 'Sara Nurse', email: nurseEmail.toUpperCase(), phone: '010 1234 5678', role: 'NURSE' },
      owner,
    )
    expect(res.statusCode).toBe(201)
    const { member, token } = res.json()
    expect(member).toMatchObject({ email: nurseEmail, phone: '+201012345678', role: 'NURSE', status: 'invited' })
    expect(member.pendingInvite).not.toBeNull()
    nurseId = member.id
    inviteToken = token
    const dup = await call('POST', '/team', { fullName: 'Again', email: nurseEmail, role: 'NURSE' }, owner)
    expect(dup.statusCode).toBe(409)
    // Not stored in plain text anywhere.
    expect(await db.staffInvite.count({ where: { tokenHash: token } })).toBe(0)
  })

  it('lets the member set a password once through the link, then sign in', async () => {
    const page = (await call('GET', `/public/invites/${inviteToken}`)).json()
    expect(page).toMatchObject({ email: nurseEmail, kind: 'welcome', fullName: 'Sara Nurse' })
    expect((await call('POST', `/public/invites/${inviteToken}`, { password: 'short' })).statusCode).toBe(400)
    expect((await call('POST', `/public/invites/${inviteToken}`, { password: nursePassword })).statusCode).toBe(200)
    expect((await call('POST', `/public/invites/${inviteToken}`, { password: nursePassword })).statusCode).toBe(410)
    expect(await login(nurseEmail, nursePassword)).toBeTruthy()
    const list = (await call('GET', '/team', undefined, owner)).json()
    expect(list.find((m: { id: string }) => m.id === nurseId).status).toBe('active')
  })

  it('lets everyone see the team but only owners change it', async () => {
    const nurse = (await login(nurseEmail, nursePassword))!
    expect((await call('GET', '/team', undefined, nurse)).statusCode).toBe(200)
    expect(
      (await call('POST', '/team', { fullName: 'X', email: `x-${run}@azzah.test`, role: 'OWNER' }, nurse)).statusCode,
    ).toBe(403)
    expect((await call('PATCH', `/team/${nurseId}`, { role: 'OWNER' }, nurse)).statusCode).toBe(403)
  })

  it('keeps at least one active owner and never lets owners deactivate themselves', async () => {
    expect((await call('PATCH', `/team/${ownerId}`, { role: 'DOCTOR' }, owner)).statusCode).toBe(400)
    expect((await call('PATCH', `/team/${ownerId}`, { active: false }, owner)).statusCode).toBe(400)
    // With a second owner, the first can step down.
    await call('PATCH', `/team/${nurseId}`, { role: 'OWNER' }, owner)
    expect((await call('PATCH', `/team/${ownerId}`, { role: 'DOCTOR' }, owner)).statusCode).toBe(200)
    // The (now) doctor can no longer manage; the nurse-turned-owner can, and restores things.
    const second = (await login(nurseEmail, nursePassword))!
    expect((await call('PATCH', `/team/${ownerId}`, { role: 'OWNER' }, second)).statusCode).toBe(200)
    expect((await call('PATCH', `/team/${nurseId}`, { role: 'NURSE' }, owner)).statusCode).toBe(200)
  })

  it('deactivating signs the member out at once; a reset link signs out old sessions', async () => {
    const nurse = (await login(nurseEmail, nursePassword))!
    expect((await call('GET', '/auth/me', undefined, nurse)).statusCode).toBe(200)
    await call('PATCH', `/team/${nurseId}`, { active: false }, owner)
    expect((await call('GET', '/auth/me', undefined, nurse)).statusCode).toBe(401)
    expect(await login(nurseEmail, nursePassword)).toBeNull()
    expect((await call('POST', `/team/${nurseId}/link`, undefined, owner)).statusCode).toBe(400)

    await call('PATCH', `/team/${nurseId}`, { active: true }, owner)
    const before = (await login(nurseEmail, nursePassword))!
    const reset = (await call('POST', `/team/${nurseId}/link`, undefined, owner)).json()
    const older = (await call('POST', `/team/${nurseId}/link`, undefined, owner)).json()
    // Only the newest link works.
    expect((await call('GET', `/public/invites/${reset.token}`)).statusCode).toBe(410)
    expect((await call('GET', `/public/invites/${older.token}`)).json().kind).toBe('reset')
    expect(
      (await call('POST', `/public/invites/${older.token}`, { password: 'a-brand-new-password' })).statusCode,
    ).toBe(200)
    expect((await call('GET', '/auth/me', undefined, before)).statusCode).toBe(401)
    expect(await login(nurseEmail, nursePassword)).toBeNull()
    expect(await login(nurseEmail, 'a-brand-new-password')).toBeTruthy()
  })
})
