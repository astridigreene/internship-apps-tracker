interface LoginScreenProps {
  configured: boolean
  loading: boolean
  error: string | null
  onSignIn: () => void
}

export function LoginScreen({ configured, loading, error, onSignIn }: LoginScreenProps) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-slds-bg p-6">
      <div className="w-full max-w-md rounded-[2px] border border-slds-border bg-slds-surface p-6">
        <p className="text-[11px] font-bold tracking-wider text-slds-text-weak uppercase">
          Application Tracker
        </p>
        <h1 className="mt-2 text-xl font-bold text-slds-text">Sign in required</h1>
        <p className="mt-2 text-sm text-slds-text-weak">
          Sign in with the Google account that has access to your private application
          spreadsheet. Application data is loaded from the sheet after login and is not
          stored in this repository.
        </p>

        {!configured ? (
          <p className="mt-4 border border-slds-border bg-slds-bg px-3 py-2 text-sm text-slds-text">
            Missing <code className="text-xs">VITE_GOOGLE_CLIENT_ID</code> or{' '}
            <code className="text-xs">VITE_SHEET_ID</code>. See the README for OAuth setup.
          </p>
        ) : (
          <button
            type="button"
            onClick={onSignIn}
            disabled={loading}
            className="mt-5 h-9 rounded-[2px] bg-slds-brand px-4 text-sm font-semibold text-white hover:bg-slds-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in with Google'}
          </button>
        )}

        {error ? (
          <p className="mt-4 text-sm text-[#ba0517]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
