/** Only this Google account may use the tracker UI. */
export const ALLOWED_EMAIL = 'astridig@umich.edu'

export function getConfig() {
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()
  const sheetId = (import.meta.env.VITE_SHEET_ID ?? '').trim()

  return {
    clientId,
    sheetId,
    allowedEmail: ALLOWED_EMAIL,
    isConfigured: Boolean(clientId && sheetId),
  }
}
