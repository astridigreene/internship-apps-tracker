interface ConnectSheetScreenProps {
  userEmail: string
  loading?: boolean
  error: string | null
  onConnect: (sheetIdOrUrl: string) => void
  onSignOut: () => void
}

export function ConnectSheetScreen({
  userEmail,
  loading,
  error,
  onConnect,
  onSignOut,
}: ConnectSheetScreenProps) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-panel-border bg-app-surface shadow-[0_8px_24px_rgba(13,148,136,0.12)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
        <div className="bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-500 px-4 py-3 text-white dark:from-teal-800 dark:via-cyan-900 dark:to-slate-900">
          <p className="text-[10px] font-semibold tracking-[0.08em] text-white/80 uppercase">
            Connect spreadsheet
          </p>
          <h1 className="mt-0.5 text-[15px] font-semibold tracking-tight">
            Link your Google Sheet
          </h1>
        </div>
        <form
          className="space-y-3 p-4"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            const value = String(form.get('sheet') ?? '')
            onConnect(value)
          }}
        >
          <p className="text-[12px] text-app-text-weak">
            Signed in as <span className="font-semibold text-app-text">{userEmail}</span>. Paste
            your spreadsheet URL or ID once — we’ll remember it on this browser for your
            account, including after you sign out.
          </p>

          <label className="block text-[11px] font-bold tracking-[0.06em] uppercase text-app-text-weak">
            Spreadsheet URL or ID
            <input
              name="sheet"
              required
              autoFocus
              placeholder="https://docs.google.com/spreadsheets/d/…"
              className="mt-1 h-9 w-full rounded border border-app-border bg-app-surface px-2.5 text-[13px] font-semibold text-app-text outline-none focus:border-app-brand"
            />
          </label>

          <p className="text-[11px] text-app-text-weak">
            Expected year tabs (e.g. <span className="font-semibold">2027</span>) with columns:
            Company, Location, Role, Date Applied, Status.
          </p>

          {error ? (
            <p className="text-[12px] font-semibold text-kpi-reject-text" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={onSignOut}
              disabled={loading}
              className="h-9 rounded border border-app-border px-3 text-[12px] font-bold text-app-text hover:bg-app-hover disabled:opacity-50"
            >
              Sign out
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-9 rounded bg-app-brand px-3 text-[12px] font-bold text-white hover:bg-app-brand-dark disabled:cursor-not-allowed disabled:opacity-50 dark:text-teal-950"
            >
              {loading ? 'Connecting…' : 'Connect sheet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
