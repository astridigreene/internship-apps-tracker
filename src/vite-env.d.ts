/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_SHEET_ID?: string
  readonly VITE_BASE_PATH: string
  /** Apps Script Web App URL that dispatches an empty-commit GitHub Action. */
  readonly VITE_GITHUB_PING_URL?: string
  /** Optional shared secret for the ping Web App (PING_SECRET). */
  readonly VITE_GITHUB_PING_SECRET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface GoogleTokenResponse {
  access_token?: string
  error?: string
  error_description?: string
  expires_in?: number
  scope?: string
  token_type?: string
}

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void
}

interface GoogleAccountsOauth2 {
  initTokenClient: (config: {
    client_id: string
    scope: string
    callback: (response: GoogleTokenResponse) => void
    error_callback?: (error: { type?: string; message?: string }) => void
  }) => GoogleTokenClient
  revoke: (token: string, done?: () => void) => void
}

interface GoogleAccountsId {
  initialize: (config: Record<string, unknown>) => void
}

interface GoogleAccounts {
  oauth2: GoogleAccountsOauth2
  id: GoogleAccountsId
}

interface Window {
  google?: {
    accounts: GoogleAccounts
  }
}
