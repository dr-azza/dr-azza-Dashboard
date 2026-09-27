/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "test" on the QC deployment: shows the test-environment banner. */
  readonly VITE_APP_ENV?: string
  /** Upload limit in bytes for hosts with a smaller request limit (see lib/upload-limit.ts). */
  readonly VITE_UPLOAD_MAX_BYTES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
