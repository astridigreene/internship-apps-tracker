import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
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
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) {
      return
    }
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null
      if (target && menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const desktopBtn =
    'inline-flex h-7 shrink-0 items-center justify-center rounded border border-white/30 bg-white/15 px-2 text-[12px] font-medium text-white hover:bg-white/25 disabled:opacity-50'

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-teal-700/40 bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-500 text-white dark:border-teal-900 dark:from-teal-950 dark:via-cyan-950 dark:to-slate-900">
      {/* Mobile header */}
      <div
        className="flex flex-col gap-2 px-3 py-2 lg:hidden"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onHome}
            className="min-w-0 flex-1 truncate text-left text-[17px] font-bold tracking-tight text-white"
          >
            Tracker
          </button>
          <a
            href={SIMPLIFY_JOBS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-white/35 bg-white px-3 text-[13px] font-bold text-teal-800"
          >
            Apply
          </a>
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/30 bg-white/15 disabled:opacity-50"
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
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
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/30 bg-white/15"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <circle cx="12" cy="5" r="1.75" />
                <circle cx="12" cy="12" r="1.75" />
                <circle cx="12" cy="19" r="1.75" />
              </svg>
            </button>
            {menuOpen ? (
              <div
                id={menuId}
                role="menu"
                className="absolute top-11 right-0 z-50 w-44 overflow-hidden rounded-xl border border-app-border bg-app-surface py-1 text-app-text shadow-[0_12px_32px_rgba(0,0,0,0.2)]"
              >
                {userEmail ? (
                  <p className="truncate border-b border-app-border px-3 py-2 text-[11px] font-semibold text-app-text-weak">
                    {userEmail}
                  </p>
                ) : null}
                <p className="px-3 py-1.5 text-[11px] font-semibold text-app-text-weak">
                  Synced {formatSynced(lastSynced)}
                </p>
                {onChangeSheet ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full px-3 py-2.5 text-left text-[13px] font-bold hover:bg-app-hover"
                    onClick={() => {
                      setMenuOpen(false)
                      onChangeSheet()
                    }}
                  >
                    Change sheet
                  </button>
                ) : null}
                {onSignOut ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full px-3 py-2.5 text-left text-[13px] font-bold text-rose-600 hover:bg-app-hover dark:text-rose-400"
                    onClick={() => {
                      setMenuOpen(false)
                      onSignOut()
                    }}
                  >
                    Sign out
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        {yearTabs ? <div className="overflow-x-auto">{yearTabs}</div> : null}
      </div>

      {/* Desktop header */}
      <div className="hidden h-11 items-center gap-3 px-4 lg:flex">
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
          <span className="hidden xl:inline">{formatSynced(lastSynced)}</span>
          {userEmail ? (
            <span className="hidden max-w-[140px] truncate 2xl:inline">{userEmail}</span>
          ) : null}
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh"
              title="Refresh"
              className={`${desktopBtn} w-7 px-0`}
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
            <button type="button" onClick={onChangeSheet} className={desktopBtn}>
              Sheet
            </button>
          ) : null}
          {onSignOut ? (
            <button type="button" onClick={onSignOut} className={desktopBtn}>
              Sign Out
            </button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
