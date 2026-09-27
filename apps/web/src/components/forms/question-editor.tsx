import { Button } from '@/components/catalyst/button'
import { Description, Field, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Select } from '@/components/catalyst/select'
import { Switch, SwitchField } from '@/components/catalyst/switch'
import { Textarea } from '@/components/catalyst/textarea'
import { useLang } from '@/i18n'
import {
  type Condition,
  type ConditionOp,
  type ConditionRule,
  FIELD_TYPES,
  type FieldType,
  hasOptions,
  opNeedsValue,
  opsFor,
} from '@azza/shared'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  BoltIcon,
  ChevronDownIcon,
  DocumentDuplicateIcon,
  ExclamationCircleIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { type DraftField, FIELD_ICONS, newId, withTypeDefaults } from './builder-model'

/** Six-dot grip, the common drag affordance. */
function GripIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      {[4, 8, 12].flatMap((y) => [5.5, 10.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.25} />))}
    </svg>
  )
}

/**
 * One question in the builder: a compact row when closed (drag handle, type, text, badges),
 * the full settings when open. Dragging uses the handle only, so text stays selectable.
 */
export function QuestionEditor({
  field,
  index,
  earlier,
  open,
  issues,
  optionLabel,
  dir,
  onToggle,
  onChange,
  onDuplicate,
  onRemove,
}: {
  /** Direction of the form's language: question text is typed as patients will read it. */
  dir: 'ltr' | 'rtl'
  field: DraftField
  index: number
  /** Questions above this one: the only ones a condition may use. */
  earlier: DraftField[]
  open: boolean
  issues: string[] | undefined
  optionLabel: (n: number) => string
  onToggle: () => void
  onChange: (field: DraftField) => void
  onDuplicate: () => void
  onRemove: () => void
}) {
  const { t } = useLang()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  })
  const Icon = FIELD_ICONS[field.type]
  const isSection = field.type === 'section'
  const update = (patch: Partial<DraftField>) => onChange({ ...field, ...patch })
  const bodyId = `question-${field.id}`

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={clsx(
        'rounded-xl bg-white ring-1 dark:bg-zinc-900',
        isDragging
          ? 'relative z-10 shadow-lg ring-brand-500'
          : issues?.length
            ? 'ring-red-400 dark:ring-red-500/70'
            : 'ring-zinc-950/8 dark:ring-white/10',
        isSection && !open && 'bg-zinc-50 dark:bg-white/[0.03]',
      )}
    >
      <div className="flex items-center gap-1 ps-1 pe-3">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`${t('forms.builder.drag')}: ${field.label || t('forms.builder.untitled')}`}
          className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-950/5 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-brand-600 active:cursor-grabbing dark:hover:bg-white/10 dark:hover:text-zinc-200"
        >
          <GripIcon className="size-4" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-3 text-start focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          <span className="w-6 shrink-0 text-end text-xs/5 font-medium text-zinc-400 tabular-nums">
            {isSection ? '' : index}
          </span>
          <span
            className={clsx(
              'flex size-7 shrink-0 items-center justify-center rounded-md',
              isSection
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300',
            )}
            title={t(`forms.builder.types.${field.type}`)}
          >
            <Icon className="size-4" />
          </span>
          <span
            className={clsx(
              'min-w-0 flex-1 truncate text-sm/6',
              isSection ? 'font-semibold' : 'font-medium',
              field.label ? 'text-zinc-950 dark:text-white' : 'text-zinc-400 italic',
            )}
          >
            {field.label ? <bdi>{field.label}</bdi> : t('forms.builder.untitled')}
          </span>
          <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
            {issues?.length ? <ExclamationCircleIcon className="size-4 text-red-500" /> : null}
            {field.condition && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs/5 font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                <BoltIcon className="size-3" />
                {t('forms.builder.logicBadge')}
              </span>
            )}
            {field.required && (
              <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-xs/5 font-medium text-brand-800 dark:bg-brand-950/50 dark:text-brand-200">
                {t('forms.builder.requiredBadge')}
              </span>
            )}
          </span>
          <ChevronDownIcon
            className={clsx('size-4 shrink-0 text-zinc-400 transition-transform', open && 'rotate-180')}
          />
        </button>
      </div>

      {open && (
        <div id={bodyId} className="space-y-6 border-t border-zinc-950/5 px-4 pt-5 pb-4 sm:px-6 dark:border-white/5">
          {!!issues?.length && (
            <ul className="space-y-1 rounded-lg bg-red-50 px-3 py-2 text-sm/6 text-red-800 dark:bg-red-950/40 dark:text-red-200">
              {issues.map((code) => (
                <li key={code} className="flex items-center gap-2">
                  <ExclamationCircleIcon className="size-4 shrink-0" />
                  {t(`forms.builder.errors.${code}`)}
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <Field>
              <Label>{isSection ? t('forms.builder.sectionLabel') : t('forms.builder.label')}</Label>
              <Textarea
                rows={2}
                resizable={false}
                autoFocus={!field.label}
                dir={dir}
                placeholder={t('forms.builder.labelPlaceholder')}
                value={field.label}
                onChange={(e) => update({ label: e.target.value })}
              />
            </Field>
            <Field>
              <Label>{t('forms.builder.type')}</Label>
              <Select
                value={field.type}
                onChange={(e) => onChange(withTypeDefaults(field, e.target.value as FieldType, optionLabel))}
              >
                {FIELD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`forms.builder.types.${type}`)}
                  </option>
                ))}
              </Select>
              <Description>{t(`forms.builder.typeHints.${field.type}`)}</Description>
            </Field>
          </div>

          <Field>
            <Label>{t('forms.builder.help')}</Label>
            <Input
              dir={dir}
              placeholder={t('forms.builder.helpPlaceholder')}
              value={field.description ?? ''}
              onChange={(e) => update({ description: e.target.value || null })}
            />
          </Field>

          {hasOptions(field.type) && (
            <OptionsEditor
              dir={dir}
              options={field.options ?? []}
              onChange={(options) => update({ options })}
              optionLabel={optionLabel}
            />
          )}

          {(field.type === 'number' || field.type === 'scale') && (
            <div className="grid gap-6 sm:grid-cols-2">
              <Field>
                <Label>{t('forms.builder.min')}</Label>
                <Input
                  type="number"
                  placeholder={field.type === 'number' ? t('forms.builder.noLimit') : undefined}
                  value={field.min ?? ''}
                  onChange={(e) => update({ min: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </Field>
              <Field>
                <Label>{t('forms.builder.max')}</Label>
                <Input
                  type="number"
                  placeholder={field.type === 'number' ? t('forms.builder.noLimit') : undefined}
                  value={field.max ?? ''}
                  onChange={(e) => update({ max: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </Field>
              {field.type === 'scale' && (
                <>
                  <Field>
                    <Label>{t('forms.builder.minLabel')}</Label>
                    <Input
                      dir={dir}
                      placeholder={t('forms.builder.minLabelPlaceholder')}
                      value={field.minLabel ?? ''}
                      onChange={(e) => update({ minLabel: e.target.value || null })}
                    />
                  </Field>
                  <Field>
                    <Label>{t('forms.builder.maxLabel')}</Label>
                    <Input
                      dir={dir}
                      placeholder={t('forms.builder.maxLabelPlaceholder')}
                      value={field.maxLabel ?? ''}
                      onChange={(e) => update({ maxLabel: e.target.value || null })}
                    />
                  </Field>
                </>
              )}
            </div>
          )}

          <ConditionEditor
            condition={field.condition ?? null}
            earlier={earlier.filter((f) => f.type !== 'section')}
            onChange={(condition) => update({ condition })}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-950/5 pt-4 dark:border-white/5">
            {!isSection ? (
              <SwitchField>
                <Label>{t('forms.builder.required')}</Label>
                <Switch color="brand" checked={field.required ?? false} onChange={(required) => update({ required })} />
              </SwitchField>
            ) : (
              <span />
            )}
            <div className="flex gap-1">
              <Button plain onClick={onDuplicate}>
                <DocumentDuplicateIcon />
                {t('forms.builder.duplicate')}
              </Button>
              <Button plain onClick={onRemove}>
                <TrashIcon className="fill-red-500!" />
                <span className="text-red-600 dark:text-red-400">{t('forms.builder.remove')}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </li>
  )
}

/** Answer options, reorderable by drag like the questions themselves. */
function OptionsEditor({
  dir,
  options,
  onChange,
  optionLabel,
}: {
  dir: 'ltr' | 'rtl'
  options: { id: string; label: string }[]
  onChange: (options: { id: string; label: string }[]) => void
  optionLabel: (n: number) => string
}) {
  const { t } = useLang()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const add = () => {
    const id = newId()
    onChange([...options, { id, label: optionLabel(options.length + 1) }])
    // Focus and select the new option's text so typing replaces the placeholder name.
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(`[data-option="${id}"]`)
      input?.focus()
      input?.select()
    })
  }
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = options.findIndex((o) => o.id === active.id)
    const to = options.findIndex((o) => o.id === over.id)
    onChange(arrayMove(options, from, to))
  }

  return (
    <fieldset>
      <legend className="text-base/6 font-medium text-zinc-950 sm:text-sm/6 dark:text-white">
        {t('forms.builder.options')}
      </legend>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={options.map((o) => o.id)} strategy={verticalListSortingStrategy}>
          <ul className="mt-3 space-y-2">
            {options.map((option, i) => (
              <OptionRow
                key={option.id}
                dir={dir}
                option={option}
                index={i}
                canRemove={options.length > 1}
                onChange={(label) => onChange(options.map((o) => (o.id === option.id ? { ...o, label } : o)))}
                onRemove={() => onChange(options.filter((o) => o.id !== option.id))}
                onEnter={i === options.length - 1 ? add : undefined}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <Button plain className="mt-2" onClick={add}>
        <PlusIcon />
        {t('forms.builder.addOption')}
      </Button>
    </fieldset>
  )
}

function OptionRow({
  dir,
  option,
  index,
  canRemove,
  onChange,
  onRemove,
  onEnter,
}: {
  dir: 'ltr' | 'rtl'
  option: { id: string; label: string }
  index: number
  canRemove: boolean
  onChange: (label: string) => void
  onRemove: () => void
  onEnter?: () => void
}) {
  const { t } = useLang()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: option.id,
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={clsx('flex items-center gap-1', isDragging && 'relative z-10')}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`${t('forms.builder.drag')}: ${option.label}`}
        className="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-950/5 focus-visible:outline-2 focus-visible:outline-brand-600 dark:hover:bg-white/10"
      >
        <GripIcon className="size-4" />
      </button>
      <Input
        data-option={option.id}
        dir={dir}
        aria-label={t('forms.builder.option', { n: index + 1 })}
        value={option.label}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onEnter?.()
          }
        }}
      />
      <Button plain disabled={!canRemove} aria-label={t('forms.builder.removeOption')} onClick={onRemove}>
        <XMarkIcon />
      </Button>
    </li>
  )
}

/** "Show this question only if …": rules on earlier questions, combined with all/any. */
function ConditionEditor({
  condition,
  earlier,
  onChange,
}: {
  condition: Condition | null
  earlier: DraftField[]
  onChange: (condition: Condition | null) => void
}) {
  const { t } = useLang()
  const blankRule = (): ConditionRule => {
    const source = earlier[earlier.length - 1]
    const op = opsFor(source.type)[0]
    return { fieldId: source.id, op, value: null }
  }

  if (!condition) {
    return (
      <div>
        <Button outline disabled={!earlier.length} onClick={() => onChange({ match: 'all', rules: [blankRule()] })}>
          <BoltIcon />
          {t('forms.builder.logic.title')}
        </Button>
        {!earlier.length && <p className="mt-2 text-sm/6 text-zinc-500">{t('forms.builder.logic.noEarlier')}</p>}
      </div>
    )
  }

  const setRule = (i: number, rule: ConditionRule) =>
    onChange({ ...condition, rules: condition.rules.map((r, j) => (j === i ? rule : r)) })
  const removeRule = (i: number) => {
    const rules = condition.rules.filter((_, j) => j !== i)
    onChange(rules.length ? { ...condition, rules } : null)
  }

  return (
    <fieldset className="rounded-lg bg-amber-50/60 p-4 ring-1 ring-amber-200/70 dark:bg-amber-950/20 dark:ring-amber-900/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <legend className="flex items-center gap-1.5 text-sm/6 font-semibold text-amber-900 dark:text-amber-200">
          <BoltIcon className="size-4" />
          {t('forms.builder.logic.title')}
        </legend>
        <Button plain onClick={() => onChange(null)}>
          {t('forms.builder.logic.removeAll')}
        </Button>
      </div>
      {condition.rules.length > 1 && (
        <div className="mt-3 flex items-center gap-2 text-sm/6 text-zinc-700 dark:text-zinc-300">
          <span>{t('forms.builder.logic.match')}</span>
          <Select
            aria-label={t('forms.builder.logic.match')}
            className="max-w-44"
            value={condition.match}
            onChange={(e) => onChange({ ...condition, match: e.target.value as 'all' | 'any' })}
          >
            <option value="all">{t('forms.builder.logic.all')}</option>
            <option value="any">{t('forms.builder.logic.any')}</option>
          </Select>
        </div>
      )}
      <ul className="mt-3 space-y-2">
        {condition.rules.map((rule, i) => (
          <RuleRow
            key={i}
            rule={rule}
            earlier={earlier}
            onChange={(r) => setRule(i, r)}
            onRemove={() => removeRule(i)}
          />
        ))}
      </ul>
      {condition.rules.length < 10 && (
        <Button
          plain
          className="mt-2"
          onClick={() => onChange({ ...condition, rules: [...condition.rules, blankRule()] })}
        >
          <PlusIcon />
          {t('forms.builder.logic.add')}
        </Button>
      )}
    </fieldset>
  )
}

function RuleRow({
  rule,
  earlier,
  onChange,
  onRemove,
}: {
  rule: ConditionRule
  earlier: DraftField[]
  onChange: (rule: ConditionRule) => void
  onRemove: () => void
}) {
  const { t } = useLang()
  const source = earlier.find((f) => f.id === rule.fieldId)
  const ops = source ? opsFor(source.type) : []

  let valueControl: React.ReactNode = null
  if (source && opNeedsValue(rule.op)) {
    if (source.type === 'yes_no' || hasOptions(source.type)) {
      const choices =
        source.type === 'yes_no'
          ? [
              { id: 'yes', label: t('record.yes') },
              { id: 'no', label: t('record.no') },
            ]
          : (source.options ?? [])
      valueControl = (
        <Select
          aria-label={t('forms.builder.logic.pickValue')}
          value={typeof rule.value === 'string' ? rule.value : ''}
          onChange={(e) => onChange({ ...rule, value: e.target.value || null })}
        >
          <option value="">{t('forms.builder.logic.pickValue')}</option>
          {choices.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label || '—'}
            </option>
          ))}
        </Select>
      )
    } else {
      valueControl = (
        <Input
          type="number"
          aria-label={t('forms.builder.logic.pickValue')}
          value={typeof rule.value === 'number' ? rule.value : ''}
          onChange={(e) => onChange({ ...rule, value: e.target.value === '' ? null : Number(e.target.value) })}
        />
      )
    }
  }

  return (
    <li className="grid items-center gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <Select
        aria-label={t('forms.builder.logic.pickQuestion')}
        value={source ? rule.fieldId : ''}
        onChange={(e) => {
          const next = earlier.find((f) => f.id === e.target.value)
          if (next) onChange({ fieldId: next.id, op: opsFor(next.type)[0] as ConditionOp, value: null })
        }}
      >
        {!source && <option value="">{t('forms.builder.logic.pickQuestion')}</option>}
        {earlier.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label || t('forms.builder.untitled')}
          </option>
        ))}
      </Select>
      <Select
        aria-label={t('forms.builder.logic.match')}
        value={rule.op}
        disabled={!source}
        onChange={(e) => {
          const op = e.target.value as ConditionOp
          onChange({ ...rule, op, value: opNeedsValue(op) ? rule.value : null })
        }}
      >
        {ops.map((op) => (
          <option key={op} value={op}>
            {t(`forms.builder.logic.ops.${op}`)}
          </option>
        ))}
      </Select>
      <div className="min-w-0">{valueControl}</div>
      <Button plain aria-label={t('forms.builder.logic.remove')} onClick={onRemove}>
        <XMarkIcon />
      </Button>
    </li>
  )
}
