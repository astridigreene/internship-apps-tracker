import { useMemo } from 'react'
import { isOaIncomplete, type Application } from '../types'
import { formatElapsedDays, parseSheetDate } from '../lib/time'

interface OaCardProps {
  applications: Application[]
  onOpenAll?: () => void
  onSelectApplication?: (app: Application) => void
}

export function OaCard({ applications, onOpenAll, onSelectApplication }: OaCardProps) {
  const oaApps = useMemo(() => {
    return applications
      .filter((app) => app.status === 'OA' && isOaIncomplete(app.oaComplete))
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
    <div className="flex flex-col overflow-hidden rounded-md border border-kpi-oa-border bg-kpi-oa-bg lg:h-full lg:min-h-0">
      <div className="flex shrink-0 items-center border-b border-kpi-oa-border/60 px-3 py-2.5 lg:px-2.5 lg:py-1.5">
        {onOpenAll ? (
          <button
            type="button"
            onClick={onOpenAll}
            className="text-left text-[14px] font-bold text-kpi-oa-text hover:underline lg:text-[12px] lg:font-semibold"
          >
            {count} OA{count === 1 ? '' : 's'} to complete
          </button>
        ) : (
          <h2 className="text-[14px] font-bold text-kpi-oa-text lg:text-[12px] lg:font-semibold">
            {count} OA{count === 1 ? '' : 's'} to complete
          </h2>
        )}
      </div>

      {count === 0 ? (
        <p className="px-3 py-3 text-[13px] text-kpi-oa-text/80 lg:px-2.5 lg:py-2 lg:text-[12px]">
          No open OAs.
        </p>
      ) : (
        <ul className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {oaApps.map((app) => {
            const elapsed = formatElapsedDays(parseSheetDate(app.lastUpdated ?? ''))
            const interactive = Boolean(onSelectApplication)
            return (
              <li key={app.sheetRow} className="last:border-b-0">
                <button
                  type="button"
                  disabled={!interactive}
                  onClick={() => onSelectApplication?.(app)}
                  className={[
                    'flex w-full items-center justify-between gap-2 border-b border-kpi-oa-border/40 px-3 py-3 text-left lg:px-2.5 lg:py-1.5',
                    interactive
                      ? 'cursor-pointer hover:bg-kpi-oa-border/15'
                      : 'cursor-default',
                  ].join(' ')}
                >
                  <p className="min-w-0 truncate text-[14px] font-semibold text-kpi-oa-text lg:text-[12px]">
                    {app.company || 'Untitled'}
                    {app.role ? (
                      <span className="font-normal text-app-text-weak"> · {app.role}</span>
                    ) : null}
                  </p>
                  <p
                    className={[
                      'shrink-0 text-[12px] font-semibold tabular-nums lg:text-[11px]',
                      app.lastUpdated ? 'text-kpi-oa-text' : 'text-app-text-weak',
                    ].join(' ')}
                    title={app.lastUpdated ?? undefined}
                  >
                    {elapsed}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
