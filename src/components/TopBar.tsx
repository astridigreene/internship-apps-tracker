import type { ReactNode } from 'react'
import { SIMPLIFY_JOBS_URL } from '../types'

interface TopBarProps {
  lastSynced: string | null
  userEmail?: string | null
  onRefresh?: () => void
  onSignOut?: () => void
  onChangeSheet?: () => void
  onHome?: () => void
  refreshing?: boolean
  nav?: ReactNode
  yearTabs?: ReactNode
}

function formatSynced(iso: string | null): string {
  if (!iso) {
    return 'never'
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function TopBar({
  lastSynced,
  userEmail,
  onRefresh,
  onSignOut,
  onChangeSheet,
  onHome,
  refreshing,
  nav,
  yearTabs,
}: TopBarProps) {
  const actionBtn =
    'inline-flex h-8 shrink-0 items-center justify-center rounded border border-white/30 bg-white/15 px-2 text-[12px] font-medium text-white hover:bg-white/25 disabled:opacity-50 sm:h-7'

  return (
    <header className="shrink-0 border-b border-teal-700/40 bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-500 text-white dark:border-teal-900 dark:from-teal-950 dark:via-cyan-950 dark:to-slate-900">
      <div className="flex flex-col gap-2 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:h-11 sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-0 sm:pt-0">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onHome}
            className="min-w-0 shrink truncate text-left text-[15px] font-bold tracking-tight text-white hover:text-white/90"
          >
            <span className="sm:hidden">Tracker</span>
            <span className="hidden sm:inline">Internship Applications Tracker</span>
          </button>
          <div className="hidden shrink-0 sm:block">{nav}</div>
          <div className="min-w-0 flex-1" />
          <div className="hidden shrink-0 md:block">{yearTabs}</div>
          <div className="flex shrink-0 items-center gap-1.5 text-[12px] text-white/85">
            <a
              href={SIMPLIFY_JOBS_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center justify-center rounded border border-white/35 bg-white px-2.5 text-[12px] font-bold text-teal-800 hover:bg-white/90 sm:h-7"
            >
              Apply
            </a>
            <span className="hidden lg:inline">{formatSynced(lastSynced)}</span>
            {userEmail ? (
              <span className="hidden max-w-[140px] truncate xl:inline">{userEmail}</span>
            ) : null}
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                aria-label="Refresh"
                title="Refresh"
                className={`${actionBtn} w-8 px-0 sm:w-7`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
              </button>
            ) : null}
            {onChangeSheet ? (
              <button type="button" onClick={onChangeSheet} className={actionBtn}>
                Sheet
              </button>
            ) : null}
            {onSignOut ? (
              <button type="button" onClick={onSignOut} className={actionBtn}>
                <span className="sm:hidden">Out</span>
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-between gap-2 sm:hidden">
          <div className="min-w-0 overflow-x-auto">{nav}</div>
          <div className="shrink-0 overflow-x-auto">{yearTabs}</div>
        </div>
      </div>
    </header>
  )
}
