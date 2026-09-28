import { Button } from '@/components/catalyst/button'
import { PrescriptionSheet } from '@/components/patient/prescription-sheet'
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
      <PrescriptionSheet
        patient={p}
        prescription={r}
        className="mx-auto max-w-full shadow-sm print:min-h-0 print:w-full print:max-w-none print:p-0 print:shadow-none"
      />
    </div>
  )
}
