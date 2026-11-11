import { useMemo, useState } from 'react'
import type { Application, AssessmentEntry, InterviewEntry, LinkedActions, NeetCodeProblem } from '../types'
import type { NeetCodeState } from '../lib/useNeetCode'
import { dateFromIso } from '../lib/neetcodeParse'
import { DiffBadge } from './DiffBadge'
import { endMoment, formatDueInDays, isExpired, parseSheetDate } from '../lib/time'
import { linkedApplicationFor } from '../lib/sheet'

interface PendingItem {
  key: string
  kind: 'OA' | 'HireVue' | 'Interview'
  company: string
  /** Raw sheet value: the OA/HireVue deadline or the interview date/time. */
  when: string
  app: Application | undefined
  complete: boolean
  entry: AssessmentEntry | InterviewEntry
}

interface ToDoCardProps {
  oaEntries: AssessmentEntry[]
  hireVueEntries: AssessmentEntry[]
  interviewEntries: InterviewEntry[]
  applications: Application[]
  onOpenAll?: () => void
  onSelectApplication?: (app: Application) => void
  /** Enables the done checkboxes on OA / HireVue / Interview rows. */
  linkedActions?: LinkedActions
  /** NeetCode sheet state; its next study day's problems are listed with checkboxes. */
  neetcode?: NeetCodeState
}

function studyDayLabel(iso: string): string {
  const date = dateFromIso(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const CHECKBOX_CLASS =
  'h-5 w-5 shrink-0 cursor-pointer accent-app-brand disabled:cursor-wait disabled:opacity-60 lg:h-4 lg:w-4'

export function ToDoCard({
  oaEntries,
  hireVueEntries,
  interviewEntries,
  applications,
  onOpenAll,
  onSelectApplication,
  linkedActions,
  neetcode,
}: ToDoCardProps) {
  /** Items ticked here stay listed (struck through) so a mis-tap can be undone. */
  const [tickedHere, setTickedHere] = useState<Set<string>>(() => new Set())
  const [savingKeys, setSavingKeys] = useState<Set<string>>(() => new Set())
  const [tickError, setTickError] = useState<string | null>(null)

  const pending = useMemo(() => {
    const assessments: PendingItem[] = [...oaEntries, ...hireVueEntries]
      .filter(
        (entry) =>
          tickedHere.has(`${entry.kind}-${entry.sheetRow}`) ||
          (!entry.complete && !isExpired(parseSheetDate(entry.deadline))),
      )
      .map((entry) => ({
        key: `${entry.kind}-${entry.sheetRow}`,
        kind: entry.kind,
        company: entry.company,
        when: entry.deadline,
        app: linkedApplicationFor(entry, applications, 'Progressed'),
        complete: entry.complete,
        entry,
      }))
    const interviews: PendingItem[] = interviewEntries
      .filter((entry) => {
        if (tickedHere.has(`Interview-${entry.sheetRow}`)) {
          return true
        }
        // Stays on the list until it's over: its end time when set, else its start.
        const start = parseSheetDate(entry.dateTime)
        return !entry.complete && !isExpired(endMoment(start, entry.endTime) ?? start)
      })
      .map((entry) => ({
        key: `Interview-${entry.sheetRow}`,
        kind: 'Interview',
        company: entry.company,
        when: entry.dateTime,
        app: linkedApplicationFor(entry, applications, 'Interview'),
        complete: entry.complete,
        entry,
      }))
    return [...assessments, ...interviews].sort((a, b) => {
      const aTime = parseSheetDate(a.when)?.getTime() ?? Number.POSITIVE_INFINITY
      const bTime = parseSheetDate(b.when)?.getTime() ?? Number.POSITIVE_INFINITY
      if (aTime === bTime) {
        return a.company.localeCompare(b.company)
      }
      return aTime - bTime
    })
  }, [oaEntries, hireVueEntries, interviewEntries, applications, tickedHere])

  async function toggleLinked(item: PendingItem, complete: boolean) {
    if (!linkedActions) {
      return
    }
    setTickError(null)
    setSavingKeys((prev) => new Set(prev).add(item.key))
    try {
      if (item.kind === 'Interview') {
        await linkedActions.toggleInterviewComplete(item.entry as InterviewEntry, complete)
      } else if (item.kind === 'OA') {
        await linkedActions.toggleOaComplete(item.entry as AssessmentEntry, complete)
      } else {
        await linkedActions.toggleHireVueComplete(item.entry as AssessmentEntry, complete)
      }
      setTickedHere((prev) => new Set(prev).add(item.key))
    } catch (err) {
      setTickError(err instanceof Error ? err.message : 'Could not update the sheet.')
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev)
        next.delete(item.key)
        return next
      })
    }
  }

  const studyDay = neetcode?.data?.nextDays[0]
  const studyProblems = (studyDay?.date ? studyDay.problems : [])
    .map((item) => item.problem)
    .filter((p): p is NeetCodeProblem => p !== null)
  const studyOpen = neetcode ? studyProblems.filter((p) => !neetcode.isChecked(p)).length : 0

  const totalCount = pending.filter((item) => !item.complete).length + studyOpen
  const errorText = tickError ?? neetcode?.writeError ?? null

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

      {errorText ? (
        <p className="border-b border-kpi-oa-border/40 px-3 py-2 text-[12px] text-kpi-reject-text lg:px-2.5 lg:py-1 lg:text-[11px]">
          {errorText}
        </p>
      ) : null}

      {pending.length === 0 && studyProblems.length === 0 ? (
        <p className="px-3 py-3 text-[13px] text-kpi-oa-text/80 lg:px-2.5 lg:py-2 lg:text-[12px]">
          Nothing to do — you're all caught up.
        </p>
      ) : (
        <ul className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {pending.map((entry) => {
            const deadline = parseSheetDate(entry.when)
            const dueLabel =
              entry.kind === 'Interview'
                ? formatDueInDays(deadline).replace(/^due /, '')
                : formatDueInDays(deadline)
            const interactive = Boolean(onSelectApplication && entry.app)
            const role = entry.app?.role ?? ''
            const busy = savingKeys.has(entry.key)
            return (
              <li
                key={entry.key}
                className="flex items-center border-b border-kpi-oa-border/40 last:border-b-0"
              >
                {linkedActions ? (
                  <input
                    type="checkbox"
                    checked={entry.complete}
                    disabled={busy}
                    onChange={(e) => void toggleLinked(entry, e.target.checked)}
                    aria-label={`Mark ${entry.company || 'item'} ${entry.kind} ${entry.complete ? 'not done' : 'done'}`}
                    className={`${CHECKBOX_CLASS} ml-3 lg:ml-2.5`}
                  />
                ) : null}
                <button
                  type="button"
                  disabled={!interactive}
                  onClick={() => entry.app && onSelectApplication?.(entry.app)}
                  className={[
                    'flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-3 text-left lg:px-2.5 lg:py-1.5',
                    interactive
                      ? 'cursor-pointer hover:bg-kpi-oa-border/15'
                      : 'cursor-default',
                  ].join(' ')}
                >
                  <p
                    className={[
                      'min-w-0 truncate text-[14px] font-semibold lg:text-[12px]',
                      entry.complete ? 'text-app-text-weak line-through' : 'text-kpi-oa-text',
                    ].join(' ')}
                  >
                    {entry.company || 'Untitled'}
                    {role ? <span className="font-normal text-app-text-weak"> · {role}</span> : null}
                    <span className="font-normal text-app-text-weak"> · {entry.kind}</span>
                  </p>
                  <p
                    className={[
                      'shrink-0 text-[12px] font-semibold tabular-nums lg:text-[11px]',
                      deadline && !entry.complete ? 'text-kpi-oa-text' : 'text-app-text-weak',
                    ].join(' ')}
                    title={entry.when || undefined}
                  >
                    {entry.complete ? 'done' : dueLabel}
                  </p>
                </button>
              </li>
            )
          })}
          {neetcode && studyDay?.date && studyProblems.length > 0 ? (
            <>
              <li className="border-b border-kpi-oa-border/40 bg-kpi-oa-border/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase text-kpi-oa-text/80 lg:px-2.5 lg:py-1 lg:text-[10px]">
                NeetCode · {studyDayLabel(studyDay.date)}
              </li>
              {studyProblems.map((problem) => {
                const checked = neetcode.isChecked(problem)
                return (
                  <li key={`nc-${problem.sheetRow}`} className="border-b border-kpi-oa-border/40 last:border-b-0">
                    <label className="flex cursor-pointer items-center gap-2.5 px-3 py-3 lg:px-2.5 lg:py-1.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={neetcode.isBusy(problem)}
                        onChange={(e) => neetcode.toggle(problem, e.target.checked)}
                        aria-label={`Mark ${problem.name} ${checked ? 'not done' : 'done'}`}
                        className={CHECKBOX_CLASS}
                      />
                      <span
                        className={[
                          'min-w-0 flex-1 truncate text-[14px] font-semibold lg:text-[12px]',
                          checked ? 'text-app-text-weak line-through' : 'text-kpi-oa-text',
                        ].join(' ')}
                      >
                        {problem.name}
                      </span>
                      <DiffBadge difficulty={problem.difficulty} />
                      {problem.minutes ? (
                        <span className="shrink-0 text-[12px] tabular-nums text-app-text-weak lg:text-[11px]">
                          {problem.minutes}m
                        </span>
                      ) : null}
                    </label>
                  </li>
                )
              })}
            </>
          ) : null}
        </ul>
      )}
    </div>
  )
}
