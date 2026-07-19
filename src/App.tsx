import { useCallback, useState } from 'react'
import type { TrackerData, ViewId } from './types'
import { getConfig } from './lib/config'
import {
  fetchUserProfile,
  requestGoogleAccessToken,
  revokeGoogleAccessToken,
  type GoogleUser,
} from './lib/googleAuth'
import { buildTrackerData, fetchSheetValues } from './lib/sheet'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { LoginScreen } from './components/LoginScreen'
import { DashboardView } from './views/DashboardView'
import { ApplicationsView } from './views/ApplicationsView'

export default function App() {
  const config = getConfig()
  const [view, setView] = useState<ViewId>('dashboard')
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [user, setUser] = useState<GoogleUser | null>(null)
  const [data, setData] = useState<TrackerData | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSheet = useCallback(
    async (token: string) => {
      const values = await fetchSheetValues(config.sheetId, token)
      setData(buildTrackerData(values))
    },
    [config.sheetId],
  )

  async function handleSignIn() {
    setError(null)
    setLoading(true)
    try {
      const token = await requestGoogleAccessToken(config.clientId)
      const profile = await fetchUserProfile(token)

      if (config.allowedEmail && profile.email.toLowerCase() !== config.allowedEmail) {
        await revokeGoogleAccessToken(token)
        throw new Error(
          `Signed in as ${profile.email}, but this tracker is restricted to ${config.allowedEmail}.`,
        )
      }

      await loadSheet(token)
      setAccessToken(token)
      setUser(profile)
    } catch (err) {
      setAccessToken(null)
      setUser(null)
      setData(null)
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    if (!accessToken) {
      return
    }
    setError(null)
    setRefreshing(true)
    try {
      await loadSheet(accessToken)
    } catch (err) {
      // Token may have expired — clear session so the user can sign in again
      setError(err instanceof Error ? err.message : 'Refresh failed')
      setAccessToken(null)
      setUser(null)
      setData(null)
    } finally {
      setRefreshing(false)
    }
  }

  async function handleSignOut() {
    if (accessToken) {
      await revokeGoogleAccessToken(accessToken)
    }
    setAccessToken(null)
    setUser(null)
    setData(null)
    setError(null)
    setView('dashboard')
  }

  if (!accessToken || !data || !user) {
    return (
      <LoginScreen
        configured={config.isConfigured}
        loading={loading}
        error={error}
        onSignIn={handleSignIn}
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 bg-slds-bg">
      <Sidebar active={view} onNavigate={setView} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          lastSynced={data.lastSynced}
          userEmail={user.email}
          onRefresh={handleRefresh}
          onSignOut={handleSignOut}
          refreshing={refreshing}
        />
        {error ? (
          <div className="border-b border-slds-border bg-[#fddde3] px-4 py-2 text-sm text-[#8e030f]">
            {error}
          </div>
        ) : null}
        <main className="min-h-0 flex-1 overflow-auto p-4">
          {view === 'dashboard' ? (
            <DashboardView data={data} />
          ) : (
            <ApplicationsView applications={data.applications} />
          )}
        </main>
      </div>
    </div>
  )
}
