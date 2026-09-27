/**
 * A small fixed strip on every page of a test deployment (built with VITE_APP_ENV=test), so
 * nobody mistakes it for the real clinic system or enters real patient data. Bilingual because it
 * also shows on patient-facing pages, whatever their language.
 */
export function EnvBanner() {
  if (import.meta.env.VITE_APP_ENV !== 'test') return null
  return (
    <div
      role="note"
      className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-3 print:hidden"
    >
      <p className="rounded-full bg-amber-400 px-3 py-1 text-center text-xs/5 font-semibold text-amber-950 shadow-md ring-1 ring-amber-500/50">
        <span lang="en">Test environment · test data only</span>
        <span aria-hidden="true"> · </span>
        <span lang="ar" dir="rtl">
          بيئة اختبار · بيانات تجريبية فقط
        </span>
      </p>
    </div>
  )
}
