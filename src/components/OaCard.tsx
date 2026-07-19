import { useMemo } from 'react'
import type { Application } from '../types'
import { formatElapsedDays, parseSheetDate } from '../lib/time'

interface OaCardProps {
  applications: Application[]
  onOpenAll?: () => void
}

export function OaCard({ applications, onOpenAll }: OaCardProps) {
  const oaApps = useMemo(() => {
    return applications
      .filter((app) => app.status === 'OA')
      .slice()
      .sort((a, b) => {
        const aTime = parseSheetDate(a.lastUpdated ?? '')?.getTime() ?? 0
        const bTime = parseSheetDate(b.lastUpdated ?? '')?.getTime() ?? 0
        if (aTime === 0 && bTime === 0) {
          return a.company.localeCompare(b.company)
        }
        if (aTime === 0) {
          return 1
        }
        if (bTime === 0) {
          return -1
        }
        return aTime - bTime
      })
  }, [applications])

  const count = oaApps.length

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-kpi-oa-border bg-kpi-oa-bg">
      <div className="flex shrink-0 items-center border-b border-kpi-oa-border/60 px-2.5 py-1.5">
        {onOpenAll ? (
          <button
            type="button"
            onClick={onOpenAll}
            className="text-left text-[12px] font-semibold text-kpi-oa-text hover:underline"
          >
            {count} OA{count === 1 ? '' : 's'} to complete
          </button>
        ) : (
          <h2 className="text-[12px] font-semibold text-kpi-oa-text">
            {count} OA{count === 1 ? '' : 's'} to complete
          </h2>
        )}
      </div>

      {count === 0 ? (
        <p className="px-2.5 py-2 text-[12px] text-kpi-oa-text/80">No open OAs.</p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {oaApps.map((app) => {
            const elapsed = formatElapsedDays(parseSheetDate(app.lastUpdated ?? ''))
            return (
              <li
                key={app.sheetRow}
                className="flex items-center justify-between gap-2 border-b border-kpi-oa-border/40 px-2.5 py-1.5 last:border-b-0"
              >
                <p className="min-w-0 truncate text-[12px] font-semibold text-kpi-oa-text">
                  {app.company || 'Untitled'}
                  {app.role ? (
                    <span className="font-normal text-app-text-weak"> · {app.role}</span>
                  ) : null}
                </p>
                <p
                  className={[
                    'shrink-0 text-[11px] font-semibold tabular-nums',
                    app.lastUpdated ? 'text-kpi-oa-text' : 'text-app-text-weak',
                  ].join(' ')}
                  title={app.lastUpdated ?? undefined}
                >
                  {elapsed}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
