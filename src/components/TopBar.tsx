interface TopBarProps {
  lastSynced: string
}

function formatSynced(iso: string): string {
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

export function TopBar({ lastSynced }: TopBarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-slds-border bg-slds-surface px-4">
      <h1 className="text-base font-bold text-slds-text">Application Tracker</h1>
      <p className="text-xs text-slds-text-weak">
        Last synced: {formatSynced(lastSynced)}
      </p>
    </header>
  )
}
