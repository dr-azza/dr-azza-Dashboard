import { RequestError, useFormat } from '@/components/app/form'
import { SidePanel } from '@/components/app/side-panel'
import { ToneBadge } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import {
  Dropdown,
  DropdownButton,
  DropdownDescription,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '@/components/catalyst/dropdown'
import { Description, Field, FieldGroup, Label } from '@/components/catalyst/fieldset'
import { Heading } from '@/components/catalyst/heading'
import { Input } from '@/components/catalyst/input'
import { Link } from '@/components/catalyst/link'
import { Select } from '@/components/catalyst/select'
import { Switch, SwitchField } from '@/components/catalyst/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/catalyst/table'
import { Text } from '@/components/catalyst/text'
import { Textarea } from '@/components/catalyst/textarea'
import {
  type DraftField,
  duplicateField,
  FIELD_ICONS,
  fieldIssues,
  newField,
  removeField,
  replaceField,
  TYPE_MENU,
} from '@/components/forms/builder-model'
import { CopyLinkButton } from '@/components/forms/copy-link-button'
import { FormRenderer } from '@/components/forms/form-renderer'
import { QuestionEditor } from '@/components/forms/question-editor'
import { ResponsePanel } from '@/components/forms/response-panel'
import { useLang } from '@/i18n'
import { ApiError } from '@/lib/api'
import { formLinkUrl, useForm, useResponses, useUpdateForm } from '@/lib/queries'
import { FORM_LIMITS, type FormDto, type FormField, type FormLanguage, UpdateFormSchema } from '@azza/shared'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import {
  ArchiveBoxIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  ChevronLeftIcon,
  EyeIcon,
  LinkIcon,
  PlusIcon,
} from '@heroicons/react/16/solid'
import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import i18n from 'i18next'
import { useEffect, useMemo, useState } from 'react'
import { useBlocker, useParams, useSearchParams } from 'react-router'

interface Draft {
  title: string
  description: string | null
  language: FormLanguage
  fields: DraftField[]
}

const draftOf = (f: FormDto): Draft => ({
  title: f.title,
  description: f.description,
  language: f.language,
  fields: structuredClone(f.fields),
})

const TABS = ['questions', 'responses'] as const

export function FormEditorPage() {
  const { formId = '' } = useParams()
  const { t } = useLang()
  const form = useForm(formId)
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((k) => k === params.get('tab')) ?? 'questions'

  if (form.isPending) return <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/5" />
  if (form.isError) {
    return (
      <div className="space-y-4 py-16 text-center">
        <RequestError error={form.error} className="mx-auto max-w-md text-start" />
        <Button href="/forms" plain>
          {t('forms.back')}
        </Button>
      </div>
    )
  }
  return (
    <Editor
      // A fresh editor per form, so opening another form never carries a draft over.
      key={form.data.id}
      form={form.data}
      tab={tab}
      onTab={(key) => setParams(key === 'questions' ? {} : { tab: key }, { replace: true })}
    />
  )
}

function Editor({
  form,
  tab,
  onTab,
}: {
  form: FormDto
  tab: (typeof TABS)[number]
  onTab: (tab: (typeof TABS)[number]) => void
}) {
  const { t } = useLang()
  const { save } = useUpdateForm(form.id)
  // `base` is what the server has; the draft is compared with it to know what is unsaved.
  const [base, setBase] = useState(() => draftOf(form))
  const [draft, setDraft] = useState(() => draftOf(form))
  const [openId, setOpenId] = useState<string | null>(null)
  const [showIssues, setShowIssues] = useState(false)
  const [titleError, setTitleError] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(base), [draft, base])
  const issues = useMemo(() => fieldIssues(draft.fields), [draft.fields])
  const issueCount = Object.keys(issues).length

  useUnsavedGuard(dirty, t('forms.leaveUnsaved'))
  useEffect(() => {
    if (dirty) setSaved(false)
  }, [dirty])

  const onSave = async () => {
    setShowIssues(true)
    const parsed = UpdateFormSchema.safeParse({ ...draft, expectedVersion: form.version })
    const badTitle = !parsed.success && parsed.error.issues.some((i) => i.path[0] === 'title')
    setTitleError(badTitle)
    setInvalid(!parsed.success)
    if (!parsed.success) {
      // Open the first question with a problem so it's visible.
      const first = draft.fields.find((f) => issues[f.id])
      if (first) setOpenId(first.id)
      return
    }
    try {
      const next = await save.mutateAsync(parsed.data)
      setBase(draftOf(next))
      setDraft(draftOf(next))
      setSaved(true)
    } catch {
      // Shown below (a conflict gets its own message with a reload button).
    }
  }

  // The form's own language names new options ("Option 1"), not the staff member's.
  const ft = useMemo(() => i18n.getFixedT(draft.language), [draft.language])
  const optionLabel = (n: number) => ft('forms.builder.option', { n })

  return (
    <div className="space-y-6">
      <Link
        href="/forms"
        className="inline-flex items-center gap-1 text-sm/6 font-medium text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
      >
        <ChevronLeftIcon className="size-4 fill-zinc-400 rtl:rotate-180" />
        {t('forms.back')}
      </Link>

      {/* Header stays in reach while scrolling a long form. */}
      <div className="sticky top-0 z-20 -mx-2 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/90 px-4 py-3 ring-1 ring-zinc-950/8 backdrop-blur lg:-mx-4 dark:bg-zinc-900/90 dark:ring-white/10">
        <div className="min-w-0">
          <Heading className="truncate">
            <bdi>{draft.title || t('forms.createTitle')}</bdi>
          </Heading>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs/5 text-zinc-500">
            <ToneBadge tone={form.acceptingResponses ? 'ok' : 'neutral'}>
              {form.archived
                ? t('forms.archivedTab')
                : form.acceptingResponses
                  ? t('forms.accepting')
                  : t('forms.closed')}
            </ToneBadge>
            <span>{t('forms.version', { n: form.version })}</span>
            <span aria-hidden="true">·</span>
            <span>{t(`forms.languages.${draft.language}`)}</span>
            {dirty && <span className="font-medium text-amber-700 dark:text-amber-400">· {t('forms.unsaved')}</span>}
            {!dirty && saved && (
              <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                <CheckIcon className="size-3.5" />
                {t('forms.saved')}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button outline onClick={() => setPreviewing(true)}>
            <EyeIcon />
            {t('forms.preview')}
          </Button>
          <Button outline onClick={() => setSharing(true)}>
            <LinkIcon />
            {t('forms.share')}
          </Button>
          <Button color="brand" disabled={!dirty || save.isPending} onClick={onSave}>
            {save.isPending ? t('forms.saving') : t('forms.save')}
          </Button>
        </div>
      </div>

      {showIssues && (issueCount > 0 || invalid) && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm/6 font-medium text-red-800 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900"
        >
          {t('forms.fixErrors')}
        </p>
      )}
      {save.error instanceof ApiError && save.error.status === 409 ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm/6 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900"
        >
          {t('forms.conflict')}
          <Button outline onClick={() => window.location.reload()}>
            {t('errors.reload')}
          </Button>
        </div>
      ) : (
        <RequestError error={save.error} />
      )}

      <Headless.TabGroup selectedIndex={TABS.indexOf(tab)} onChange={(i) => onTab(TABS[i])}>
        <Headless.TabList className="flex gap-1 border-b border-zinc-950/10 dark:border-white/10">
          {TABS.map((key) => (
            <Headless.Tab
              key={key}
              className="-mb-px border-b-2 border-transparent px-3 py-2.5 text-sm/6 font-medium text-zinc-500 focus:outline-hidden data-focus:outline-2 data-focus:outline-brand-600 data-hover:text-zinc-950 data-selected:border-brand-600 data-selected:text-brand-700 dark:text-zinc-400 dark:data-hover:text-white dark:data-selected:text-brand-300"
            >
              {t(`forms.tabs.${key}`)}
              {key === 'responses' && form.responseCount > 0 && (
                <span className="ms-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs/5 tabular-nums dark:bg-white/10">
                  {form.responseCount}
                </span>
              )}
            </Headless.Tab>
          ))}
        </Headless.TabList>
        <Headless.TabPanels className="pt-6">
          <Headless.TabPanel>
            <div className="mx-auto max-w-3xl space-y-6">
              <DetailsCard
                draft={draft}
                titleError={titleError}
                onChange={(patch) => {
                  if (patch.title) setTitleError(false)
                  setDraft((d) => ({ ...d, ...patch }))
                }}
              />
              <QuestionList
                fields={draft.fields}
                openId={openId}
                issues={showIssues ? issues : {}}
                optionLabel={optionLabel}
                dir={draft.language === 'ar' ? 'rtl' : 'ltr'}
                onOpen={setOpenId}
                onChange={(fields) => setDraft((d) => ({ ...d, fields }))}
              />
            </div>
          </Headless.TabPanel>
          <Headless.TabPanel>
            <ResponsesTab formId={form.id} />
          </Headless.TabPanel>
        </Headless.TabPanels>
      </Headless.TabGroup>

      <SharePanel open={sharing} form={form} dirty={dirty} onClose={() => setSharing(false)} />
      <SidePanel
        open={previewing}
        onClose={() => setPreviewing(false)}
        size="2xl"
        title={t('forms.previewTitle')}
        description={t('forms.previewNote')}
      >
        {previewing && (
          <div className="rounded-2xl bg-seashell p-4 sm:p-6 dark:bg-zinc-950">
            <h2 className="mb-1 text-2xl/8 font-bold text-zinc-950 dark:text-white" dir="auto">
              {draft.title}
            </h2>
            {draft.description && (
              <p className="mb-6 text-base/7 whitespace-pre-line text-zinc-600 dark:text-zinc-300" dir="auto">
                {draft.description}
              </p>
            )}
            {/* Preview only what would validate; broken questions can't be answered anyway. */}
            <FormRenderer
              fields={draft.fields.filter((f) => !issues[f.id]) as FormField[]}
              language={draft.language}
              askIdentity
            />
          </div>
        )}
      </SidePanel>
    </div>
  )
}

/** Warns before leaving with unsaved changes: in-app navigation and closing the tab. */
function useUnsavedGuard(dirty: boolean, message: string) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    // A native confirm is the one dialog every browser guarantees to be able to block with.
    if (window.confirm(message)) blocker.proceed()
    else blocker.reset()
  }, [blocker, message])
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])
}

function DetailsCard({
  draft,
  titleError,
  onChange,
}: {
  draft: Draft
  titleError: boolean
  onChange: (patch: Partial<Draft>) => void
}) {
  const { t } = useLang()
  const dir = draft.language === 'ar' ? 'rtl' : 'ltr'
  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-zinc-950/8 sm:p-6 dark:bg-zinc-900 dark:ring-white/10">
      <FieldGroup>
        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <Field>
            <Label>{t('forms.formTitle')}</Label>
            <Input
              dir={dir}
              maxLength={FORM_LIMITS.title}
              value={draft.title}
              invalid={titleError}
              onChange={(e) => onChange({ title: e.target.value })}
            />
            {titleError && <p className="mt-2 text-sm/6 text-red-600">{t('forms.builder.errors.title')}</p>}
          </Field>
          <Field>
            <Label>{t('forms.language')}</Label>
            <Select value={draft.language} onChange={(e) => onChange({ language: e.target.value as FormLanguage })}>
              <option value="ar">{t('forms.languages.ar')}</option>
              <option value="en">{t('forms.languages.en')}</option>
            </Select>
          </Field>
        </div>
        <Field>
          <Label>{t('forms.description')}</Label>
          <Textarea
            rows={2}
            dir={dir}
            maxLength={FORM_LIMITS.description}
            placeholder={t('forms.descriptionPlaceholder')}
            value={draft.description ?? ''}
            onChange={(e) => onChange({ description: e.target.value || null })}
          />
          <Description>{t('forms.languageHint')}</Description>
        </Field>
      </FieldGroup>
    </section>
  )
}

function QuestionList({
  fields,
  openId,
  issues,
  optionLabel,
  dir,
  onOpen,
  onChange,
}: {
  dir: 'ltr' | 'rtl'
  fields: DraftField[]
  openId: string | null
  issues: Record<string, string[]>
  optionLabel: (n: number) => string
  onOpen: (id: string | null) => void
  onChange: (fields: DraftField[]) => void
}) {
  const { t } = useLang()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    onChange(
      arrayMove(
        fields,
        fields.findIndex((f) => f.id === active.id),
        fields.findIndex((f) => f.id === over.id),
      ),
    )
  }
  const add = (type: DraftField['type']) => {
    const field = newField(type, optionLabel)
    // Insert right after the open question, or at the end.
    const at = openId ? fields.findIndex((f) => f.id === openId) + 1 : fields.length
    onChange([...fields.slice(0, at), field, ...fields.slice(at)])
    onOpen(field.id)
    requestAnimationFrame(() =>
      document.getElementById(`question-${field.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    )
  }

  // Numbers count answerable questions only (sections have none).
  let n = 0
  return (
    <section className="space-y-3">
      {fields.length === 0 && (
        <p className="rounded-xl border-2 border-dashed border-zinc-950/10 px-6 py-10 text-center text-sm/6 text-zinc-500 dark:border-white/10">
          {t('forms.builder.noQuestions')}
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <ol className="space-y-3">
            {fields.map((field, i) => {
              if (field.type !== 'section') n += 1
              return (
                <QuestionEditor
                  key={field.id}
                  field={field}
                  index={n}
                  earlier={fields.slice(0, i)}
                  open={openId === field.id}
                  issues={issues[field.id]}
                  optionLabel={optionLabel}
                  dir={dir}
                  onToggle={() => onOpen(openId === field.id ? null : field.id)}
                  onChange={(updated) => onChange(replaceField(fields, updated))}
                  onDuplicate={() => {
                    const next = duplicateField(fields, field.id)
                    onChange(next)
                    onOpen(next[i + 1].id)
                  }}
                  onRemove={() => {
                    onChange(removeField(fields, field.id))
                    if (openId === field.id) onOpen(null)
                  }}
                />
              )
            })}
          </ol>
        </SortableContext>
      </DndContext>

      <Dropdown>
        <DropdownButton color="brand" className="w-full justify-center py-2.5!">
          <PlusIcon />
          {t('forms.builder.addQuestion')}
        </DropdownButton>
        <DropdownMenu anchor="bottom" className="min-w-72">
          {TYPE_MENU.map((group, g) => [
            g > 0 && <DropdownDivider key={`d${g}`} />,
            ...group.map((type) => {
              const Icon = FIELD_ICONS[type]
              return (
                <DropdownItem key={type} onClick={() => add(type)}>
                  <Icon />
                  <DropdownLabel>{t(`forms.builder.types.${type}`)}</DropdownLabel>
                  <DropdownDescription>{t(`forms.builder.typeHints.${type}`)}</DropdownDescription>
                </DropdownItem>
              )
            }),
          ])}
        </DropdownMenu>
      </Dropdown>
    </section>
  )
}

function SharePanel({
  open,
  form,
  dirty,
  onClose,
}: {
  open: boolean
  form: FormDto
  dirty: boolean
  onClose: () => void
}) {
  const { t } = useLang()
  const { save, rotate } = useUpdateForm(form.id)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const url = formLinkUrl(form.publicToken)

  return (
    <SidePanel open={open} onClose={onClose} size="lg" title={t('forms.shareTitle')}>
      <div className="space-y-8">
        {dirty && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm/6 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900">
            {t('forms.unsavedShare')}
          </p>
        )}
        <section>
          <h3 className="text-sm/6 font-semibold text-zinc-950 dark:text-white">{t('forms.sharedLink')}</h3>
          <Text className="mt-1">{t('forms.sharedLinkHint')}</Text>
          <div className="mt-3 flex items-center gap-2">
            <Input
              className="min-w-0 flex-1"
              readOnly
              value={url}
              dir="ltr"
              aria-label={t('forms.sharedLink')}
              onFocus={(e) => e.currentTarget.select()}
            />
            <CopyLinkButton url={url} disabled={form.archived} />
          </div>
          <Button plain href={url} target="_blank" className="mt-2">
            <ArrowTopRightOnSquareIcon />
            {t('forms.open')}
          </Button>
        </section>

        <SwitchField>
          <Label>{t('forms.acceptingLabel')}</Label>
          <Description>{t('forms.acceptingHint')}</Description>
          <Switch
            color="brand"
            checked={form.acceptingResponses}
            disabled={save.isPending || form.archived}
            onChange={(acceptingResponses) => save.mutate({ acceptingResponses })}
          />
        </SwitchField>

        <section>
          <h3 className="text-sm/6 font-semibold text-zinc-950 dark:text-white">{t('forms.rotate')}</h3>
          <Text className="mt-1">{t('forms.rotateHint')}</Text>
          {confirmRotate ? (
            <div className="mt-3 rounded-lg bg-red-50 p-3 dark:bg-red-950/40">
              <p className="text-sm/6 text-red-800 dark:text-red-200">{t('forms.rotateConfirm')}</p>
              <div className="mt-2 flex gap-2">
                <Button
                  color="red"
                  disabled={rotate.isPending}
                  onClick={async () => {
                    await rotate.mutateAsync()
                    setConfirmRotate(false)
                  }}
                >
                  {t('forms.rotateYes')}
                </Button>
                <Button plain onClick={() => setConfirmRotate(false)}>
                  {t('record.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Button outline className="mt-3" onClick={() => setConfirmRotate(true)}>
              <ArrowPathIcon />
              {t('forms.rotate')}
            </Button>
          )}
        </section>

        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm/6 text-brand-900 dark:bg-brand-950/40 dark:text-brand-100">
          {t('forms.personalHint')}
        </p>

        <section className="border-t border-zinc-950/5 pt-6 dark:border-white/5">
          <Text>{t('forms.archiveHint')}</Text>
          <Button
            outline
            className="mt-3"
            disabled={save.isPending}
            onClick={() => save.mutate({ archived: !form.archived })}
          >
            <ArchiveBoxIcon />
            {form.archived ? t('forms.restore') : t('forms.archive')}
          </Button>
        </section>
        <RequestError error={save.error ?? rotate.error} />
      </div>
    </SidePanel>
  )
}

const FILTERS = ['new', 'reviewed', 'all'] as const

function ResponsesTab({ formId }: { formId: string }) {
  const { t } = useLang()
  const fmt = useFormat()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('new')
  const [openId, setOpenId] = useState<string | null>(null)
  const responses = useResponses({ formId, status: filter === 'all' ? undefined : filter })
  const items = responses.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-white/5" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={clsx(
              'rounded-md px-3 py-1.5 text-sm/5 font-medium',
              filter === f
                ? 'bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-white'
                : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-white',
            )}
          >
            {t(`forms.responses.filter${f[0].toUpperCase()}${f.slice(1)}`)}
          </button>
        ))}
      </div>
      <RequestError error={responses.error} />
      {responses.isSuccess && items.length === 0 && (
        <p className="rounded-xl bg-white px-6 py-12 text-center text-sm/6 text-zinc-500 ring-1 ring-zinc-950/8 dark:bg-zinc-900 dark:ring-white/10">
          {filter === 'new' ? t('forms.responses.emptyNew') : t('forms.responses.empty')}
        </p>
      )}
      {items.length > 0 && (
        <Table className="[--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]">
          <TableHead>
            <TableRow>
              <TableHeader>{t('forms.responses.submitted')}</TableHeader>
              <TableHeader>{t('forms.responses.from')}</TableHeader>
              <TableHeader className="max-sm:hidden">{t('forms.responses.status')}</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
                <TableCell className="tabular-nums">
                  <button
                    type="button"
                    className="text-start font-medium focus-visible:outline-2 focus-visible:outline-brand-600"
                    onClick={() => setOpenId(r.id)}
                  >
                    {fmt.dayTime(r.submittedAt)}
                  </button>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{r.patient?.fullName ?? r.respondentName ?? '—'}</div>
                  <div className="text-xs/5 text-zinc-500">
                    {r.patient ? t(`forms.responses.match.${r.matchedBy ?? 'STAFF'}`) : t('forms.responses.notLinked')}
                  </div>
                </TableCell>
                <TableCell className="max-sm:hidden">
                  <ToneBadge tone={r.reviewedAt ? 'neutral' : 'danger'}>
                    {r.reviewedAt ? t('forms.responses.reviewed') : t('forms.responses.new')}
                  </ToneBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {responses.hasNextPage && (
        <div className="flex justify-center">
          <Button outline onClick={() => responses.fetchNextPage()} disabled={responses.isFetchingNextPage}>
            {t('forms.responses.loadMore')}
          </Button>
        </div>
      )}
      <ResponsePanel responseId={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}
