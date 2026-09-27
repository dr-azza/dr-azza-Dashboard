import { MAX_UPLOAD_BYTES } from '@azza/shared'

/**
 * Largest upload this deployment accepts. Hosts with a smaller request limit build with
 * VITE_UPLOAD_MAX_BYTES (Vercel: 4 MB), matching the API's UPLOAD_MAX_BYTES.
 */
export const uploadMaxBytes = Number(import.meta.env.VITE_UPLOAD_MAX_BYTES) || MAX_UPLOAD_BYTES
export const uploadMaxMb = Math.floor(uploadMaxBytes / 1024 / 1024)
