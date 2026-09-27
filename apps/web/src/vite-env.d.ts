/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "test" on the QC deployment: shows the test-environment banner. */
  readonly VITE_APP_ENV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
