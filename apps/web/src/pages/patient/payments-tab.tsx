import { RequestError, strOrNull, toLocalInputValue, useFormat } from '@/components/app/form'
import { Card } from '@/components/app/ui'
import { Badge } from '@/components/catalyst/badge'
import { Button } from '@/components/catalyst/button'
import { SidePanel } from '@/components/app/side-panel'
import { Description, Field, FieldGroup, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Select } from '@/components/catalyst/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/catalyst/table'
import { Text } from '@/components/catalyst/text'
import { useLang } from '@/i18n'
import { attachmentUrl } from '@/lib/api'
import { useCreatePayment, usePayments, useUploadAttachment, useVoidPayment } from '@/lib/queries'
import {
  ALLOWED_UPLOAD_TYPES,
  CreatePaymentSchema,
  MAX_UPLOAD_BYTES,
  PAYMENT_METHODS,
  type PaymentDto,
} from '@azza/shared'
import { PaperClipIcon, PlusIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useRef, useState } from 'react'

export function PaymentsTab({ patientId }: { patientId: string }) {
  const { t } = useLang()
  const fmt = useFormat()
  const payments = usePayments(patientId)
  const [open, setOpen] = useState(false)
  const [voiding, setVoiding] = useState<PaymentDto | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="rounded-xl bg-white px-5 py-3 ring-1 ring-zinc-950/8 dark:bg-zinc-900 dark:ring-white/10">
          <div className="text-xs/5 text-zinc-500 dark:text-zinc-400">{t('record.payments.totalPaid')}</div>
          <div className="text-2xl/8 font-semibold tabular-nums">
            {payments.data ? fmt.money(payments.data.totalPaid) : '—'}
          </div>
        </div>
        <Button color="brand" className="ms-auto" onClick={() => setOpen(true)}>
          <PlusIcon />
          {t('record.payments.record')}
        </Button>
      </div>
      <RequestError error={payments.error} />
      {payments.data?.items.length === 0 && <Text>{t('record.payments.none')}</Text>}
      {!!payments.data?.items.length && (
        <Card bodyClassName="px-5 py-2">
          <Table dense className="[--gutter:--spacing(5)]">
            <TableHead>
              <TableRow>
                <TableHeader>{t('record.payments.paidAt')}</TableHeader>
                <TableHeader>{t('record.payments.amountShort')}</TableHeader>
                <TableHeader>{t('record.payments.method')}</TableHeader>
                <TableHeader>{t('record.payments.purpose')}</TableHeader>
                <TableHeader>{t('record.payments.proof')}</TableHeader>
                <TableHeader />
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.data.items.map((p) => {
                const voided = !!p.voidedAt
                return (
                  <TableRow key={p.id} className={clsx(voided && 'opacity-60')}>
                    <TableCell className="tabular-nums">
                      {fmt.day(p.paidAt)}
                      {p.receivedBy && <div className="text-xs/5 text-zinc-500">{p.receivedBy.fullName}</div>}
                    </TableCell>
                    <TableCell className={clsx('font-semibold tabular-nums', voided && 'line-through')}>
                      {fmt.money(p.amount, p.currency)}
                    </TableCell>
                    <TableCell>{t(`record.payments.methods.${p.method}`)}</TableCell>
                    <TableCell className="whitespace-normal">
                      {p.purpose}
                      {p.reference && (
                        <div className="text-xs/5 text-zinc-500" dir="ltr">
                          #{p.reference}
                        </div>
                      )}
                      {voided && (
                        <div className="text-xs/5 text-zinc-500">
                          <Badge color="zinc">{t('record.payments.voided')}</Badge> {p.voidReason}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.proofs.length ? (
                        <div className="flex flex-col gap-1">
                          {p.proofs.map((f) => (
                            <a
                              key={f.id}
                              href={attachmentUrl(patientId, f.id)}
                              target="_blank"
                              rel="noopener"
                              className="inline-flex items-center gap-1 text-sm/6 font-medium text-brand-700 hover:underline dark:text-brand-300"
                            >
                              <PaperClipIcon className="size-4" />
                              {t('record.payments.viewProof')}
                            </a>
                          ))}
                        </div>
                      ) : (
                        !voided && <ProofUpload patientId={patientId} paymentId={p.id} />
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      {!voided && (
                        <Button plain onClick={() => setVoiding(p)}>
                          {t('record.payments.void')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
      {open && <NewPaymentDialog patientId={patientId} onClose={() => setOpen(false)} />}
      {voiding && <VoidPaymentDialog patientId={patientId} payment={voiding} onClose={() => setVoiding(null)} />}
    </div>
  )
}

/** Inline "Attach proof" for a payment recorded without one. */
function ProofUpload({ patientId, paymentId }: { patientId: string; paymentId: string }) {
  const { t } = useLang()
  const upload = useUploadAttachment(patientId)
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={input}
        type="file"
        hidden
        accept={ALLOWED_UPLOAD_TYPES.join(',')}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) upload.mutate({ file, kind: 'PAYMENT_PROOF', title: t('record.payments.proof'), paymentId })
          e.target.value = ''
        }}
      />
      <Button plain onClick={() => input.current?.click()} disabled={upload.isPending}>
        <PaperClipIcon />
        {t('record.payments.attachProof')}
      </Button>
      <RequestError error={upload.error} />
    </>
  )
}

function NewPaymentDialog({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const { t } = useLang()
  const create = useCreatePayment(patientId)
  const upload = useUploadAttachment(patientId)
  const [formError, setFormError] = useState<string | null>(null)
  const pending = create.isPending || upload.isPending

  return (
    <SidePanel
      open
      onClose={onClose}
      size="xl"
      title={t('record.payments.record')}
      onSubmit={async (event) => {
        event.preventDefault()
        const f = new FormData(event.currentTarget)
        const parsed = CreatePaymentSchema.safeParse({
          amount: Number(f.get('amount')),
          method: f.get('method'),
          purpose: f.get('purpose'),
          reference: strOrNull(f.get('reference')),
          paidAt: new Date(String(f.get('paidAt'))).toISOString(),
          notes: strOrNull(f.get('notes')),
        })
        const proof = f.get('proof')
        const file = proof instanceof File && proof.size > 0 ? proof : null
        if (!parsed.success)
          return setFormError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · '))
        if (file && file.size > MAX_UPLOAD_BYTES) return setFormError(t('record.files.allowed'))
        setFormError(null)
        // Record the payment first, then attach the proof to it.
        const payment = await create.mutateAsync(parsed.data)
        if (file)
          await upload.mutateAsync({
            file,
            kind: 'PAYMENT_PROOF',
            title: t('record.payments.proof'),
            paymentId: payment.id,
          })
        onClose()
      }}
      actions={
        <>
          <Button plain onClick={onClose}>
            {t('record.cancel')}
          </Button>
          <Button type="submit" color="brand" disabled={pending}>
            {t('record.save')}
          </Button>
        </>
      }
    >
      <FieldGroup>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field>
            <Label>{t('record.payments.amount')}</Label>
            <Input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              required
              autoFocus
              dir="ltr"
            />
          </Field>
          <Field>
            <Label>{t('record.payments.method')}</Label>
            <Select name="method" defaultValue="CASH">
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {t(`record.payments.methods.${m}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field>
            <Label>{t('record.payments.purpose')}</Label>
            <Input name="purpose" required placeholder={t('record.payments.purposeHint')} />
          </Field>
          <Field>
            <Label>{t('record.payments.paidAt')}</Label>
            <Input name="paidAt" type="datetime-local" required defaultValue={toLocalInputValue()} />
          </Field>
        </div>
        <Field>
          <Label>
            {t('record.payments.reference')} <span className="text-zinc-400">({t('record.optional')})</span>
          </Label>
          <Input name="reference" dir="ltr" />
        </Field>
        <Field>
          <Label>{t('record.payments.proof')}</Label>
          <Input name="proof" type="file" accept={ALLOWED_UPLOAD_TYPES.join(',')} />
          <Description>
            {t('record.payments.proofHint')} · {t('record.files.allowed')}
          </Description>
        </Field>
        <Field>
          <Label>{t('record.payments.notes')}</Label>
          <Input name="notes" />
        </Field>
        {formError && <RequestError error={new Error(formError)} />}
        <RequestError error={create.error ?? upload.error} />
      </FieldGroup>
    </SidePanel>
  )
}

function VoidPaymentDialog({
  patientId,
  payment,
  onClose,
}: {
  patientId: string
  payment: PaymentDto
  onClose: () => void
}) {
  const { t } = useLang()
  const fmt = useFormat()
  const voidPayment = useVoidPayment(patientId)
  return (
    <SidePanel
      open
      onClose={onClose}
      size="md"
      title={t('record.payments.voidTitle')}
      description={
        <>
          {fmt.money(payment.amount, payment.currency)} · {payment.purpose}. {t('record.payments.voidHint')}
        </>
      }
      onSubmit={async (event) => {
        event.preventDefault()
        const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim()
        if (!reason) return
        await voidPayment.mutateAsync({ paymentId: payment.id, reason })
        onClose()
      }}
      actions={
        <>
          <Button plain onClick={onClose}>
            {t('record.cancel')}
          </Button>
          <Button type="submit" color="red" disabled={voidPayment.isPending}>
            {t('record.payments.void')}
          </Button>
        </>
      }
    >
      <Field>
        <Label>{t('record.payments.voidReason')}</Label>
        <Input name="reason" required autoFocus />
      </Field>
      <RequestError error={voidPayment.error} className="mt-4" />
    </SidePanel>
  )
}
