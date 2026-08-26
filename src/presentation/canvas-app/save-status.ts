/** User-facing persistence states shared by the app's command and storage adapters. */
export const SAVE_STATUS = {
  saved: 'Saved',
  saving: 'Saving',
  /** A record changed underneath this session. The edits stay; the user decides what to do. */
  stale: 'File changed on disk — your edits are unsaved',
  failed: 'Not saved',
  refused: 'Change not applied',
} as const;
