const GIS_SRC = 'https://accounts.google.com/gsi/client'
// Full Sheets scope so dashboard can update Status cells
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const PROFILE_SCOPES = 'openid email profile'
const SCOPES = `${SHEETS_SCOPE} ${PROFILE_SCOPES}`

let gisLoadPromise: Promise<void> | null = null

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve()
  }
  if (gisLoadPromise) {
    return gisLoadPromise
  }

  gisLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load Google Identity Services')),
      )
      return
    }

    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(script)
  })

  return gisLoadPromise
}

export interface GoogleUser {
  email: string
  name: string
}

export interface AccessTokenResult {
  accessToken: string
  /** Lifetime in seconds (Google typically returns ~3600). */
  expiresIn: number
}

export async function fetchUserProfile(accessToken: string): Promise<GoogleUser> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error('Could not load Google profile')
  }
  const data = (await res.json()) as { email?: string; name?: string }
  if (!data.email) {
    throw new Error('Google account did not return an email')
  }
  return {
    email: data.email,
    name: data.name ?? data.email,
  }
}

export async function requestGoogleAccessToken(
  clientId: string,
  options?: { prompt?: '' | 'none' | 'consent' | 'select_account' },
): Promise<AccessTokenResult> {
  await loadGis()
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services unavailable')
  }

  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(
            new Error(
              response.error_description || response.error || 'Google sign-in was cancelled',
            ),
          )
          return
        }
        resolve({
          accessToken: response.access_token,
          expiresIn: Number(response.expires_in) || 3600,
        })
      },
      error_callback: (error) => {
        reject(new Error(error.message || error.type || 'Google sign-in failed'))
      },
    })

    client.requestAccessToken({ prompt: options?.prompt ?? '' })
  })
}

export function revokeGoogleAccessToken(accessToken: string): Promise<void> {
  return new Promise((resolve) => {
    if (!window.google?.accounts?.oauth2) {
      resolve()
      return
    }
    window.google.accounts.oauth2.revoke(accessToken, () => resolve())
  })
}
