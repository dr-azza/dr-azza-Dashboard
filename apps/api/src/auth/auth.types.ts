import type { StaffRoleCode } from '@azza/shared'

/** The signed-in staff member, attached to every authenticated request. */
export interface AuthStaff {
  id: string
  clinicId: string
  clinicName: string
  email: string
  fullName: string
  role: StaffRoleCode
  sessionId: string
}

declare module 'fastify' {
  interface FastifyRequest {
    staff?: AuthStaff
  }
}

export const SESSION_COOKIE = 'azzah_session'
