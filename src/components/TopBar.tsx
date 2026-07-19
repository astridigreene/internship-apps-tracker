interface TopBarProps {
  lastSynced: string | null
  userEmail?: string | null
  onRefresh?: () => void
  onSignOut?: () => void
  refreshing?: boolean
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
    year: 'numeric',
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
  refreshing,
}: TopBarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-slds-border bg-slds-surface px-4">
      <h1 className="text-base font-bold text-slds-text">Application Tracker</h1>
      <div className="flex items-center gap-3 text-xs text-slds-text-weak">
        <span>Last synced: {formatSynced(lastSynced)}</span>
        {userEmail ? <span className="hidden sm:inline">{userEmail}</span> : null}
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="h-7 rounded-[2px] border border-slds-border bg-slds-surface px-2 font-semibold text-slds-text hover:bg-slds-hover disabled:opacity-60"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        ) : null}
        {onSignOut ? (
          <button
            type="button"
            onClick={onSignOut}
            className="h-7 rounded-[2px] border border-slds-border bg-slds-surface px-2 font-semibold text-slds-text hover:bg-slds-hover"
          >
            Sign out
          </button>
        ) : null}
      </div>
    </header>
  )
}
