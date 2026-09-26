import type { ApiErrorDto } from '@azza/shared'

const BASE = '/api/v1'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors: { path: (string | number)[]; message: string }[] = [],
  ) {
    super(message)
  }
}

/** Fired on any 401 so the app can send the user back to the sign-in page. */
export const UNAUTHORIZED_EVENT = 'azzah:unauthorized'

type Body = object | FormData | undefined

/**
 * Thin fetch wrapper for the AZZAH API. Sessions ride on an httpOnly cookie (same origin),
 * so there is no token handling in the browser at all.
 */
export async function api<T>(
  path: string,
  init: { method?: string; body?: Body; signal?: AbortSignal } = {},
): Promise<T> {
  const isForm = init.body instanceof FormData
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    credentials: 'same-origin',
    headers: init.body && !isForm ? { 'content-type': 'application/json' } : undefined,
    body: init.body ? (isForm ? (init.body as FormData) : JSON.stringify(init.body)) : undefined,
    signal: init.signal,
  })

  if (res.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
  if (res.status === 204) return undefined as T

  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null
  if (!res.ok) {
    const err = (data ?? {}) as Partial<ApiErrorDto>
    throw new ApiError(res.status, err.message ?? res.statusText, err.errors ?? [])
  }
  return data as T
}

/** URL for viewing (inline) or downloading an attachment through the authenticated API. */
export const attachmentUrl = (patientId: string, attachmentId: string, download = false) =>
  `${BASE}/patients/${patientId}/attachments/${attachmentId}/file${download ? '?download=1' : ''}`
