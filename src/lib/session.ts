import type { GoogleUser } from './googleAuth'

const SESSION_KEY = 'internship-tracker-session-v2'
/** Refresh a bit before Google's token actually expires. */
const EXPIRY_SKEW_MS = 2 * 60 * 1000

export interface PersistedSession {
  accessToken: string
  expiresAt: number
  user: GoogleUser
  selectedYear?: string
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
