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
    <div className="flex flex-col overflow-hidden rounded-md border border-panel-border bg-app-surface lg:h-full lg:min-h-0">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-app-border bg-app-muted px-3 py-2.5 lg:px-2.5 lg:py-1.5">
        <h2 className="text-[14px] font-bold text-panel-title lg:text-[12px] lg:font-semibold">
          Recent
        </h2>
      </div>
      <ul className="lg:min-h-0 lg:flex-1 lg:overflow-auto">
        {shown.length === 0 ? (
          <li className="px-3 py-4 text-center text-[13px] text-app-text-weak lg:px-2.5 lg:py-3 lg:text-[11px]">
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
                    'flex w-full items-center gap-2 border-b border-app-border px-3 py-3 text-left lg:px-2.5 lg:py-1.5',
                    interactive ? 'cursor-pointer hover:bg-app-hover' : 'cursor-default',
                  ].join(' ')}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-app-text lg:text-[12px]">
                      {app.company}
                    </p>
                    <p className="truncate text-[12px] text-app-text-weak lg:text-[10px]">
                      {app.role}
                    </p>
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
