/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_SHEET_ID: string
  readonly VITE_ALLOWED_EMAIL: string
  readonly VITE_BASE_PATH: string
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
