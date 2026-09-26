import { useFormat } from '@/components/app/form'
import { AzzahLockup } from '@/components/brand/logo'
import { Button } from '@/components/catalyst/button'
import { useLang } from '@/i18n'
import { api } from '@/lib/api'
import type { PatientDto, PrescriptionDto } from '@azza/shared'
import { PrinterIcon } from '@heroicons/react/16/solid'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router'

/**
 * Printable, branded prescription (A5-friendly). Opens in its own tab from the patient file and
 * triggers the print dialog once loaded. Always printed light, regardless of the app theme.
 */
export function PrescriptionPrintPage() {
  const { patientId = '', prescriptionId = '' } = useParams()
  const { t } = useLang()
  const fmt = useFormat()
  const patient = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => api<PatientDto>(`/patients/${patientId}`),
  })
  const rx = useQuery({
    queryKey: ['patient', patientId, 'prescription', prescriptionId],
    queryFn: () => api<PrescriptionDto>(`/patients/${patientId}/prescriptions/${prescriptionId}`),
  })
  const ready = patient.isSuccess && rx.isSuccess

  useEffect(() => {
    document.documentElement.classList.remove('dark')
    if (ready) {
      const id = setTimeout(() => window.print(), 300)
      return () => clearTimeout(id)
    }
  }, [ready])

  if (patient.isError || rx.isError) return <Navigate to={`/patients/${patientId}`} replace />
  if (!ready) return null
  const p = patient.data
  const r = rx.data

  return (
    <div className="min-h-svh bg-zinc-100 py-8 text-zinc-950 print:bg-white print:py-0">
      <style>{'@page { size: A5; margin: 12mm; } @media print { .no-print { display: none !important; } }'}</style>
      <div className="no-print mx-auto mb-4 flex max-w-[148mm] justify-end">
        <Button color="brand" onClick={() => window.print()}>
          <PrinterIcon />
          {t('record.rx.print')}
        </Button>
      </div>
      <article className="mx-auto flex min-h-[190mm] max-w-[148mm] flex-col bg-white p-8 shadow-sm print:min-h-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-2 border-brand-600 pb-4">
          <AzzahLockup className="h-20 text-zinc-900" />
          <div className="text-end text-xs/5 text-zinc-600">
            <div className="font-semibold text-zinc-900">{t('record.rx.number', { number: r.number })}</div>
            <div>
              {t('record.rx.date')}: {fmt.day(r.issuedAt)}
            </div>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm/6">
          <div>
            <span className="text-zinc-500">{t('record.rx.patient')}: </span>
            <span className="font-semibold">{p.fullName}</span>
            {p.fullNameAr && <span lang="ar"> · {p.fullNameAr}</span>}
          </div>
          <div className="text-end">
            {p.age != null && t('record.years', { age: p.age })} · {t('file.fileNo', { file: p.fileNumber })}
          </div>
          {p.activePregnancy && (
            <div className="col-span-2 text-zinc-600">
              {t('common.ga', { w: p.activePregnancy.weeks, d: p.activePregnancy.days })}
            </div>
          )}
          {r.diagnosis && (
            <div className="col-span-2">
              <span className="text-zinc-500">{t('record.rx.diagnosis')}: </span>
              {r.diagnosis}
            </div>
          )}
        </section>

        <div className="mt-6 font-serif text-3xl/none font-bold text-brand-600" aria-hidden="true">
          ℞
        </div>
        <ol className="mt-3 flex-1 space-y-4">
          {r.items.map((i, n) => (
            <li key={n} dir="auto" className="text-sm/6">
              <div className="font-semibold">
                {n + 1}. {i.drugName} {i.dose && <span className="font-normal">{i.dose}</span>}
              </div>
              <div className="ps-4 text-zinc-700">{[i.frequency, i.duration].filter(Boolean).join(' · ')}</div>
              {i.instructions && <div className="ps-4 text-zinc-600">{i.instructions}</div>}
            </li>
          ))}
        </ol>
        {r.notes && <p className="mt-6 text-sm/6 text-zinc-700">{r.notes}</p>}

        <footer className="mt-10 flex items-end justify-between text-xs/5 text-zinc-500">
          <span>{t('record.rx.printedOn', { date: fmt.dayTime(new Date().toISOString()) })}</span>
          <span className="w-48 border-t border-zinc-400 pt-1 text-center">
            {t('record.rx.signature')}
            {r.prescribedBy && <span className="block font-medium text-zinc-700">{r.prescribedBy.fullName}</span>}
          </span>
        </footer>
      </article>
    </div>
  )
}
