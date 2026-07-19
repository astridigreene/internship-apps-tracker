export function getConfig() {
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()
  /** Optional convenience default — users can override after sign-in. */
  const defaultSheetId = (import.meta.env.VITE_SHEET_ID ?? '').trim()

  return {
    clientId,
    defaultSheetId,
    isConfigured: Boolean(clientId),
  }
}
