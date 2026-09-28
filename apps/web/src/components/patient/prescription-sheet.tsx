import { useFormat } from '@/components/app/form'
import { AzzahLockup } from '@/components/brand/logo'
import { useLang } from '@/i18n'
import type { PatientDto, PrescriptionDto } from '@azza/shared'
import clsx from 'clsx'
import { forwardRef } from 'react'

/**
 * The branded prescription sheet (A5), the single source for printing, viewing and the PDF.
 * Always light, whatever the app theme: it is paper.
 */
export const PrescriptionSheet = forwardRef<
  HTMLElement,
  { patient: PatientDto; prescription: PrescriptionDto; className?: string }
>(function PrescriptionSheet({ patient: p, prescription: r, className }, ref) {
  const { t } = useLang()
  const fmt = useFormat()
  return (
    <article
      ref={ref}
      className={clsx('flex min-h-[190mm] w-[148mm] max-w-full flex-col bg-white p-8 text-zinc-950', className)}
    >
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
  )
})

/** A5 in millimetres, the sheet's page size. */
const A5 = { width: 148, height: 210 }

/**
 * Saves the sheet as a PDF (A5, one or more pages). The browser renders the sheet exactly as shown,
 * Arabic and fonts included, and that image goes on the page. The libraries load on first use only.
 */
export async function downloadPrescriptionPdf(sheet: HTMLElement, fileName: string) {
  const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
  const png = await toPng(sheet, { pixelRatio: 3, backgroundColor: '#ffffff', cacheBust: true })
  const pdf = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait', compress: true })
  // The sheet is designed at A5 width, so it maps to the page width; a long list continues on
  // further pages by shifting the same image up one page height at a time.
  const imageHeight = (sheet.offsetHeight / sheet.offsetWidth) * A5.width
  for (let offset = 0, page = 0; offset < imageHeight - 0.5; offset += A5.height, page++) {
    if (page > 0) pdf.addPage()
    pdf.addImage(png, 'PNG', 0, -offset, A5.width, imageHeight, undefined, 'FAST')
  }
  pdf.save(fileName)
}
