import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  isForwardProgress,
  isRejectedStatus,
  type Application,
  type NewApplicationInput,
  type TrackerData,
  type ViewId,
} from './types'
import { getConfig } from './lib/config'
import {
  fetchUserProfile,
  requestGoogleAccessToken,
  revokeGoogleAccessToken,
  type GoogleUser,
} from './lib/googleAuth'
import {
  appendSheetApplication,
  buildTrackerData,
  computeStats,
  deleteSheetRow,
  fetchSheetValues,
  listYearSheets,
  nextSummerYear,
  pickDefaultYear,
  updateSheetStatus,
} from './lib/sheet'
import { statusUpdateStamp } from './lib/time'
import { celebrate } from './lib/celebrate'
import {
  clearSession,
  isSessionValid,
  loadSession,
  saveSession,
  sessionExpiresAt,
} from './lib/session'
import { Nav } from './components/Nav'
import { TopBar } from './components/TopBar'
import { LoginScreen } from './components/LoginScreen'
import { YearTabs } from './components/YearTabs'
import { DashboardView } from './views/DashboardView'
import { ApplicationsView, type ApplicationsStatusFilter, type StatusEditChange } from './views/ApplicationsView'

export default function App() {
  const config = getConfig()
  const [view, setView] = useState<ViewId>('dashboard')
  const [applicationsFilter, setApplicationsFilter] =
    useState<ApplicationsStatusFilter>('Active')
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [user, setUser] = useState<GoogleUser | null>(null)
  const [years, setYears] = useState<string[]>([])
  const [selectedYear, setSelectedYear] = useState(() => nextSummerYear())
  const [data, setData] = useState<TrackerData | null>(null)
  const [loading, setLoading] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [switchingYear, setSwitchingYear] = useState(false)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const persist = useCallback(
    (token: string, expiresIn: number, profile: GoogleUser, year?: string) => {
      const nextYear = year ?? selectedYear
      saveSession({
        accessToken: token,
        expiresAt: sessionExpiresAt(expiresIn),
        user: profile,
        selectedYear: nextYear,
      })
    },
    [selectedYear],
  )

  const loadYearData = useCallback(
    async (token: string, year: string) => {
      const values = await fetchSheetValues(config.sheetId, token, year)
      setData(buildTrackerData(values))
      setSelectedYear(year)
      const existing = loadSession()
      if (existing) {
        saveSession({ ...existing, selectedYear: year, accessToken: token })
      }
    },
    [config.sheetId],
  )

  const assertAllowedUser = useCallback(
    async (token: string, profile: GoogleUser) => {
      if (config.allowedEmail && profile.email.toLowerCase() !== config.allowedEmail) {
        await revokeGoogleAccessToken(token)
        clearSession()
        throw new Error(
          `Signed in as ${profile.email}, but this tracker is restricted to ${config.allowedEmail}.`,
        )
      }
    },
    [config.allowedEmail],
  )

  const establishSession = useCallback(
    async (opts?: { prompt?: '' | 'consent'; preferredYear?: string }) => {
      const { accessToken: token, expiresIn } = await requestGoogleAccessToken(
        config.clientId,
        { prompt: opts?.prompt ?? '' },
      )
      const profile = await fetchUserProfile(token)
      await assertAllowedUser(token, profile)

      const yearTabs = await listYearSheets(config.sheetId, token)
      const preferred = nextSummerYear()
      const year = pickDefaultYear(
        yearTabs,
        opts?.preferredYear && yearTabs.includes(opts.preferredYear)
          ? opts.preferredYear
          : preferred,
      )

      persist(token, expiresIn, profile, year)
      setYears(yearTabs)
      await loadYearData(token, year)
      setAccessToken(token)
      setUser(profile)
    },
    [assertAllowedUser, config.clientId, config.sheetId, loadYearData, persist],
  )

  // Restore session across page refreshes (once on mount)
  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      if (!config.isConfigured) {
        setBootstrapping(false)
        return
      }

      const saved = loadSession()
      try {
        if (saved && isSessionValid(saved)) {
          if (
            config.allowedEmail &&
            saved.user.email.toLowerCase() !== config.allowedEmail
          ) {
            clearSession()
            return
          }
          const yearTabs = await listYearSheets(config.sheetId, saved.accessToken)
          if (cancelled) {
            return
          }
          const year = yearTabs.includes(saved.selectedYear ?? '')
            ? (saved.selectedYear as string)
            : pickDefaultYear(yearTabs, nextSummerYear())
          setYears(yearTabs)
          setAccessToken(saved.accessToken)
          setUser(saved.user)
          const values = await fetchSheetValues(config.sheetId, saved.accessToken, year)
          if (cancelled) {
            return
          }
          setData(buildTrackerData(values))
          setSelectedYear(year)
          saveSession({ ...saved, selectedYear: year })
          return
        }

        // Expired / missing token but we were signed in before — silent re-auth
        if (saved?.user) {
          const { accessToken: token, expiresIn } = await requestGoogleAccessToken(
            config.clientId,
            { prompt: '' },
          )
          const profile = await fetchUserProfile(token)
          if (
            config.allowedEmail &&
            profile.email.toLowerCase() !== config.allowedEmail
          ) {
            await revokeGoogleAccessToken(token)
            clearSession()
            return
          }
          const yearTabs = await listYearSheets(config.sheetId, token)
          if (cancelled) {
            return
          }
          const year = yearTabs.includes(saved.selectedYear ?? '')
            ? (saved.selectedYear as string)
            : pickDefaultYear(yearTabs, nextSummerYear())
          saveSession({
            accessToken: token,
            expiresAt: sessionExpiresAt(expiresIn),
            user: profile,
            selectedYear: year,
          })
          const values = await fetchSheetValues(config.sheetId, token, year)
          if (cancelled) {
            return
          }
          setYears(yearTabs)
          setAccessToken(token)
          setUser(profile)
          setData(buildTrackerData(values))
          setSelectedYear(year)
        }
      } catch {
        clearSession()
        if (!cancelled) {
          setAccessToken(null)
          setUser(null)
          setData(null)
          setYears([])
        }
      } finally {
        if (!cancelled) {
          setBootstrapping(false)
        }
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
    // Intentionally mount-only — session restore should not re-run on callback identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSignIn() {
    setError(null)
    setLoading(true)
    try {
      const saved = loadSession()
      await establishSession({ prompt: '', preferredYear: saved?.selectedYear })
    } catch (err) {
      clearSession()
      setAccessToken(null)
      setUser(null)
      setData(null)
      setYears([])
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  async function ensureFreshToken(): Promise<string> {
    const saved = loadSession()
    if (saved && isSessionValid(saved) && accessToken) {
      return accessToken
    }

    const { accessToken: token, expiresIn } = await requestGoogleAccessToken(config.clientId, {
      prompt: '',
    })
    const profile = user ?? (await fetchUserProfile(token))
    await assertAllowedUser(token, profile)
    persist(token, expiresIn, profile)
    setAccessToken(token)
    setUser(profile)
    return token
  }

  async function handleRefresh() {
    setError(null)
    setRefreshing(true)
    try {
      const token = await ensureFreshToken()
      const yearTabs = await listYearSheets(config.sheetId, token)
      setYears(yearTabs)
      const year = yearTabs.includes(selectedYear)
        ? selectedYear
        : pickDefaultYear(yearTabs, nextSummerYear())
      await loadYearData(token, year)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  async function handleSelectYear(year: string) {
    if (year === selectedYear) {
      return
    }
    setError(null)
    setSwitchingYear(true)
    try {
      const token = await ensureFreshToken()
      await loadYearData(token, year)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load year sheet')
    } finally {
      setSwitchingYear(false)
    }
  }

  async function handleHome() {
    setView('dashboard')
    const preferred = pickDefaultYear(years, nextSummerYear())
    if (preferred !== selectedYear) {
      await handleSelectYear(preferred)
    }
  }

  async function handleSaveStatusChanges(changes: StatusEditChange[]) {
    if (!accessToken || !data || changes.length === 0) {
      return
    }

    const previous = data
    const stamp = statusUpdateStamp()
    setError(null)
    setSaving(true)

    const byRow = new Map(changes.map((change) => [change.app.sheetRow, change.toStatus]))
    const nextApps = data.applications.map((row) => {
      const nextStatus = byRow.get(row.sheetRow)
      return nextStatus
        ? { ...row, status: nextStatus, lastUpdated: stamp }
        : row
    })
    setData({
      ...data,
      applications: nextApps,
      stats: computeStats(nextApps),
      lastSynced: new Date().toISOString(),
    })

    try {
      const token = await ensureFreshToken()
      let columns = data.columns
      for (const change of changes) {
        columns = await updateSheetStatus({
          spreadsheetId: config.sheetId,
          accessToken: token,
          sheetTitle: selectedYear,
          sheetRow: change.app.sheetRow,
          columns,
          status: change.toStatus,
          lastUpdatedStamp: stamp,
        })
      }
      setData((current) => (current ? { ...current, columns } : current))
      if (changes.some((change) => isForwardProgress(change.fromStatus, change.toStatus))) {
        celebrate()
      }
    } catch (err) {
      setData(previous)
      setError(err instanceof Error ? err.message : 'Could not save status changes')
      throw err instanceof Error ? err : new Error('Could not save status changes')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddApplication(application: NewApplicationInput) {
    if (!accessToken || !data) {
      return
    }

    const stamp = statusUpdateStamp()
    setError(null)
    setAdding(true)

    try {
      const token = await ensureFreshToken()
      const { columns, sheetRow } = await appendSheetApplication({
        spreadsheetId: config.sheetId,
        accessToken: token,
        sheetTitle: selectedYear,
        columns: data.columns,
        application,
        lastUpdatedStamp: stamp,
      })

      const nextApp: Application = {
        ...application,
        lastUpdated: stamp,
        sheetRow,
      }
      const nextApps = [...data.applications, nextApp]
      setData({
        ...data,
        columns,
        applications: nextApps,
        stats: computeStats(nextApps),
        lastSynced: new Date().toISOString(),
      })
      if (!isRejectedStatus(application.status)) {
        celebrate()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not add application'
      setError(message)
      throw err instanceof Error ? err : new Error(message)
    } finally {
      setAdding(false)
    }
  }

  async function handleDeleteApplication(app: Application) {
    if (!accessToken || !data) {
      return
    }

    const previous = data
    setError(null)
    setDeleting(true)

    const nextApps = data.applications
      .filter((row) => row.sheetRow !== app.sheetRow)
      .map((row) =>
        row.sheetRow > app.sheetRow ? { ...row, sheetRow: row.sheetRow - 1 } : row,
      )

    setData({
      ...data,
      applications: nextApps,
      stats: computeStats(nextApps),
      lastSynced: new Date().toISOString(),
    })

    try {
      const token = await ensureFreshToken()
      await deleteSheetRow({
        spreadsheetId: config.sheetId,
        accessToken: token,
        sheetTitle: selectedYear,
        sheetRow: app.sheetRow,
      })
    } catch (err) {
      setData(previous)
      const message = err instanceof Error ? err.message : 'Could not delete application'
      setError(message)
      throw err instanceof Error ? err : new Error(message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleSignOut() {
    if (accessToken) {
      await revokeGoogleAccessToken(accessToken)
    }
    clearSession()
    setAccessToken(null)
    setUser(null)
    setData(null)
    setYears([])
    setError(null)
    setView('dashboard')
  }

  if (bootstrapping) {
    return (
      <div className="flex h-full items-center justify-center bg-app-bg text-[12px] text-app-text-weak">
        Restoring session…
      </div>
    )
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

  const yearTabs: ReactNode = (
    <YearTabs
      years={years}
      selected={selectedYear}
      onSelect={handleSelectYear}
      disabled={switchingYear || refreshing}
    />
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-app-bg">
      <TopBar
        lastSynced={data.lastSynced}
        userEmail={user.email}
        onRefresh={handleRefresh}
        onSignOut={handleSignOut}
        onHome={() => {
          void handleHome()
        }}
        refreshing={refreshing}
        nav={<Nav active={view} onNavigate={setView} />}
        yearTabs={yearTabs}
      />
      {error ? (
        <div className="border-b border-app-border bg-kpi-reject-bg px-3 py-1 text-[11px] text-kpi-reject-text">
          {error}
        </div>
      ) : null}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        {switchingYear ? (
          <p className="mb-1.5 shrink-0 text-[11px] text-app-text-weak">
            Loading {selectedYear}…
          </p>
        ) : null}
        {view === 'dashboard' ? (
          <div className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
            <DashboardView
              data={data}
              onOpenApplications={(filter) => {
                setApplicationsFilter(filter)
                setView('applications')
              }}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <ApplicationsView
              applications={data.applications}
              statusFilter={applicationsFilter}
              onStatusFilterChange={setApplicationsFilter}
              saving={saving}
              adding={adding}
              deleting={deleting}
              onSaveStatusChanges={handleSaveStatusChanges}
              onAddApplication={handleAddApplication}
              onDeleteApplication={handleDeleteApplication}
            />
          </div>
        )}
      </main>
    </div>
  )
}
