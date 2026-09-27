import { type FormField, FormFieldsSchema, normalizePhone, validateAnswers, visibleFieldIds } from '@azza/shared'
import { describe, expect, it } from 'vitest'

// A small antenatal intake: a yes/no that opens a branch, a multi-choice inside the branch,
// a scale with a threshold follow-up, and a section heading.
const fields = FormFieldsSchema.parse([
  { id: 'sec1', type: 'section', label: 'About you' },
  { id: 'name1', type: 'short_text', label: 'Full name', required: true },
  { id: 'preg1', type: 'yes_no', label: 'Are you pregnant?', required: true },
  {
    id: 'symp1',
    type: 'multi_choice',
    label: 'Symptoms',
    required: true,
    options: [
      { id: 'o1a1', label: 'Bleeding' },
      { id: 'o1b1', label: 'Headache' },
    ],
    condition: { match: 'all', rules: [{ fieldId: 'preg1', op: 'equals', value: 'yes' }] },
  },
  {
    id: 'bled1',
    type: 'long_text',
    label: 'Describe the bleeding',
    required: true,
    condition: { match: 'all', rules: [{ fieldId: 'symp1', op: 'includes', value: 'o1a1' }] },
  },
  { id: 'pain1', type: 'scale', label: 'Pain', min: 0, max: 10 },
  {
    id: 'pain2',
    type: 'short_text',
    label: 'Where is the pain?',
    condition: { match: 'any', rules: [{ fieldId: 'pain1', op: 'gt', value: 6 }] },
  },
  { id: 'phon1', type: 'phone', label: 'Phone' },
]) as FormField[]

describe('form definitions', () => {
  it('rejects a condition that points at a later question (no loops)', () => {
    const result = FormFieldsSchema.safeParse([
      {
        id: 'aaaa',
        type: 'yes_no',
        label: 'A',
        condition: { match: 'all', rules: [{ fieldId: 'bbbb', op: 'equals', value: 'yes' }] },
      },
      { id: 'bbbb', type: 'yes_no', label: 'B' },
    ])
    expect(result.success).toBe(false)
  })

  it('rejects comparisons that do not fit the question and unknown options', () => {
    const base = { id: 'aaaa', type: 'single_choice', label: 'A', options: [{ id: 'op01', label: 'x' }] }
    const withRule = (rule: object) =>
      FormFieldsSchema.safeParse([
        base,
        { id: 'bbbb', type: 'short_text', label: 'B', condition: { match: 'all', rules: [rule] } },
      ])
    expect(withRule({ fieldId: 'aaaa', op: 'gt', value: 3 }).success).toBe(false)
    expect(withRule({ fieldId: 'aaaa', op: 'equals', value: 'nope' }).success).toBe(false)
    expect(withRule({ fieldId: 'aaaa', op: 'equals', value: 'op01' }).success).toBe(true)
  })

  it('requires options on choice questions and sane scale bounds', () => {
    expect(FormFieldsSchema.safeParse([{ id: 'aaaa', type: 'dropdown', label: 'A', options: [] }]).success).toBe(false)
    expect(FormFieldsSchema.safeParse([{ id: 'aaaa', type: 'scale', label: 'A', min: 5, max: 3 }]).success).toBe(false)
    expect(FormFieldsSchema.safeParse([{ id: 'aaaa', type: 'scale', label: 'A', min: 1, max: 5 }]).success).toBe(true)
  })
})

describe('conditional logic', () => {
  it('opens a branch only when its condition holds, and closes the whole branch together', () => {
    expect([...visibleFieldIds(fields, {})]).not.toContain('symp1')
    const yes = visibleFieldIds(fields, { preg1: 'yes', symp1: ['o1a1'] })
    expect(yes.has('symp1')).toBe(true)
    expect(yes.has('bled1')).toBe(true)
    // Switching back to "no" hides symptoms, so the bleeding follow-up disappears too,
    // even though the old symptom answer is still in memory.
    const no = visibleFieldIds(fields, { preg1: 'no', symp1: ['o1a1'] })
    expect(no.has('symp1')).toBe(false)
    expect(no.has('bled1')).toBe(false)
  })

  it('hides a follow-up whose source question is hidden, whatever the operator', () => {
    // Q2 only if pregnant; Q3 only if Q2 is not "yes". Not pregnant: Q2 hidden, so Q3 must be too.
    const branch = FormFieldsSchema.parse([
      { id: 'qone', type: 'yes_no', label: 'Pregnant?' },
      {
        id: 'qtwo',
        type: 'yes_no',
        label: 'First pregnancy?',
        condition: { match: 'all', rules: [{ fieldId: 'qone', op: 'equals', value: 'yes' }] },
      },
      {
        id: 'qthr',
        type: 'number',
        label: 'How many before?',
        required: true,
        condition: { match: 'all', rules: [{ fieldId: 'qtwo', op: 'not_equals', value: 'yes' }] },
      },
    ]) as FormField[]
    expect(visibleFieldIds(branch, { qone: 'no' }).has('qthr')).toBe(false)
    expect(validateAnswers(branch, { qone: 'no' }).ok).toBe(true)
    expect(visibleFieldIds(branch, { qone: 'yes', qtwo: 'no' }).has('qthr')).toBe(true)
  })

  it('compares numbers for scales', () => {
    expect(visibleFieldIds(fields, { pain1: 6 }).has('pain2')).toBe(false)
    expect(visibleFieldIds(fields, { pain1: 7 }).has('pain2')).toBe(true)
  })
})

describe('answer validation', () => {
  it('requires only visible questions and drops answers to hidden ones', () => {
    const result = validateAnswers(fields, { name1: '  Rana ', preg1: 'no', symp1: ['o1a1'], bled1: 'x' })
    expect(result.ok).toBe(true)
    expect(result.answers).toEqual({ name1: 'Rana', preg1: 'no' })
  })

  it('reports required and invalid answers per question', () => {
    const result = validateAnswers(fields, { preg1: 'yes', symp1: ['nope'], pain1: 11, phon1: 'abc' })
    expect(result.ok).toBe(false)
    expect(result.errors).toMatchObject({
      name1: 'required',
      symp1: 'invalid',
      pain1: 'out_of_range',
      phon1: 'invalid',
    })
  })

  it('keeps choices in option order and normalizes phone numbers', () => {
    const result = validateAnswers(fields, {
      name1: 'A',
      preg1: 'yes',
      symp1: ['o1b1', 'o1a1', 'o1b1'],
      bled1: 'light',
      phon1: '٠١٠ ١٢٣٤ ٥٦٧٨',
    })
    expect(result.ok).toBe(true)
    expect(result.answers.symp1).toEqual(['o1a1', 'o1b1'])
    expect(result.answers.phon1).toBe('+201012345678')
  })

  it('rejects impossible dates and answers of the wrong type without throwing', () => {
    const dated = FormFieldsSchema.parse([
      { id: 'date', type: 'date', label: 'Date' },
      { id: 'text', type: 'short_text', label: 'Text' },
    ]) as FormField[]
    expect(validateAnswers(dated, { date: '2024-02-31' }).errors).toEqual({ date: 'invalid' })
    expect(validateAnswers(dated, { date: '2024-02-29' }).ok).toBe(true)
    expect(validateAnswers(dated, { text: true, date: { x: 1 } }).errors).toEqual({ text: 'invalid', date: 'invalid' })
  })

  it('normalizes the phone formats patients actually type', () => {
    expect(normalizePhone('01012345678')).toBe('+201012345678')
    expect(normalizePhone('00201012345678')).toBe('+201012345678')
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958')
    expect(normalizePhone('12345')).toBeNull()
  })
})
