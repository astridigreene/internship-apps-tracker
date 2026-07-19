import { StatusPill } from './StatusPill'
import type { Application } from '../types'

interface RecentUpdatesProps {
  applications: Application[]
  limit?: number
}

function parseDate(value: string): number {
  const t = Date.parse(value)
  return Number.isNaN(t) ? 0 : t
}

export function RecentUpdates({ applications, limit = 5 }: RecentUpdatesProps) {
  const recent = [...applications]
    .sort((a, b) => parseDate(b.dateApplied) - parseDate(a.dateApplied))
    .slice(0, limit)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-panel-border bg-app-surface">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-app-border bg-app-muted px-2.5 py-1.5">
        <h2 className="text-[12px] font-semibold text-panel-title">Recent</h2>
      </div>
      <ul className="min-h-0 flex-1 overflow-auto">
        {recent.length === 0 ? (
          <li className="px-2.5 py-3 text-center text-[11px] text-app-text-weak">
            No applications yet.
          </li>
        ) : (
          recent.map((app, i) => (
            <li
              key={`${app.company}-${app.dateApplied}-${i}`}
              className="flex items-center gap-2 border-b border-app-border px-2.5 py-1.5 last:border-b-0 hover:bg-app-hover"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-app-text">{app.company}</p>
                <p className="truncate text-[10px] text-app-text-weak">{app.role}</p>
              </div>
              <StatusPill status={app.status} />
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
