import type { ReactNode } from 'react'
import { SIMPLIFY_JOBS_URL } from '../types'

interface TopBarProps {
  lastSynced: string | null
  userEmail?: string | null
  onRefresh?: () => void
  onSignOut?: () => void
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
  onHome,
  refreshing,
  nav,
  yearTabs,
}: TopBarProps) {
  return (
    <header className="shrink-0 border-b border-teal-700/40 bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-500 text-white dark:from-teal-950 dark:via-cyan-950 dark:to-slate-900 dark:border-teal-900">
      <div className="flex h-11 items-center gap-3 px-4">
        <button
          type="button"
          onClick={onHome}
          className="shrink-0 text-left text-[15px] font-bold tracking-tight text-white hover:text-white/90"
        >
          Internship Applications Tracker
        </button>
        {nav}
        <div className="min-w-0 flex-1" />
        {yearTabs}
        <div className="flex items-center gap-1.5 text-[12px] text-white/85">
          <a
            href={SIMPLIFY_JOBS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-7 items-center justify-center rounded border border-white/35 bg-white px-2.5 text-[12px] font-bold text-teal-800 hover:bg-white/90"
          >
            Apply
          </a>
          <span className="hidden sm:inline">{formatSynced(lastSynced)}</span>
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
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-white/30 bg-white/15 text-white hover:bg-white/25 disabled:opacity-50"
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
          {onSignOut ? (
            <button
              type="button"
              onClick={onSignOut}
              className="h-7 rounded border border-white/30 bg-white/15 px-2 text-[12px] font-medium text-white hover:bg-white/25"
            >
              Sign Out
            </button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
