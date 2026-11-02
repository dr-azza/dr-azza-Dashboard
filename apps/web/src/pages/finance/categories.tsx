import { RequestError } from '@/components/app/form'
import { Card } from '@/components/app/ui'
import { SidePanel } from '@/components/app/side-panel'
import { Badge } from '@/components/catalyst/badge'
import { Button } from '@/components/catalyst/button'
import { Field, FieldGroup, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { useLang } from '@/i18n'
import { useCreateFinanceCategory, useFinanceCategories, useUpdateFinanceCategory } from '@/lib/queries'
import { CreateFinanceCategorySchema, type FinanceCategoryDto, type FinanceKindCode } from '@azza/shared'
import { PlusIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import { FinanceGate, FinancePageHeader } from './shared'

export function FinanceCategoriesPage() {
  return (
    <FinanceGate>
      <Categories />
    </FinanceGate>
  )
}

function Categories() {
  const { t } = useLang()
  const categories = useFinanceCategories(true)
  const update = useUpdateFinanceCategory()
  const [panel, setPanel] = useState<{ kind: FinanceKindCode; category?: FinanceCategoryDto } | null>(null)

  return (
    <div className="space-y-6">
      <FinancePageHeader title={t('finance.categories.title')} subtitle={t('finance.categories.subtitle')} />
      <RequestError error={categories.error ?? update.error} />
      <div className="grid gap-4 lg:grid-cols-2">
        {(['EXPENSE', 'INCOME'] as const).map((kind) => (
          <Card
            key={kind}
            title={t(kind === 'EXPENSE' ? 'finance.categories.expense' : 'finance.categories.income')}
            action={
              <Button plain onClick={() => setPanel({ kind })}>
                <PlusIcon />
                {t('finance.categories.add')}
              </Button>
            }
            bodyClassName="pb-1"
          >
            <ul className="divide-y divide-zinc-950/5 border-t border-zinc-950/5 dark:divide-white/5 dark:border-white/5">
              {categories.data
                ?.filter((c) => c.kind === kind)
                .map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-2.5">
                    <button
                      type="button"
                      onClick={() => setPanel({ kind, category: c })}
                      className="min-w-0 flex-1 rounded text-start focus-visible:outline-2 focus-visible:outline-brand-600"
                    >
                      <span
                        className={
                          c.archived ? 'text-sm/6 text-zinc-500' : 'text-sm/6 font-medium text-zinc-950 dark:text-white'
                        }
                      >
                        {c.name.en}
                      </span>
                      <span lang="ar" className="ms-2 text-sm/6 text-zinc-500">
                        {c.name.ar}
                      </span>
                    </button>
                    {c.archived && <Badge color="zinc">{t('finance.categories.archived')}</Badge>}
                    <Button
                      plain
                      disabled={update.isPending}
                      onClick={() => update.mutate({ categoryId: c.id, archived: !c.archived })}
                    >
                      {c.archived ? t('finance.categories.restore') : t('finance.categories.archive')}
                    </Button>
                  </li>
                ))}
            </ul>
          </Card>
        ))}
      </div>
      {panel && <CategoryPanel key={panel.category?.id ?? panel.kind} {...panel} onClose={() => setPanel(null)} />}
    </div>
  )
}

function CategoryPanel({
  kind,
  category,
  onClose,
}: {
  kind: FinanceKindCode
  category?: FinanceCategoryDto
  onClose: () => void
}) {
  const { t } = useLang()
  const create = useCreateFinanceCategory()
  const update = useUpdateFinanceCategory()
  const [formError, setFormError] = useState<string | null>(null)

  return (
    <SidePanel
      open
      onClose={onClose}
      size="md"
      title={category ? t('finance.categories.edit') : t('finance.categories.add')}
      noValidate
      onSubmit={async (event) => {
        event.preventDefault()
        const f = new FormData(event.currentTarget)
        const parsed = CreateFinanceCategorySchema.safeParse({
          kind,
          nameEn: String(f.get('nameEn') ?? ''),
          nameAr: String(f.get('nameAr') ?? ''),
        })
        if (!parsed.success) return setFormError(parsed.error.issues[0]?.message ?? '')
        setFormError(null)
        if (category) {
          await update.mutateAsync({ categoryId: category.id, nameEn: parsed.data.nameEn, nameAr: parsed.data.nameAr })
        } else {
          await create.mutateAsync(parsed.data)
        }
        onClose()
      }}
      actions={
        <>
          <Button plain onClick={onClose}>
            {t('record.cancel')}
          </Button>
          <Button type="submit" color="brand" disabled={create.isPending || update.isPending}>
            {t('record.save')}
          </Button>
        </>
      }
    >
      <FieldGroup>
        <Field>
          <Label>{t('finance.categories.nameEn')}</Label>
          <Input name="nameEn" defaultValue={category?.name.en ?? ''} autoFocus maxLength={60} dir="ltr" />
        </Field>
        <Field>
          <Label>{t('finance.categories.nameAr')}</Label>
          <Input name="nameAr" defaultValue={category?.name.ar ?? ''} maxLength={60} dir="rtl" lang="ar" />
        </Field>
        {formError && <RequestError error={new Error(formError)} />}
        <RequestError error={create.error ?? update.error} />
      </FieldGroup>
    </SidePanel>
  )
}
