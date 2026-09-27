/**
 * Switches for whole areas of the dashboard. Turning one off hides its screens and links; the
 * data and API stay in place, so it can be switched back on without a migration.
 */
export const FEATURES = {
  /** Pregnancy follow-up: the patient Follow-up tab and the sidebar page. Off while history is free text. */
  followUp: false,
} as const
