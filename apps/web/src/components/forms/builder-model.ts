import {
  type ConditionRule,
  type FieldType,
  type FormFieldInput,
  FormFieldsSchema,
  hasOptions,
  opsFor,
} from '@azza/shared'
import {
  AdjustmentsHorizontalIcon,
  Bars2Icon,
  Bars3BottomLeftIcon,
  CalendarIcon,
  ChevronUpDownIcon,
  H1Icon,
  HandThumbUpIcon,
  HashtagIcon,
  ListBulletIcon,
  PhoneIcon,
  StopCircleIcon,
} from '@heroicons/react/16/solid'

/** A question while it is being edited (the saved shape, before validation). */
export type DraftField = FormFieldInput

export const FIELD_ICONS: Record<FieldType, typeof Bars2Icon> = {
  short_text: Bars2Icon,
  long_text: Bars3BottomLeftIcon,
  number: HashtagIcon,
  date: CalendarIcon,
  phone: PhoneIcon,
  single_choice: StopCircleIcon,
  multi_choice: ListBulletIcon,
  dropdown: ChevronUpDownIcon,
  yes_no: HandThumbUpIcon,
  scale: AdjustmentsHorizontalIcon,
  section: H1Icon,
}

/** Question types in the order the "Add question" menu shows them (most used first). */
export const TYPE_MENU: FieldType[][] = [
  ['short_text', 'long_text', 'yes_no', 'single_choice', 'multi_choice', 'dropdown'],
  ['number', 'scale', 'date', 'phone'],
  ['section'],
]

/** Short random id for a question or option, unique within a form. */
export function newId() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => alphabet[b % alphabet.length]).join('')
}

type Label = (n: number) => string

export function newField(type: FieldType, optionLabel: Label): DraftField {
  return withTypeDefaults({ id: newId(), type, label: '', required: false }, type, optionLabel)
}

/** Switches a question's type, keeping what still makes sense (text, required, options). */
export function withTypeDefaults(field: DraftField, type: FieldType, optionLabel: Label): DraftField {
  const next: DraftField = {
    id: field.id,
    type,
    label: field.label,
    description: field.description,
    condition: field.condition,
  }
  if (type !== 'section') next.required = field.required ?? false
  if (hasOptions(type)) {
    next.options = field.options?.length
      ? field.options
      : [
          { id: newId(), label: optionLabel(1) },
          { id: newId(), label: optionLabel(2) },
        ]
  }
  if (type === 'scale') {
    const fits = field.type === 'scale' && field.min != null && field.max != null
    next.min = fits ? field.min : 0
    next.max = fits ? field.max : 10
    next.minLabel = field.minLabel
    next.maxLabel = field.maxLabel
  }
  if (type === 'number') {
    next.min = field.type === 'number' ? field.min : null
    next.max = field.type === 'number' ? field.max : null
  }
  return next
}

/** Drops rules that point at `id` (or no longer fit its type); an emptied condition is removed. */
function pruneRules(fields: DraftField[], keep: (rule: ConditionRule, source: DraftField | undefined) => boolean) {
  const byId = new Map(fields.map((f) => [f.id, f]))
  return fields.map((f) => {
    if (!f.condition) return f
    const rules = f.condition.rules.filter((r) => keep(r as ConditionRule, byId.get(r.fieldId)))
    if (rules.length === f.condition.rules.length) return f
    return { ...f, condition: rules.length ? { ...f.condition, rules } : null }
  })
}

export function removeField(fields: DraftField[], id: string) {
  return pruneRules(
    fields.filter((f) => f.id !== id),
    (rule) => rule.fieldId !== id,
  )
}

/** After a type change, conditions elsewhere that can't apply to the new type are removed. */
export function replaceField(fields: DraftField[], updated: DraftField) {
  const next = fields.map((f) => (f.id === updated.id ? updated : f))
  if (fields.find((f) => f.id === updated.id)?.type === updated.type) return next
  return pruneRules(next, (rule, source) => !source || opsFor(source.type).includes(rule.op))
}

/** A copy right after the original, with fresh ids. It keeps the original's own condition; nothing points at the copy yet. */
export function duplicateField(fields: DraftField[], id: string) {
  const index = fields.findIndex((f) => f.id === id)
  const original = fields[index]
  const copy: DraftField = {
    ...structuredClone(original),
    id: newId(),
    options: original.options?.map((o) => ({ ...o, id: newId() })),
  }
  return [...fields.slice(0, index + 1), copy, ...fields.slice(index + 1)]
}

const MESSAGE_KEYS: Record<string, string> = {
  'Add at least one option': 'needOption',
  'A scale runs from 0 or 1 up to at most 10': 'scale',
  'Minimum is above maximum': 'minMax',
  'A condition can only use an earlier question': 'conditionOrder',
  'That comparison does not fit this question': 'conditionOp',
  'Choose a value for this condition': 'conditionValue',
}

/**
 * Problems per question, as i18n keys under forms.builder.errors, from the same schema the API
 * uses, so the builder never lets through something the server would reject.
 */
export function fieldIssues(fields: DraftField[]): Record<string, string[]> {
  const result = FormFieldsSchema.safeParse(fields)
  if (result.success) return {}
  const issues: Record<string, string[]> = {}
  for (const issue of result.error.issues) {
    const [index, key, sub, subKey] = issue.path
    const field = fields[Number(index)]
    if (!field) continue
    const code =
      MESSAGE_KEYS[issue.message] ??
      (key === 'label'
        ? field.type === 'section'
          ? 'sectionLabel'
          : 'label'
        : key === 'options' && subKey === 'label'
          ? 'optionLabel'
          : key === 'options' && sub === undefined
            ? 'needOption'
            : 'generic')
    const list = (issues[field.id] ??= [])
    if (!list.includes(code)) list.push(code)
  }
  return issues
}
