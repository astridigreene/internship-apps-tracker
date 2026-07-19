import type { GoogleUser } from './googleAuth'

const SESSION_KEY = 'internship-tracker-session-v3'
const SHEET_PREFS_KEY = 'internship-tracker-sheet-prefs-v1'
/** Refresh a bit before Google's token actually expires. */
const EXPIRY_SKEW_MS = 2 * 60 * 1000

export interface PersistedSession {
  accessToken: string
  expiresAt: number
  user: GoogleUser
  selectedYear?: string
  sheetId?: string
}

export function saveSession(session: PersistedSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // ignore quota / private mode
  }
}

export function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as PersistedSession
    if (
      !parsed?.accessToken ||
      !parsed?.expiresAt ||
      !parsed?.user?.email ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}

export function isSessionValid(session: PersistedSession, now = Date.now()): boolean {
  return session.expiresAt - EXPIRY_SKEW_MS > now
}

export function sessionExpiresAt(expiresInSeconds: number, now = Date.now()): number {
  return now + Math.max(expiresInSeconds, 60) * 1000
}

/** Extract a spreadsheet ID from a raw ID or Google Sheets URL. */
export function parseSpreadsheetId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }
  const fromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (fromUrl?.[1]) {
    return fromUrl[1]
  }
  if (/^[a-zA-Z0-9-_]{30,}$/.test(trimmed)) {
    return trimmed
  }
  return null
}

function loadSheetPrefs(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SHEET_PREFS_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as Record<string, string>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function getSavedSheetIdForEmail(email: string): string | null {
  const id = loadSheetPrefs()[email.trim().toLowerCase()]
  return id?.trim() || null
}

export function saveSheetIdForEmail(email: string, sheetId: string): void {
  try {
    const prefs = loadSheetPrefs()
    prefs[email.trim().toLowerCase()] = sheetId.trim()
    localStorage.setItem(SHEET_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // ignore
  }
}

export function clearSheetIdForEmail(email: string): void {
  try {
    const prefs = loadSheetPrefs()
    delete prefs[email.trim().toLowerCase()]
    localStorage.setItem(SHEET_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // ignore
  }
}
