import {
  OPTIONAL_COLUMN_GUIDE,
  REQUIRED_COLUMN_GUIDE,
  type SheetSetupError,
} from '../lib/sheet'

interface SheetSetupHelpProps {
  error: SheetSetupError
  yearTab?: string | null
  loading?: boolean
  onRetry?: () => void
  onChangeSheet?: () => void
  onSignOut?: () => void
}

export function SheetSetupHelp({
  error,
  yearTab,
  loading,
  onRetry,
  onChangeSheet,
  onSignOut,
}: SheetSetupHelpProps) {
  const missing = new Set(error.details.missing ?? [])
  const found = error.details.foundHeaders ?? []

  return (
    <div className="flex h-full min-h-0 items-center justify-center overflow-y-auto p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-panel-border bg-app-surface shadow-[0_8px_24px_rgba(13,148,136,0.12)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
        <div className="bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 px-4 py-3 text-white dark:from-amber-900 dark:via-orange-950 dark:to-slate-900">
          <p className="text-[10px] font-semibold tracking-[0.08em] text-white/80 uppercase">
            Sheet setup needed
          </p>
          <h1 className="mt-0.5 text-[15px] font-semibold tracking-tight">
            Fix your column headers
          </h1>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-[13px] font-semibold text-app-text">{error.message}</p>

          {error.details.reason === 'no-year-tabs' ? (
            <div className="rounded border border-app-border bg-app-muted px-3 py-2 text-[12px] text-app-text">
              <p className="font-bold">How to fix</p>
              <ol className="mt-1 list-decimal space-y-1 pl-4 font-medium text-app-text-weak">
                <li>Open your Google Spreadsheet</li>
                <li>
                  Rename a tab to a four-digit year (e.g. <span className="font-bold text-app-text">2027</span>)
                </li>
                <li>Put column headers in row 1 of that tab</li>
                <li>Click Try again</li>
              </ol>
            </div>
          ) : (
            <>
              {yearTab ? (
                <p className="text-[12px] font-medium text-app-text-weak">
                  Checking year tab{' '}
                  <span className="font-bold text-app-text">{yearTab}</span> — headers must be
                  in row 1.
                </p>
              ) : (
                <p className="text-[12px] font-medium text-app-text-weak">
                  Put these names in row 1 of your year tab (e.g. 2027). Spelling can vary a
                  little for the aliases below.
                </p>
              )}

              <div>
                <p className="text-[11px] font-bold tracking-[0.06em] uppercase text-app-text-weak">
                  Required columns
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {REQUIRED_COLUMN_GUIDE.map((col) => {
                    const isMissing = missing.has(col.label)
                    return (
                      <li
                        key={col.label}
                        className={[
                          'rounded border px-2.5 py-1.5 text-[12px]',
                          isMissing
                            ? 'border-rose-300 bg-rose-500/10 text-rose-800 dark:border-rose-500/40 dark:text-rose-200'
                            : 'border-app-border bg-app-muted text-app-text',
                        ].join(' ')}
                      >
                        <span className="font-bold">
                          {isMissing ? 'Add: ' : 'OK: '}
                          {col.label}
                        </span>
                        <span className="mt-0.5 block font-medium opacity-80">{col.hint}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div>
                <p className="text-[11px] font-bold tracking-[0.06em] uppercase text-app-text-weak">
                  Optional columns
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {OPTIONAL_COLUMN_GUIDE.map((col) => (
                    <li
                      key={col.label}
                      className="rounded border border-app-border bg-app-muted px-2.5 py-1.5 text-[12px] text-app-text"
                    >
                      <span className="font-bold">{col.label}</span>
                      <span className="mt-0.5 block font-medium text-app-text-weak">
                        {col.hint}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded border border-app-border px-2.5 py-2">
                <p className="text-[11px] font-bold tracking-[0.06em] uppercase text-app-text-weak">
                  Headers found in row 1
                </p>
                <p className="mt-1 text-[12px] font-semibold text-app-text">
                  {found.length ? found.join(' · ') : '(none)'}
                </p>
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-app-border pt-3">
            <div className="flex flex-wrap gap-2">
              {onSignOut ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  disabled={loading}
                  className="h-9 rounded border border-app-border px-3 text-[12px] font-bold text-app-text hover:bg-app-hover disabled:opacity-50"
                >
                  Sign out
                </button>
              ) : null}
              {onChangeSheet ? (
                <button
                  type="button"
                  onClick={onChangeSheet}
                  disabled={loading}
                  className="h-9 rounded border border-app-border px-3 text-[12px] font-bold text-app-text hover:bg-app-hover disabled:opacity-50"
                >
                  Different sheet
                </button>
              ) : null}
            </div>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                disabled={loading}
                className="h-9 rounded bg-app-brand px-3 text-[12px] font-bold text-white hover:bg-app-brand-dark disabled:cursor-not-allowed disabled:opacity-50 dark:text-teal-950"
              >
                {loading ? 'Checking…' : 'Try again'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
