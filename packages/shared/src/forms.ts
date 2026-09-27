/**
 * Clinic-built forms: the question model, conditional logic and answer validation.
 * One implementation for the builder, the patient page and the API, so what the patient sees
 * and what the server accepts can never disagree.
 */
import { z } from 'zod'
import { optionalText, paginationQuery, requiredText } from './schemas/common.js'

// --- Question model -----------------------------------------------------------------

export const FIELD_TYPES = [
  'short_text',
  'long_text',
  'number',
  'date',
  'phone',
  'single_choice',
  'multi_choice',
  'dropdown',
  'yes_no',
  'scale',
  'section',
] as const
export type FieldType = (typeof FIELD_TYPES)[number]

/** Types whose answer is one or more of the field's options. */
export const OPTION_TYPES = ['single_choice', 'multi_choice', 'dropdown'] as const satisfies readonly FieldType[]
export const hasOptions = (type: FieldType): type is (typeof OPTION_TYPES)[number] =>
  (OPTION_TYPES as readonly string[]).includes(type)

export const FORM_LANGUAGES = ['ar', 'en'] as const
export type FormLanguage = (typeof FORM_LANGUAGES)[number]

export const FORM_LIMITS = {
  title: 160,
  fields: 100,
  options: 50,
  label: 500,
  description: 1000,
  option: 200,
  shortAnswer: 500,
  longAnswer: 5000,
  rules: 10,
} as const

export const CONDITION_OPS = [
  'equals',
  'not_equals',
  'includes',
  'not_includes',
  'gt',
  'lt',
  'answered',
  'not_answered',
] as const
export type ConditionOp = (typeof CONDITION_OPS)[number]

/** Which comparisons make sense for a question of each type. */
export function opsFor(type: FieldType): ConditionOp[] {
  switch (type) {
    case 'single_choice':
    case 'dropdown':
    case 'yes_no':
      return ['equals', 'not_equals', 'answered', 'not_answered']
    case 'multi_choice':
      return ['includes', 'not_includes', 'answered', 'not_answered']
    case 'number':
    case 'scale':
      return ['equals', 'not_equals', 'gt', 'lt', 'answered', 'not_answered']
    case 'section':
      return []
    default:
      return ['answered', 'not_answered']
  }
}
export const opNeedsValue = (op: ConditionOp) => op !== 'answered' && op !== 'not_answered'

const id = z.string().regex(/^[a-z0-9]{4,24}$/i, 'Invalid id')

export const FormOptionSchema = z.object({ id, label: requiredText(FORM_LIMITS.option) })
export type FormOption = z.output<typeof FormOptionSchema>

export const ConditionRuleSchema = z.object({
  fieldId: id,
  op: z.enum(CONDITION_OPS),
  /** Option id for choices, "yes"/"no" for yes/no, a number for number/scale; empty for answered checks. */
  value: z.union([z.string().max(FORM_LIMITS.option), z.number()]).nullish(),
})
export type ConditionRule = z.output<typeof ConditionRuleSchema>

export const ConditionSchema = z.object({
  /** "all": every rule must hold; "any": at least one. */
  match: z.enum(['all', 'any']),
  rules: z.array(ConditionRuleSchema).min(1).max(FORM_LIMITS.rules),
})
export type Condition = z.output<typeof ConditionSchema>

export const FormFieldSchema = z.object({
  id,
  type: z.enum(FIELD_TYPES),
  label: requiredText(FORM_LIMITS.label),
  description: optionalText(FORM_LIMITS.description),
  required: z.boolean().default(false),
  /** Choice questions only. */
  options: z.array(FormOptionSchema).max(FORM_LIMITS.options).optional(),
  /** Number: optional bounds. Scale: required bounds (0–10). */
  min: z.number().int().min(-100000).max(100000).nullish(),
  max: z.number().int().min(-100000).max(100000).nullish(),
  /** Scale: words at each end, e.g. "No pain" / "Worst pain". */
  minLabel: optionalText(60),
  maxLabel: optionalText(60),
  /** Shown only when this holds; null means always shown. */
  condition: ConditionSchema.nullish(),
})
export type FormField = z.output<typeof FormFieldSchema>
export type FormFieldInput = z.input<typeof FormFieldSchema>

/**
 * A whole form's questions, with the cross-field rules a single field can't check:
 * unique ids, choices that have options, scales with sensible bounds, and conditions that only
 * look back at earlier questions (so logic can never loop).
 */
export const FormFieldsSchema = z
  .array(FormFieldSchema)
  .max(FORM_LIMITS.fields)
  .superRefine((fields, ctx) => {
    const seen = new Map<string, FormField>()
    fields.forEach((field, index) => {
      const at = (...path: (string | number)[]) => [index, ...path]
      if (seen.has(field.id)) ctx.addIssue({ code: 'custom', message: 'Duplicate question id', path: at('id') })

      if (hasOptions(field.type)) {
        const options = field.options ?? []
        if (options.length < 1)
          ctx.addIssue({ code: 'custom', message: 'Add at least one option', path: at('options') })
        if (new Set(options.map((o) => o.id)).size !== options.length)
          ctx.addIssue({ code: 'custom', message: 'Duplicate option id', path: at('options') })
      }
      if (field.type === 'scale') {
        const { min, max } = field
        if (min == null || max == null || min < 0 || max > 10 || min >= max)
          ctx.addIssue({ code: 'custom', message: 'A scale runs from 0 or 1 up to at most 10', path: at('max') })
      }
      if (field.type === 'number' && field.min != null && field.max != null && field.min > field.max)
        ctx.addIssue({ code: 'custom', message: 'Minimum is above maximum', path: at('min') })
      if (field.type === 'section' && field.required)
        ctx.addIssue({ code: 'custom', message: 'A section cannot be required', path: at('required') })

      field.condition?.rules.forEach((rule, r) => {
        const source = seen.get(rule.fieldId)
        const path = at('condition', 'rules', r)
        if (!source) {
          ctx.addIssue({ code: 'custom', message: 'A condition can only use an earlier question', path })
          return
        }
        if (!opsFor(source.type).includes(rule.op)) {
          ctx.addIssue({ code: 'custom', message: 'That comparison does not fit this question', path })
          return
        }
        if (!opNeedsValue(rule.op)) return
        const ok =
          source.type === 'yes_no'
            ? rule.value === 'yes' || rule.value === 'no'
            : hasOptions(source.type)
              ? source.options?.some((o) => o.id === rule.value)
              : typeof rule.value === 'number'
        if (!ok) ctx.addIssue({ code: 'custom', message: 'Choose a value for this condition', path })
      })
      seen.set(field.id, field)
    })
  })

// --- Answers and conditional logic ---------------------------------------------------

export type AnswerValue = string | number | string[] | null
export type Answers = Record<string, AnswerValue>

/**
 * Whether a value counts as an answer. Values of an unexpected type (sent by a broken or hostile
 * client) count as answered, so validation reports them as invalid instead of crashing.
 */
const isAnswered = (v: unknown) =>
  typeof v === 'string'
    ? v.trim() !== ''
    : Array.isArray(v)
      ? v.length > 0
      : typeof v === 'number'
        ? Number.isFinite(v)
        : v != null

function ruleHolds(rule: ConditionRule, value: AnswerValue | undefined) {
  switch (rule.op) {
    case 'answered':
      return isAnswered(value)
    case 'not_answered':
      return !isAnswered(value)
    case 'equals':
      return isAnswered(value) && value === rule.value
    case 'not_equals':
      // An unanswered question "is not" any value: follow-ups for "not X" appear until X is picked.
      return value !== rule.value
    case 'includes':
      return Array.isArray(value) && value.includes(String(rule.value))
    case 'not_includes':
      return !Array.isArray(value) || !value.includes(String(rule.value))
    case 'gt':
      return typeof value === 'number' && typeof rule.value === 'number' && value > rule.value
    case 'lt':
      return typeof value === 'number' && typeof rule.value === 'number' && value < rule.value
  }
}

/**
 * The ids of questions currently shown, in order. A rule about a hidden question never holds
 * (whatever its operator), so everything that depends on a hidden question hides with it.
 */
export function visibleFieldIds(fields: readonly FormField[], answers: Answers): Set<string> {
  const visible = new Set<string>()
  for (const field of fields) {
    const condition = field.condition
    const holds = (rule: ConditionRule) => visible.has(rule.fieldId) && ruleHolds(rule, answers[rule.fieldId])
    const shown = !condition || (condition.match === 'all' ? condition.rules.every(holds) : condition.rules.some(holds))
    if (shown) visible.add(field.id)
  }
  return visible
}

export type AnswerError = 'required' | 'invalid' | 'too_long' | 'out_of_range'

/** YYYY-MM-DD that exists on the calendar (rejects 2024-02-31, which Date.parse would roll over). */
function isCalendarDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
}

/** Accepts local Egyptian numbers (010…), 00-prefixed and +-prefixed ones, in Arabic or Latin digits. */
export function normalizePhone(input: string): string | null {
  const latin = input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
  let v = latin.replace(/[\s().-]/g, '')
  if (v.startsWith('00')) v = `+${v.slice(2)}`
  else if (/^01\d{9}$/.test(v)) v = `+20${v.slice(1)}`
  else if (/^20\d{10}$/.test(v)) v = `+${v}`
  return /^\+[1-9]\d{7,14}$/.test(v) ? v : null
}

/**
 * Checks answers against the form and returns only what should be stored: answers to visible
 * questions, trimmed and in the right type. Hidden questions are dropped even if the browser
 * sent them, and `required` only applies to questions the patient could see.
 */
export function validateAnswers(fields: readonly FormField[], raw: Record<string, unknown>) {
  const answers = raw as Answers
  const visible = visibleFieldIds(fields, answers)
  const errors: Record<string, AnswerError> = {}
  const clean: Answers = {}

  for (const field of fields) {
    if (field.type === 'section' || !visible.has(field.id)) continue
    const value = answers[field.id]
    if (!isAnswered(value)) {
      if (field.required) errors[field.id] = 'required'
      continue
    }
    const fail = (e: AnswerError) => (errors[field.id] = e)

    switch (field.type) {
      case 'short_text':
      case 'long_text': {
        if (typeof value !== 'string') {
          fail('invalid')
          break
        }
        const text = value.trim()
        const max = field.type === 'short_text' ? FORM_LIMITS.shortAnswer : FORM_LIMITS.longAnswer
        if (text.length > max) fail('too_long')
        else clean[field.id] = text
        break
      }
      case 'phone': {
        const phone = typeof value === 'string' ? normalizePhone(value) : null
        if (!phone) fail('invalid')
        else clean[field.id] = phone
        break
      }
      case 'date': {
        if (typeof value !== 'string' || !isCalendarDate(value)) fail('invalid')
        else clean[field.id] = value
        break
      }
      case 'number':
      case 'scale': {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          fail('invalid')
          break
        }
        if (field.type === 'scale' && !Number.isInteger(value)) {
          fail('invalid')
          break
        }
        if ((field.min != null && value < field.min) || (field.max != null && value > field.max)) fail('out_of_range')
        else clean[field.id] = value
        break
      }
      case 'yes_no': {
        if (value !== 'yes' && value !== 'no') fail('invalid')
        else clean[field.id] = value
        break
      }
      case 'single_choice':
      case 'dropdown': {
        if (typeof value !== 'string' || !field.options?.some((o) => o.id === value)) fail('invalid')
        else clean[field.id] = value
        break
      }
      case 'multi_choice': {
        const ids = new Set(field.options?.map((o) => o.id))
        if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !ids.has(v))) fail('invalid')
        // Stored in the form's option order, without repeats.
        else clean[field.id] = field.options!.map((o) => o.id).filter((o) => value.includes(o))
        break
      }
    }
  }
  return { ok: Object.keys(errors).length === 0, errors, answers: clean }
}

/** Human-readable answer text, e.g. for the response view and exports. */
export function answerText(
  field: FormField,
  value: AnswerValue | undefined,
  words: { yes: string; no: string; separator?: string },
) {
  if (!isAnswered(value)) return null
  if (field.type === 'yes_no') return value === 'yes' ? words.yes : words.no
  if (hasOptions(field.type)) {
    const ids = Array.isArray(value) ? value : [String(value)]
    return ids.map((v) => field.options?.find((o) => o.id === v)?.label ?? v).join(words.separator ?? ', ')
  }
  return String(value)
}

// --- Requests ------------------------------------------------------------------------

const FormContentSchema = z.object({
  title: requiredText(FORM_LIMITS.title),
  description: optionalText(FORM_LIMITS.description),
  language: z.enum(FORM_LANGUAGES),
  fields: FormFieldsSchema,
})

export const CreateFormSchema = FormContentSchema.extend({ fields: FormFieldsSchema.default([]) })
export type CreateFormInput = z.input<typeof CreateFormSchema>

/**
 * Every key optional and without defaults: a PATCH that only toggles `acceptingResponses` must
 * leave the questions exactly as they are.
 */
export const UpdateFormSchema = FormContentSchema.partial().extend({
  acceptingResponses: z.boolean().optional(),
  archived: z.boolean().optional(),
  /** The version the editor started from; a save on top of someone else's newer save is refused. */
  expectedVersion: z.number().int().min(1).optional(),
})
export type UpdateFormInput = z.input<typeof UpdateFormSchema>

/** What the patient page sends. Answers are checked against the exact version the patient saw. */
export const SubmitFormSchema = z.object({
  versionId: z.uuid(),
  answers: z.record(z.string().max(24), z.unknown()),
  /** Required on the shared link, ignored on personal links. */
  respondent: z.object({ name: requiredText(120), phone: z.string().trim().min(6).max(30) }).nullish(),
})
export type SubmitFormInput = z.input<typeof SubmitFormSchema>

export const CreateFormLinkSchema = z.object({ formId: z.uuid() })
export type CreateFormLinkInput = z.input<typeof CreateFormLinkSchema>

export const UpdateFormResponseSchema = z.object({
  reviewed: z.boolean().optional(),
  /** Tie the response to a patient (or untie it with null). */
  patientId: z.uuid().nullable().optional(),
})
export type UpdateFormResponseInput = z.input<typeof UpdateFormResponseSchema>

export const ListFormResponsesQuerySchema = paginationQuery.extend({
  status: z.enum(['new', 'reviewed']).optional(),
  formId: z.uuid().optional(),
  /** "false": responses not tied to any patient yet (shared-link answers with no phone match). */
  linked: z.enum(['true', 'false']).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})
export type ListFormResponsesQuery = z.output<typeof ListFormResponsesQuerySchema>

/** Personal links stay valid this long unless used or revoked. */
export const FORM_LINK_TTL_DAYS = 30
