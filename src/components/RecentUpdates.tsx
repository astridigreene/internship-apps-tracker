import { StatusPill } from './StatusPill'
import type { Application } from '../types'
import { parseSheetDate } from '../lib/time'

interface RecentUpdatesProps {
  applications: Application[]
  limit?: number
  onSelectApplication?: (app: Application) => void
}

function updatedTime(app: Application): number {
  return parseSheetDate(app.lastUpdated ?? '')?.getTime() ?? 0
}

export function RecentUpdates({
  applications,
  limit,
  onSelectApplication,
}: RecentUpdatesProps) {
  const recent = [...applications].sort((a, b) => {
    const aTime = updatedTime(a)
    const bTime = updatedTime(b)
    if (aTime === 0 && bTime === 0) {
      return a.company.localeCompare(b.company)
    }
    // No Last Updated → sink below rows that have one
    if (aTime === 0) {
      return 1
    }
    if (bTime === 0) {
      return -1
    }
    return bTime - aTime
  })
  const shown = limit === undefined ? recent : recent.slice(0, limit)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-panel-border bg-app-surface">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-app-border bg-app-muted px-2.5 py-1.5">
        <h2 className="text-[12px] font-semibold text-panel-title">Recent</h2>
      </div>
      <ul className="min-h-0 flex-1 overflow-auto">
        {shown.length === 0 ? (
          <li className="px-2.5 py-3 text-center text-[11px] text-app-text-weak">
            No applications yet.
          </li>
        ) : (
          shown.map((app, i) => {
            const interactive = Boolean(onSelectApplication)
            return (
              <li key={`${app.company}-${app.dateApplied}-${i}`} className="last:border-b-0">
                <button
                  type="button"
                  disabled={!interactive}
                  onClick={() => onSelectApplication?.(app)}
                  className={[
                    'flex w-full items-center gap-2 border-b border-app-border px-2.5 py-1.5 text-left',
                    interactive ? 'cursor-pointer hover:bg-app-hover' : 'cursor-default',
                  ].join(' ')}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-app-text">
                      {app.company}
                    </p>
                    <p className="truncate text-[10px] text-app-text-weak">{app.role}</p>
                  </div>
                  <StatusPill status={app.status} />
                </button>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
