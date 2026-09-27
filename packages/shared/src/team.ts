/** Clinic team: who can sign in to the dashboard, in what role, and whether they can right now. */
import { z } from 'zod'
import { requiredText } from './schemas/common.js'
import { normalizePhone } from './forms.js'

export const STAFF_ROLES = ['OWNER', 'DOCTOR', 'NURSE', 'RECEPTION'] as const
/** Only owners manage the team (roles and permissions beyond this come later). */
export const TEAM_MANAGER_ROLES = ['OWNER'] as const
export const canManageTeam = (role: string) => (TEAM_MANAGER_ROLES as readonly string[]).includes(role)

/** Invite and password-reset links stay valid this long. */
export const STAFF_INVITE_TTL_DAYS = 7
export const PASSWORD_MIN = 10

/** Optional phone in any format people type; stored as E.164. Empty means none. */
const optionalPhone = z
  .string()
  .trim()
  .max(30)
  .nullish()
  .transform((v, ctx) => {
    if (!v) return null
    const phone = normalizePhone(v)
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid phone number, e.g. 01012345678' })
      return z.NEVER
    }
    return phone
  })

export const CreateStaffSchema = z.object({
  fullName: requiredText(120),
  email: z.email().trim().toLowerCase(),
  phone: optionalPhone,
  role: z.enum(STAFF_ROLES),
})
export type CreateStaffInput = z.input<typeof CreateStaffSchema>

export const UpdateStaffSchema = z.object({
  fullName: requiredText(120).optional(),
  email: z.email().trim().toLowerCase().optional(),
  phone: optionalPhone.optional(),
  role: z.enum(STAFF_ROLES).optional(),
  /** false deactivates: sign-in stops and open sessions end at once. */
  active: z.boolean().optional(),
})
export type UpdateStaffInput = z.input<typeof UpdateStaffSchema>

export const SetPasswordSchema = z.object({
  password: z.string().min(PASSWORD_MIN).max(200),
})
export type SetPasswordInput = z.input<typeof SetPasswordSchema>

export type StaffStatus = 'active' | 'invited' | 'inactive'
