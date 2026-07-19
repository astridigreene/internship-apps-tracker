interface LoginScreenProps {
  configured: boolean
  loading: boolean
  error: string | null
  onSignIn: () => void
}

export function LoginScreen({ configured, loading, error, onSignIn }: LoginScreenProps) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center p-4">
      <div className="w-full max-w-xs overflow-hidden rounded-lg border border-panel-border bg-app-surface shadow-[0_8px_24px_rgba(13,148,136,0.12)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
        <div className="bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-500 px-4 py-3 text-white dark:from-teal-800 dark:via-cyan-900 dark:to-slate-900">
          <p className="text-[10px] font-semibold tracking-[0.08em] text-white/80 uppercase">
            Tracker
          </p>
          <h1 className="mt-0.5 text-[15px] font-semibold tracking-tight">Sign in required</h1>
        </div>
        <div className="p-4">
          <p className="text-[12px] text-app-text-weak">
            Sign in with the Google account that can access your private spreadsheet.
          </p>

          {!configured ? (
            <p className="mt-3 rounded border border-app-border bg-app-muted px-2 py-1.5 text-[11px] text-app-text">
              Missing <code className="text-[10px]">VITE_GOOGLE_CLIENT_ID</code> or{' '}
              <code className="text-[10px]">VITE_SHEET_ID</code>.
            </p>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              disabled={loading}
              className="mt-3 h-7 rounded bg-app-brand px-3 text-[12px] font-semibold text-white hover:bg-app-brand-dark disabled:opacity-60 dark:text-teal-950"
            >
              {loading ? 'Signing in…' : 'Sign in with Google'}
            </button>
          )}

          {error ? (
            <p className="mt-2 text-[11px] text-kpi-reject-text" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
