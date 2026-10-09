export function getConfig() {
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()
  /** Optional convenience default — users can override after sign-in. */
  const defaultSheetId = (import.meta.env.VITE_SHEET_ID ?? '').trim()
  /** Where scheduled OA/HireVue calendar invites go; falls back to the signed-in account. */
  const calendarInviteEmail = (import.meta.env.VITE_CALENDAR_INVITE_EMAIL ?? '').trim()

  return {
    clientId,
    defaultSheetId,
    calendarInviteEmail,
    isConfigured: Boolean(clientId),
  }
}
