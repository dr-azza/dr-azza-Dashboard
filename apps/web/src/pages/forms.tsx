import { Card, StatusBadge } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import { SidePanel } from '@/components/app/side-panel'
import { Field, FieldGroup, Label } from '@/components/catalyst/fieldset'
import { Heading } from '@/components/catalyst/heading'
import { Input } from '@/components/catalyst/input'
import { Radio, RadioField, RadioGroup } from '@/components/catalyst/radio'
import { Select } from '@/components/catalyst/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/catalyst/table'
import { Text } from '@/components/catalyst/text'
import { findPatient, formResponses, formTemplates, patients } from '@/data/mock'
import { useLang } from '@/i18n'
import { pregnancyInfo } from '@azza/shared'
import * as Headless from '@headlessui/react'
import { CheckCircleIcon, EyeIcon, PaperAirplaneIcon, PlusIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'

const RULES = [
  { key: 'ruleBp', tone: 'danger' },
  { key: 'ruleBleeding', tone: 'danger' },
  { key: 'ruleMovement', tone: 'danger' },
  { key: 'ruleHeadache', tone: 'danger' },
  { key: 'ruleSwelling', tone: 'warn' },
  { key: 'ruleQuestion', tone: 'info' },
] as const

const QUESTION_KEYS = ['feel', 'symptoms', 'bp', 'question'] as const

export function FormsPage() {
  const { t, l, lang } = useLang()
  const today = useMemo(() => new Date(), [])
  const [selected, setSelected] = useState(formTemplates[0].id)
  const [sendOpen, setSendOpen] = useState(false)
  const [sentCount, setSentCount] = useState<number | null>(null)
  const [channel, setChannel] = useState('whatsapp')

  const template = formTemplates.find((f) => f.id === selected)!
  const newCount = formResponses.filter((r) => r.status === 'flagged' || r.status === 'new').length
  // Default audience for the weekly check-in: every pregnancy in the third trimester.
  const audience = patients.filter((p) => pregnancyInfo(p, today)?.trimester === 3)

  useEffect(() => {
    if (sentCount === null) return
    const timer = setTimeout(() => setSentCount(null), 4000)
    return () => clearTimeout(timer)
  }, [sentCount])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <Heading className="headline">{t('forms.title')}</Heading>
          <Text className="mt-1">{t('forms.subtitle')}</Text>
        </div>
        <Button outline href="/f/demo-rana">
          <EyeIcon />
          {t('forms.openPatientView')}
        </Button>
        <Button color="brand">
          <PlusIcon />
          {t('forms.newForm')}
        </Button>
      </div>

      {sentCount !== null && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl bg-teal-50 px-5 py-3 text-sm/6 font-medium text-teal-900 ring-1 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900"
        >
          <CheckCircleIcon className="size-5 fill-teal-600" />
          {t('forms.sent', { count: sentCount })}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Card title={t('forms.templates')} bodyClassName="p-2 pt-0" className="self-start">
          <nav className="flex flex-col gap-0.5">
            {formTemplates.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={selected === f.id}
                onClick={() => setSelected(f.id)}
                className={clsx(
                  'rounded-lg px-3 py-2.5 text-start transition-colors',
                  selected === f.id ? 'bg-brand-50 dark:bg-brand-950/50' : 'hover:bg-zinc-50 dark:hover:bg-white/5',
                )}
              >
                <div
                  className={clsx(
                    'text-sm/6 font-semibold',
                    selected === f.id ? 'text-brand-700 dark:text-brand-300' : 'text-zinc-950 dark:text-white',
                  )}
                >
                  {l(f.name)}
                </div>
                <div className="text-xs/5 text-zinc-500 dark:text-zinc-400">
                  {t('forms.questionsCount', { count: f.questions })} · {l(f.meta)}
                </div>
              </button>
            ))}
          </nav>
        </Card>

        <Card
          title={<span className="text-lg/7 sm:text-base/7">{l(template.name)}</span>}
          action={
            <Button color="brand" onClick={() => setSendOpen(true)}>
              <PaperAirplaneIcon className="rtl:-scale-x-100" />
              {t('forms.sendForm')}
            </Button>
          }
          bodyClassName="px-5 pb-4"
        >
          <Headless.TabGroup>
            <Headless.TabList className="flex gap-1 border-b border-zinc-950/10 dark:border-white/10">
              {[t('forms.tabResponses', { count: newCount }), t('forms.tabQuestions'), t('forms.tabRules')].map(
                (label) => (
                  <Headless.Tab
                    key={label}
                    className="-mb-px border-b-2 border-transparent px-3 py-2.5 text-sm/6 font-medium text-zinc-500 focus:outline-hidden data-focus:outline-2 data-focus:outline-brand-600 data-hover:text-zinc-950 data-selected:border-brand-600 data-selected:text-brand-700 dark:text-zinc-400 dark:data-selected:text-brand-300"
                  >
                    {label}
                  </Headless.Tab>
                ),
              )}
            </Headless.TabList>
            <Headless.TabPanels className="pt-2">
              <Headless.TabPanel>
                <Table dense className="[--gutter:--spacing(5)]">
                  <TableHead>
                    <TableRow>
                      <TableHeader>{t('forms.colPatient')}</TableHeader>
                      <TableHeader className="max-sm:hidden">{t('forms.colAnswered')}</TableHeader>
                      <TableHeader>{t('forms.colStandsOut')}</TableHeader>
                      <TableHeader>{t('forms.colStatus')}</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {formResponses.map((r) => {
                      const p = findPatient(r.patientId)!
                      const info = pregnancyInfo(p, today)
                      return (
                        <TableRow
                          key={r.patientId}
                          href={`/patients?q=${encodeURIComponent(p.name.en)}`}
                          title={l(p.name)}
                        >
                          <TableCell>
                            <div className="font-medium">{l(p.name)}</div>
                            <div className="text-xs/5 text-zinc-500">
                              {info && t('common.ga', { w: info.weeks, d: info.days })}
                            </div>
                          </TableCell>
                          <TableCell className="text-zinc-500 max-sm:hidden">{l(r.when)}</TableCell>
                          <TableCell
                            className={clsx(
                              'whitespace-normal',
                              r.status === 'flagged'
                                ? 'font-semibold text-red-700 dark:text-red-400'
                                : 'text-zinc-600 dark:text-zinc-400',
                            )}
                          >
                            {l(r.summary)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge kind="response" status={r.status} />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Headless.TabPanel>

              <Headless.TabPanel>
                <ol className="mt-2 space-y-2">
                  {QUESTION_KEYS.map((key, i) => (
                    <li
                      key={key}
                      className="flex items-center gap-3 rounded-lg bg-zinc-50 px-4 py-3 text-sm/6 dark:bg-white/5"
                    >
                      <span className="flex size-6 items-center justify-center rounded-full bg-white text-xs font-semibold ring-1 ring-zinc-950/10 dark:bg-zinc-800">
                        {i + 1}
                      </span>
                      {t(`publicForm.${key}`)}
                    </li>
                  ))}
                </ol>
              </Headless.TabPanel>

              <Headless.TabPanel>
                <Text className="mt-2">{t('forms.rulesIntro')}</Text>
                <div className="mt-4 flex flex-wrap gap-2">
                  {RULES.map((r) => (
                    <span
                      key={r.key}
                      className={clsx(
                        'rounded-full px-3 py-1.5 text-sm/5 font-semibold',
                        r.tone === 'danger' && 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
                        r.tone === 'warn' && 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
                        r.tone === 'info' && 'bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
                      )}
                    >
                      {t(`forms.${r.key}`)}
                    </span>
                  ))}
                </div>
              </Headless.TabPanel>
            </Headless.TabPanels>
          </Headless.TabGroup>
        </Card>
      </div>

      <SidePanel
        open={sendOpen}
        onClose={setSendOpen}
        size="lg"
        title={t('forms.sendTitle', { form: l(template.name) })}
        description={<>{t('forms.sendDescription')}</>}
        actions={
          <>
            <Button plain onClick={() => setSendOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              color="brand"
              onClick={() => {
                setSendOpen(false)
                setSentCount(audience.length)
              }}
            >
              {t('common.send')} · {audience.length}
            </Button>
          </>
        }
      >
        <FieldGroup>
          <Field>
            <Label>{t('forms.recipients')}</Label>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {audience.map((p) => (
                <span
                  key={p.id}
                  className="rounded-md bg-brand-50 px-2 py-1 text-sm/5 font-medium text-brand-700 dark:bg-brand-950/50 dark:text-brand-300"
                >
                  {l(p.name)}
                </span>
              ))}
            </div>
            <Input className="mt-3" placeholder={t('forms.recipientsPlaceholder')} />
          </Field>

          <Field>
            <Label>{t('forms.channel')}</Label>
            <RadioGroup value={channel} onChange={setChannel} className="mt-3">
              {(['whatsapp', 'sms', 'copyLink'] as const).map((c) => (
                <RadioField key={c}>
                  <Radio value={c} color="brand" />
                  <Label>{t(`forms.${c}`)}</Label>
                </RadioField>
              ))}
            </RadioGroup>
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field>
              <Label>{t('forms.expires')}</Label>
              <Select defaultValue="7d">
                <option value="24h">{t('forms.expires24h')}</option>
                <option value="7d">{t('forms.expires7d')}</option>
                <option value="30d">{t('forms.expires30d')}</option>
              </Select>
            </Field>
            <Field>
              <Label>{t('forms.repeat')}</Label>
              <Select defaultValue="weekly">
                <option value="once">{t('forms.repeatOnce')}</option>
                <option value="weekly">{t('forms.repeatWeekly')}</option>
                <option value="biweekly">{t('forms.repeatBiweekly')}</option>
              </Select>
            </Field>
          </div>

          <Field>
            <Label>{t('forms.preview')}</Label>
            <div className="mt-3 rounded-xl rounded-ss-sm bg-teal-50 px-4 py-3 text-sm/6 text-zinc-800 ring-1 ring-teal-100 dark:bg-teal-950/40 dark:text-zinc-200 dark:ring-teal-900">
              {t('forms.previewText', {
                name: audience[0] ? l(audience[0].name).split(' ')[0] : '',
                link: `clinic.link/f/${lang}-•••`,
              })}
            </div>
          </Field>
        </FieldGroup>
      </SidePanel>
    </div>
  )
}
