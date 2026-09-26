import '@/i18n'
import '@/lib/theme'
import '@/styles/tailwind.css'

import { ApiError } from '@/lib/api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Don't retry what can't succeed: auth failures, missing records, bad requests.
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
})

// Every screen is its own chunk, so the patient form never downloads the staff dashboard
// and each dashboard page loads only when first opened.
const router = createBrowserRouter([
  {
    lazy: () => import('@/layouts/app-layout').then((m) => ({ Component: m.AppLayout })),
    hydrateFallbackElement: <div />,
    children: [
      { path: '/', lazy: () => import('@/pages/overview').then((m) => ({ Component: m.OverviewPage })) },
      { path: '/patients', lazy: () => import('@/pages/patients').then((m) => ({ Component: m.PatientsPage })) },
      {
        path: '/patients/:id',
        lazy: () => import('@/pages/patient/patient-page').then((m) => ({ Component: m.PatientPage })),
      },
      { path: '/pregnancy', lazy: () => import('@/pages/pregnancy').then((m) => ({ Component: m.PregnancyPage })) },
      {
        path: '/appointments',
        lazy: () => import('@/pages/simple-pages').then((m) => ({ Component: m.AppointmentsPage })),
      },
      { path: '/forms', lazy: () => import('@/pages/forms').then((m) => ({ Component: m.FormsPage })) },
      { path: '/reminders', lazy: () => import('@/pages/simple-pages').then((m) => ({ Component: m.RemindersPage })) },
      { path: '/settings', lazy: () => import('@/pages/settings').then((m) => ({ Component: m.SettingsPage })) },
    ],
  },
  {
    path: '/login',
    hydrateFallbackElement: <div />,
    lazy: () => import('@/pages/login').then((m) => ({ Component: m.LoginPage })),
  },
  {
    path: '/print/prescription/:patientId/:prescriptionId',
    hydrateFallbackElement: <div />,
    lazy: () => import('@/pages/patient/prescription-print').then((m) => ({ Component: m.PrescriptionPrintPage })),
  },
  // Patient-facing form opened from a WhatsApp/SMS link: no staff layout, no login.
  {
    path: '/f/:token',
    hydrateFallbackElement: <div />,
    lazy: () => import('@/pages/public-form').then((m) => ({ Component: m.PublicFormPage })),
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
