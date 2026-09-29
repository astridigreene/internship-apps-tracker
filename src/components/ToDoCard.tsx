import { useMemo } from 'react'
import type { Application, AssessmentEntry } from '../types'
import { formatDueInDays, isSameDay, parseSheetDate } from '../lib/time'
import { matchesCompany } from '../lib/sheet'

const DAILY_APPLY_GOAL = 3

interface ToDoCardProps {
  oaEntries: AssessmentEntry[]
  hireVueEntries: AssessmentEntry[]
  applications: Application[]
  onOpenAll?: () => void
  onSelectCompany?: (company: string) => void
  onApplyClick?: () => void
}

export function ToDoCard({
  oaEntries,
  hireVueEntries,
  applications,
  onOpenAll,
  onSelectCompany,
  onApplyClick,
}: ToDoCardProps) {
  const pending = useMemo(() => {
    return [...oaEntries, ...hireVueEntries]
      .filter((entry) => !entry.complete)
      .sort((a, b) => {
        const aTime = parseSheetDate(a.deadline)?.getTime() ?? Number.POSITIVE_INFINITY
        const bTime = parseSheetDate(b.deadline)?.getTime() ?? Number.POSITIVE_INFINITY
        if (aTime === bTime) {
          return a.company.localeCompare(b.company)
        }
        return aTime - bTime
      })
  }, [oaEntries, hireVueEntries])

  const appliedToday = useMemo(() => {
    const today = new Date()
    return applications.filter((app) => {
      const applied = parseSheetDate(app.dateApplied)
      return applied ? isSameDay(applied, today) : false
    }).length
  }, [applications])

  const remainingApplies = Math.max(0, DAILY_APPLY_GOAL - appliedToday)
  const totalCount = (remainingApplies > 0 ? 1 : 0) + pending.length

  function roleFor(company: string): string {
    return applications.find((app) => matchesCompany(app.company, company))?.role ?? ''
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-kpi-oa-border bg-kpi-oa-bg lg:h-full lg:min-h-0">
      <div className="flex shrink-0 items-center border-b border-kpi-oa-border/60 px-3 py-2.5 lg:px-2.5 lg:py-1.5">
        {onOpenAll ? (
          <button
            type="button"
            onClick={onOpenAll}
            className="text-left text-[14px] font-bold text-kpi-oa-text hover:underline lg:text-[12px] lg:font-semibold"
          >
            To-Do{totalCount > 0 ? ` · ${totalCount}` : ''}
          </button>
        ) : (
          <h2 className="text-[14px] font-bold text-kpi-oa-text lg:text-[12px] lg:font-semibold">
            To-Do{totalCount > 0 ? ` · ${totalCount}` : ''}
          </h2>
        )}
      </div>

      {totalCount === 0 ? (
        <p className="px-3 py-3 text-[13px] text-kpi-oa-text/80 lg:px-2.5 lg:py-2 lg:text-[12px]">
          Nothing to do — you're all caught up.
        </p>
      ) : (
        <ul className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {remainingApplies > 0 ? (
            <li className="last:border-b-0">
              <button
                type="button"
                disabled={!onApplyClick}
                onClick={onApplyClick}
                className={[
                  'flex w-full items-center justify-between gap-2 border-b border-kpi-oa-border/40 px-3 py-3 text-left lg:px-2.5 lg:py-1.5',
                  onApplyClick ? 'cursor-pointer hover:bg-kpi-oa-border/15' : 'cursor-default',
                ].join(' ')}
              >
                <p className="min-w-0 truncate text-[14px] font-semibold text-kpi-oa-text lg:text-[12px]">
                  Apply to {remainingApplies} more job{remainingApplies === 1 ? '' : 's'} today
                </p>
                <p className="shrink-0 text-[12px] font-semibold tabular-nums text-kpi-oa-text lg:text-[11px]">
                  {appliedToday}/{DAILY_APPLY_GOAL}
                </p>
              </button>
            </li>
          ) : null}
          {pending.map((entry) => {
            const deadline = parseSheetDate(entry.deadline)
            const dueLabel = formatDueInDays(deadline)
            const interactive = Boolean(onSelectCompany)
            const role = roleFor(entry.company)
            return (
              <li key={`${entry.kind}-${entry.sheetRow}`} className="last:border-b-0">
                <button
                  type="button"
                  disabled={!interactive}
                  onClick={() => onSelectCompany?.(entry.company)}
                  className={[
                    'flex w-full items-center justify-between gap-2 border-b border-kpi-oa-border/40 px-3 py-3 text-left lg:px-2.5 lg:py-1.5',
                    interactive
                      ? 'cursor-pointer hover:bg-kpi-oa-border/15'
                      : 'cursor-default',
                  ].join(' ')}
                >
                  <p className="min-w-0 truncate text-[14px] font-semibold text-kpi-oa-text lg:text-[12px]">
                    {entry.company || 'Untitled'}
                    {role ? <span className="font-normal text-app-text-weak"> · {role}</span> : null}
                    <span className="font-normal text-app-text-weak"> · {entry.kind}</span>
                  </p>
                  <p
                    className={[
                      'shrink-0 text-[12px] font-semibold tabular-nums lg:text-[11px]',
                      deadline ? 'text-kpi-oa-text' : 'text-app-text-weak',
                    ].join(' ')}
                    title={entry.deadline || undefined}
                  >
                    {dueLabel}
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
