export function getConfig() {
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()
  /** Optional convenience default — users can override after sign-in. */
  const defaultSheetId = (import.meta.env.VITE_SHEET_ID ?? '').trim()
  /** Where scheduled OA/HireVue calendar invites go; falls back to the signed-in account. */
  /** Default NeetCode Tracker sheet; users can connect a different one from the NeetCode tab. */
  const neetcodeSheetId = (import.meta.env.VITE_NEETCODE_SHEET_ID ?? '').trim()
  const calendarInviteEmail = (import.meta.env.VITE_CALENDAR_INVITE_EMAIL ?? '').trim()

  return {
    clientId,
    defaultSheetId,
    neetcodeSheetId,
    calendarInviteEmail,
    isConfigured: Boolean(clientId),
  }
}
