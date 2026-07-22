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
  isSheetSetupError,
  listYearSheets,
  nextSummerYear,
  pickDefaultYear,
  SheetSetupError,
  updateSheetOaComplete,
  updateSheetStatus,
} from './lib/sheet'
import { statusUpdateStamp } from './lib/time'
import { celebrate } from './lib/celebrate'
import { pingGithubActivity } from './lib/githubPing'
import {
  clearSession,
  clearSheetIdForEmail,
  getSavedSheetIdForEmail,
  isSessionValid,
  loadSession,
  parseSpreadsheetId,
  saveSession,
  saveSheetIdForEmail,
  sessionExpiresAt,
} from './lib/session'
import { Nav } from './components/Nav'
import { TopBar } from './components/TopBar'
import { LoginScreen } from './components/LoginScreen'
import { ConnectSheetScreen } from './components/ConnectSheetScreen'
import { SheetSetupHelp } from './components/SheetSetupHelp'
import { YearTabs } from './components/YearTabs'
import { DashboardView } from './views/DashboardView'
import {
  ApplicationsView,
  type ApplicationsStatusFilter,
  type StatusEditChange,
} from './views/ApplicationsView'

export default function App() {
  const config = getConfig()
  const [view, setView] = useState<ViewId>('dashboard')
  const [applicationsFilter, setApplicationsFilter] =
    useState<ApplicationsStatusFilter>('Active')
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [user, setUser] = useState<GoogleUser | null>(null)
  const [sheetId, setSheetId] = useState<string | null>(null)
  const [years, setYears] = useState<string[]>([])
  const [selectedYear, setSelectedYear] = useState(() => nextSummerYear())
  const [data, setData] = useState<TrackerData | null>(null)
  const [loading, setLoading] = useState(false)
  const [connectingSheet, setConnectingSheet] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [switchingYear, setSwitchingYear] = useState(false)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sheetSetupError, setSheetSetupError] = useState<SheetSetupError | null>(null)

  const resolveSheetId = useCallback(
    (email: string, explicit?: string | null) => {
      return (
        explicit?.trim() ||
        getSavedSheetIdForEmail(email) ||
        config.defaultSheetId ||
        null
      )
    },
    [config.defaultSheetId],
  )

  const persist = useCallback(
    (opts: {
      token: string
      expiresIn: number
      profile: GoogleUser
      year?: string
      /**
       * string = set, null = clear from session, omit = keep whatever is already saved.
       * Email sheet prefs are the long-lived source of truth (see rememberSheetId).
       */
      sheetId?: string | null
    }) => {
      const existing = loadSession()
      const nextSheetId =
        opts.sheetId !== undefined
          ? opts.sheetId?.trim() || undefined
          : existing?.sheetId
      saveSession({
        accessToken: opts.token,
        expiresAt: sessionExpiresAt(opts.expiresIn),
        user: opts.profile,
        selectedYear: opts.year ?? existing?.selectedYear ?? selectedYear,
        sheetId: nextSheetId,
      })
      if (nextSheetId) {
        saveSheetIdForEmail(opts.profile.email, nextSheetId)
      }
    },
    [selectedYear],
  )

  function applySheetSetupError(err: SheetSetupError, spreadsheetId?: string) {
    setSheetSetupError(err)
    setError(null)
    setData(null)
    if (spreadsheetId) {
      setSheetId(spreadsheetId)
    }
  }

  const loadYearData = useCallback(
    async (token: string, spreadsheetId: string, year: string) => {
      const values = await fetchSheetValues(spreadsheetId, token, year)
      setData(buildTrackerData(values))
      setSelectedYear(year)
      setSheetSetupError(null)
      const existing = loadSession()
      if (existing) {
        saveSession({
          ...existing,
          selectedYear: year,
          accessToken: token,
          sheetId: spreadsheetId,
        })
      }
    },
    [],
  )

  const loadTrackerForSheet = useCallback(
    async (token: string, spreadsheetId: string, preferredYear?: string) => {
      try {
        const yearTabs = await listYearSheets(spreadsheetId, token)
        const preferred = nextSummerYear()
        const year = pickDefaultYear(
          yearTabs,
          preferredYear && yearTabs.includes(preferredYear) ? preferredYear : preferred,
        )
        setYears(yearTabs)
        setSheetId(spreadsheetId)
        await loadYearData(token, spreadsheetId, year)
      } catch (err) {
        if (isSheetSetupError(err)) {
          applySheetSetupError(err, spreadsheetId)
          return
        }
        throw err
      }
    },
    [loadYearData],
  )

  const establishSession = useCallback(
    async (opts?: { prompt?: '' | 'consent'; preferredYear?: string }) => {
      const { accessToken: token, expiresIn } = await requestGoogleAccessToken(
        config.clientId,
        { prompt: opts?.prompt ?? '' },
      )
      const profile = await fetchUserProfile(token)
      const existing = loadSession()
      const nextSheetId = resolveSheetId(profile.email, existing?.sheetId)

      persist({
        token,
        expiresIn,
        profile,
        year: opts?.preferredYear,
        sheetId: nextSheetId,
      })
      setAccessToken(token)
      setUser(profile)

      if (nextSheetId) {
        await loadTrackerForSheet(token, nextSheetId, opts?.preferredYear)
      } else {
        setSheetId(null)
        setData(null)
        setYears([])
        setSheetSetupError(null)
      }
    },
    [config.clientId, loadTrackerForSheet, persist, resolveSheetId],
  )

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
          const nextSheetId = resolveSheetId(saved.user.email, saved.sheetId)
          if (nextSheetId) {
            saveSheetIdForEmail(saved.user.email, nextSheetId)
          }
          setAccessToken(saved.accessToken)
          setUser(saved.user)
          if (!nextSheetId) {
            setSheetId(null)
            setData(null)
            return
          }
          await loadTrackerForSheet(
            saved.accessToken,
            nextSheetId,
            saved.selectedYear,
          )
          if (cancelled) {
            return
          }
          return
        }

        if (saved?.user) {
          const { accessToken: token, expiresIn } = await requestGoogleAccessToken(
            config.clientId,
            { prompt: '' },
          )
          const profile = await fetchUserProfile(token)
          const nextSheetId = resolveSheetId(profile.email, saved.sheetId)
          persist({
            token,
            expiresIn,
            profile,
            year: saved.selectedYear,
            sheetId: nextSheetId,
          })
          if (cancelled) {
            return
          }
          setAccessToken(token)
          setUser(profile)
          if (!nextSheetId) {
            setSheetId(null)
            setData(null)
            return
          }
          await loadTrackerForSheet(token, nextSheetId, saved.selectedYear)
        }
      } catch {
        // Keep remembered sheet prefs; only drop the short-lived OAuth session.
        clearSession()
        if (!cancelled) {
          setAccessToken(null)
          setUser(null)
          setSheetId(null)
          setData(null)
          setYears([])
          setSheetSetupError(null)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSignIn() {
    setError(null)
    setSheetSetupError(null)
    setLoading(true)
    try {
      const saved = loadSession()
      await establishSession({ prompt: '', preferredYear: saved?.selectedYear })
    } catch (err) {
      // Do not clear remembered sheet prefs — next successful sign-in should reconnect.
      clearSession()
      setAccessToken(null)
      setUser(null)
      setSheetId(null)
      setData(null)
      setYears([])
      setSheetSetupError(null)
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleConnectSheet(sheetIdOrUrl: string) {
    if (!accessToken || !user) {
      return
    }
    const parsed = parseSpreadsheetId(sheetIdOrUrl)
    if (!parsed) {
      setError('Enter a valid Google Sheets URL or spreadsheet ID.')
      return
    }

    setError(null)
    setSheetSetupError(null)
    setConnectingSheet(true)
    try {
      const token = await ensureFreshToken()
      await loadTrackerForSheet(token, parsed, selectedYear)
      saveSheetIdForEmail(user.email, parsed)
      const existing = loadSession()
      if (existing) {
        saveSession({ ...existing, sheetId: parsed, accessToken: token })
      }
    } catch (err) {
      if (isSheetSetupError(err)) {
        applySheetSetupError(err, parsed)
        saveSheetIdForEmail(user.email, parsed)
        return
      }
      setSheetId(null)
      setData(null)
      setYears([])
      setSheetSetupError(null)
      setError(
        err instanceof Error
          ? err.message
          : 'Could not open that spreadsheet. Confirm it is shared with your Google account.',
      )
    } finally {
      setConnectingSheet(false)
    }
  }

  async function handleRetrySheetSetup() {
    if (!sheetId || !accessToken) {
      return
    }
    setConnectingSheet(true)
    setError(null)
    try {
      const token = await ensureFreshToken()
      await loadTrackerForSheet(token, sheetId, selectedYear)
    } catch (err) {
      if (isSheetSetupError(err)) {
        applySheetSetupError(err, sheetId)
        return
      }
      setError(err instanceof Error ? err.message : 'Could not reload spreadsheet')
    } finally {
      setConnectingSheet(false)
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
    persist({
      token,
      expiresIn,
      profile,
      // Omit sheetId so a temporary null React state doesn't wipe the saved sheet.
    })
    setAccessToken(token)
    setUser(profile)
    return token
  }

  async function handleRefresh() {
    if (!sheetId) {
      return
    }
    setError(null)
    setRefreshing(true)
    try {
      const token = await ensureFreshToken()
      const yearTabs = await listYearSheets(sheetId, token)
      setYears(yearTabs)
      const year = yearTabs.includes(selectedYear)
        ? selectedYear
        : pickDefaultYear(yearTabs, nextSummerYear())
      await loadYearData(token, sheetId, year)
    } catch (err) {
      if (isSheetSetupError(err)) {
        applySheetSetupError(err, sheetId)
        return
      }
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  async function handleSelectYear(year: string) {
    if (!sheetId || year === selectedYear) {
      return
    }
    setError(null)
    setSwitchingYear(true)
    try {
      const token = await ensureFreshToken()
      await loadYearData(token, sheetId, year)
    } catch (err) {
      if (isSheetSetupError(err)) {
        applySheetSetupError(err, sheetId)
        setSelectedYear(year)
        return
      }
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

  function handleChangeSheet() {
    setData(null)
    setYears([])
    setSheetId(null)
    setError(null)
    setSheetSetupError(null)
    setView('dashboard')
    if (user) {
      clearSheetIdForEmail(user.email)
    }
    const existing = loadSession()
    if (existing) {
      saveSession({ ...existing, sheetId: undefined })
    }
  }

  async function handleSaveStatusChanges(changes: StatusEditChange[]) {
    if (!accessToken || !data || !sheetId || changes.length === 0) {
      return
    }

    const previous = data
    const stamp = statusUpdateStamp()
    setError(null)
    setSaving(true)

    const byRow = new Map(changes.map((change) => [change.app.sheetRow, change.toStatus]))
    const nextApps = data.applications.map((row) => {
      const nextStatus = byRow.get(row.sheetRow)
      if (!nextStatus) {
        return row
      }
      let oaComplete = row.oaComplete
      if (data.columns.oaComplete !== null && nextStatus === 'OA' && oaComplete !== 'Y') {
        oaComplete = 'N'
      }
      return { ...row, status: nextStatus, lastUpdated: stamp, oaComplete }
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
          spreadsheetId: sheetId,
          accessToken: token,
          sheetTitle: selectedYear,
          sheetRow: change.app.sheetRow,
          columns,
          status: change.toStatus,
          lastUpdatedStamp: stamp,
        })
        if (
          columns.oaComplete !== null &&
          change.toStatus === 'OA' &&
          change.app.oaComplete !== 'Y'
        ) {
          await updateSheetOaComplete({
            spreadsheetId: sheetId,
            accessToken: token,
            sheetTitle: selectedYear,
            sheetRow: change.app.sheetRow,
            columns,
            oaComplete: 'N',
          })
        }
      }
      setData((current) => (current ? { ...current, columns } : current))
      if (changes.some((change) => isForwardProgress(change.fromStatus, change.toStatus))) {
        celebrate()
        void pingGithubActivity().catch(() => {
          // best-effort — Sheet write already succeeded
        })
      }
    } catch (err) {
      setData(previous)
      setError(err instanceof Error ? err.message : 'Could not save status changes')
      throw err instanceof Error ? err : new Error('Could not save status changes')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateOaComplete(app: Application, oaComplete: 'N/A' | 'N' | 'Y') {
    if (!accessToken || !data || !sheetId) {
      return
    }
    if (app.oaComplete === oaComplete) {
      return
    }

    const previous = data
    setError(null)
    setSaving(true)

    const nextApps = data.applications.map((row) =>
      row.sheetRow === app.sheetRow ? { ...row, oaComplete } : row,
    )
    setData({
      ...data,
      applications: nextApps,
      lastSynced: new Date().toISOString(),
    })

    try {
      const token = await ensureFreshToken()
      await updateSheetOaComplete({
        spreadsheetId: sheetId,
        accessToken: token,
        sheetTitle: selectedYear,
        sheetRow: app.sheetRow,
        columns: data.columns,
        oaComplete,
      })
    } catch (err) {
      setData(previous)
      setError(err instanceof Error ? err.message : 'Could not update OA Complete')
      throw err instanceof Error ? err : new Error('Could not update OA Complete')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddApplication(application: NewApplicationInput) {
    if (!accessToken || !data || !sheetId) {
      return
    }

    const stamp = statusUpdateStamp()
    setError(null)
    setAdding(true)

    try {
      const token = await ensureFreshToken()
      const { columns, sheetRow } = await appendSheetApplication({
        spreadsheetId: sheetId,
        accessToken: token,
        sheetTitle: selectedYear,
        columns: data.columns,
        application,
        lastUpdatedStamp: stamp,
      })

      const nextApp: Application = {
        ...application,
        lastUpdated: stamp,
        oaComplete:
          data.columns.oaComplete === null
            ? null
            : application.status === 'OA'
              ? 'N'
              : 'N/A',
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
      // Empty GitHub commit only (no application fields). Optional; ignores failures.
      void pingGithubActivity().catch(() => {
        // ping is best-effort — Sheet write already succeeded
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not add application'
      setError(message)
      throw err instanceof Error ? err : new Error(message)
    } finally {
      setAdding(false)
    }
  }

  async function handleDeleteApplication(app: Application) {
    if (!accessToken || !data || !sheetId) {
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
        spreadsheetId: sheetId,
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
    setSheetId(null)
    setData(null)
    setYears([])
    setError(null)
    setSheetSetupError(null)
    setView('dashboard')
  }

  if (bootstrapping) {
    return (
      <div className="flex h-full items-center justify-center bg-app-bg text-[12px] text-app-text-weak">
        Restoring session…
      </div>
    )
  }

  if (!accessToken || !user) {
    return (
      <LoginScreen
        configured={config.isConfigured}
        loading={loading}
        error={error}
        onSignIn={handleSignIn}
      />
    )
  }

  if (sheetSetupError) {
    return (
      <div className="h-full min-h-0 bg-app-bg">
        <SheetSetupHelp
          error={sheetSetupError}
          yearTab={selectedYear}
          loading={connectingSheet || refreshing || switchingYear}
          onRetry={() => {
            void handleRetrySheetSetup()
          }}
          onChangeSheet={handleChangeSheet}
          onSignOut={() => {
            void handleSignOut()
          }}
        />
      </div>
    )
  }

  if (!sheetId || !data) {
    return (
      <ConnectSheetScreen
        userEmail={user.email}
        loading={connectingSheet}
        error={error}
        onConnect={(value) => {
          void handleConnectSheet(value)
        }}
        onSignOut={() => {
          void handleSignOut()
        }}
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
        onChangeSheet={handleChangeSheet}
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
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3">
        {switchingYear ? (
          <p className="mb-1.5 shrink-0 text-[11px] text-app-text-weak">
            Loading {selectedYear}…
          </p>
        ) : null}
        {view === 'dashboard' ? (
          <div className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
            <DashboardView
              data={data}
              saving={saving}
              onOpenApplications={(filter) => {
                setApplicationsFilter(filter)
                setView('applications')
              }}
              onSaveStatusChanges={handleSaveStatusChanges}
              onUpdateOaComplete={handleUpdateOaComplete}
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
              onUpdateOaComplete={handleUpdateOaComplete}
            />
          </div>
        )}
      </main>
    </div>
  )
}
