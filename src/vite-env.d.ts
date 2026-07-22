/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_SHEET_ID?: string
  readonly VITE_BASE_PATH: string
  /** Classic PAT with `repo` — used only to fire repository_dispatch (no app data). */
  readonly VITE_GH_PAT?: string
  /** "owner/repo" for repository_dispatch */
  readonly VITE_GITHUB_REPO?: string
  /** @deprecated Prefer VITE_GH_PAT direct dispatch */
  readonly VITE_GITHUB_PING_URL?: string
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
