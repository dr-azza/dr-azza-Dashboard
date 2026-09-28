import { useFormat } from '@/components/app/form'
import { AzzahLockup } from '@/components/brand/logo'
import { useLang } from '@/i18n'
import type { PatientDto, PrescriptionDto } from '@azza/shared'
import clsx from 'clsx'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'

type Item = PrescriptionDto['items'][number]

/** Where the sheet is going: printed on paper, or saved as a PDF file. */
type Mode = 'print' | 'pdf'

/**
 * The branded prescription sheet (A5), the single source for printing, viewing and the PDF.
 * Always light, whatever the app theme: it is paper.
 *
 * On screen and in print it shows the whole prescription (the browser paginates printing). For the
 * PDF it is one fixed A5 page: `items` holds that page's medicines, and `page` says which page it
 * is, so later pages repeat the header and patient and only the last carries the signature.
 */
export function PrescriptionSheet({
  patient: p,
  prescription: r,
  mode = 'print',
  items,
  page,
  className,
}: {
  patient: PatientDto
  prescription: PrescriptionDto
  mode?: Mode
  items?: { item: Item; index: number }[]
  page?: { n: number; total: number }
  className?: string
}) {
  const { t } = useLang()
  const fmt = useFormat()
  const list = items ?? r.items.map((item, index) => ({ item, index }))
  const first = !page || page.n === 1
  const last = !page || page.n === page.total

  return (
    <article
      data-sheet
      className={clsx(
        'flex w-[148mm] flex-col bg-white p-8 text-zinc-950',
        // A PDF page is exactly A5; on screen and in print the sheet grows with its content.
        page ? 'h-[210mm] overflow-hidden' : 'min-h-[190mm]',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-6 border-b-2 border-brand-600 pb-4">
        <AzzahLockup className={first ? 'h-20 text-zinc-900' : 'h-12 text-zinc-900'} />
        <div className="text-end text-xs/5 text-zinc-600">
          <div className="font-semibold text-zinc-900">{t('record.rx.number', { number: r.number })}</div>
          <div>
            {t('record.rx.date')}: {fmt.day(r.issuedAt)}
          </div>
          {page && page.total > 1 && <div>{t('record.rx.page', { n: page.n, total: page.total })}</div>}
        </div>
      </header>

      {first ? (
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
      ) : (
        <p className="mt-3 text-sm/6">
          <span className="text-zinc-500">{t('record.rx.patient')}: </span>
          <span className="font-semibold">{p.fullName}</span> · {t('file.fileNo', { file: p.fileNumber })}
        </p>
      )}

      {first && (
        <div className="mt-6 font-serif text-3xl/none font-bold text-brand-600" aria-hidden="true">
          ℞
        </div>
      )}
      <ol className="mt-3 flex-1 space-y-4" data-items>
        {list.map(({ item: i, index }) => (
          <li key={index} dir="auto" className="text-sm/6">
            <div className="font-semibold">
              {index + 1}. {i.drugName} {i.dose && <span className="font-normal">{i.dose}</span>}
            </div>
            <div className="ps-4 text-zinc-700">{[i.frequency, i.duration].filter(Boolean).join(' · ')}</div>
            {i.instructions && <div className="ps-4 text-zinc-600">{i.instructions}</div>}
          </li>
        ))}
      </ol>
      {last && r.notes && <p className="mt-6 text-sm/6 text-zinc-700">{r.notes}</p>}

      {last ? (
        <footer className="mt-10 flex items-end justify-between text-xs/5 text-zinc-500">
          <span>
            {t(mode === 'pdf' ? 'record.rx.generatedOn' : 'record.rx.printedOn', {
              date: fmt.dayTime(new Date().toISOString()),
            })}
          </span>
          <span className="w-48 border-t border-zinc-400 pt-1 text-center">
            {t('record.rx.signature')}
            {r.prescribedBy && <span className="block font-medium text-zinc-700">{r.prescribedBy.fullName}</span>}
          </span>
        </footer>
      ) : (
        <p className="mt-6 text-end text-xs/5 text-zinc-500">{t('record.rx.continued')}</p>
      )}
    </article>
  )
}

/** A5 in millimetres, the PDF page size. */
const A5 = { width: 148, height: 210 }

/**
 * Saves a prescription as a PDF: real A5 pages, broken between medicines (never through one).
 * The pages are rendered off-screen at their exact size, independent of the screen or any open
 * panel, so every Download button produces the same file; the browser draws them, so Arabic,
 * fonts and branding match what staff see. The PDF libraries load on first use only.
 */
export async function downloadPrescriptionPdf(patient: PatientDto, prescription: PrescriptionDto) {
  const [{ toJpeg, getFontEmbedCSS }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])

  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  Object.assign(host.style, { position: 'fixed', top: '0', left: '-10000px', pointerEvents: 'none' })
  document.body.append(host)
  const root = createRoot(host)
  const render = (node: React.ReactNode) => {
    flushSync(() => root.render(node))
    return host.querySelector<HTMLElement>('[data-sheet]')!
  }
  const overflows = (sheet: HTMLElement) => sheet.scrollHeight > sheet.clientHeight + 1

  try {
    // Fill pages greedily, one medicine at a time; a medicine that doesn't fit starts the next page.
    const all = prescription.items.map((item, index) => ({ item, index }))
    const pages: (typeof all)[] = []
    let current: typeof all = []
    for (const entry of all) {
      const attempt = [...current, entry]
      const probe = { n: pages.length + 1, total: pages.length + 2 }
      const sheet = render(
        <PrescriptionSheet patient={patient} prescription={prescription} mode="pdf" items={attempt} page={probe} />,
      )
      if (overflows(sheet) && current.length) {
        pages.push(current)
        current = [entry]
      } else {
        current = attempt
      }
    }
    pages.push(current)

    const pdf = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait', compress: true })
    let fontEmbedCSS: string | undefined
    for (const [i, items] of pages.entries()) {
      const sheet = render(
        <PrescriptionSheet
          patient={patient}
          prescription={prescription}
          mode="pdf"
          items={items}
          page={{ n: i + 1, total: pages.length }}
        />,
      )
      fontEmbedCSS ??= await getFontEmbedCSS(sheet)
      const options = { pixelRatio: 2, quality: 0.92, backgroundColor: '#ffffff', fontEmbedCSS }
      // Safari may draw the first capture before embedded fonts are ready; a warm-up render fixes it.
      if (i === 0) await toJpeg(sheet, options)
      const image = await toJpeg(sheet, options)
      if (i > 0) pdf.addPage()
      pdf.addImage(image, 'JPEG', 0, 0, A5.width, A5.height, undefined, 'FAST')
    }
    pdf.save(`${prescription.number}.pdf`)
  } finally {
    root.unmount()
    host.remove()
  }
}
