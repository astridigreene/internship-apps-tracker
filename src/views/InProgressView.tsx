import { useMemo, useState } from 'react'
import type { Application, ApplicationStatus, LinkedActions, TrackerData } from '../types'
import { StatusPill } from '../components/StatusPill'
import { ApplicationDetailModal } from '../components/ApplicationDetailModal'
import { linkedEntriesForApplication } from '../lib/sheet'
import { endMoment, formatDueInDays, isExpired, parseSheetDate } from '../lib/time'
import type { StatusEditChange } from './ApplicationsView'

interface InProgressViewProps {
  data: TrackerData
  saving?: boolean
  onSaveStatusChanges?: (changes: StatusEditChange[]) => Promise<void>
  linkedActions?: LinkedActions
}

function nextPendingLabel(linked: ReturnType<typeof linkedEntriesForApplication>): string | null {
  const pendingAssessments = [...linked.oa, ...linked.hireVue].filter((e) => !e.complete)
  if (pendingAssessments.length > 0) {
    const soonest = pendingAssessments
      .map((e) => parseSheetDate(e.deadline))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime())[0]
    const oaCount = pendingAssessments.filter((e) => e.kind === 'OA').length
    const hireVueCount = pendingAssessments.length - oaCount
    const parts = [
      oaCount ? `${oaCount} OA${oaCount === 1 ? '' : 's'}` : '',
      hireVueCount ? `${hireVueCount} HireVue${hireVueCount === 1 ? '' : 's'}` : '',
    ].filter(Boolean)
    return `${parts.join(' + ')} pending${soonest ? ` · ${formatDueInDays(soonest)}` : ''}`
  }
  const pendingInterviews = linked.interviews.filter((e) => !e.complete)
  if (pendingInterviews.length > 0) {
    return `${pendingInterviews.length} interview${pendingInterviews.length === 1 ? '' : 's'} scheduled`
  }
  if (linked.screenings.length > 0) {
    return `${linked.screenings.length} screening${linked.screenings.length === 1 ? '' : 's'} logged`
  }
  return null
}

/**
 * When the application's next still-upcoming item happens: an incomplete OA/HireVue
 * deadline that hasn't passed, or an interview/screening that hasn't ended yet.
 * Null when there's nothing coming up.
 */
function nextUpcomingTime(linked: ReturnType<typeof linkedEntriesForApplication>, now: Date): number | null {
  const times: number[] = []
  for (const entry of [...linked.oa, ...linked.hireVue]) {
    const deadline = parseSheetDate(entry.deadline)
    if (!entry.complete && deadline && !isExpired(deadline, now)) {
      times.push(deadline.getTime())
    }
  }
  for (const entry of [...linked.interviews.filter((e) => !e.complete), ...linked.screenings]) {
    const start = parseSheetDate(entry.dateTime)
    if (start && !isExpired(endMoment(start, entry.endTime) ?? start, now)) {
      times.push(start.getTime())
    }
  }
  return times.length ? Math.min(...times) : null
}

export function InProgressView({ data, saving, onSaveStatusChanges, linkedActions }: InProgressViewProps) {
  const [detailApp, setDetailApp] = useState<Application | null>(null)

  // Soonest upcoming deadline/event first; applications with nothing coming up go last, by company.
  const inProgress = useMemo(() => {
    const now = new Date()
    return data.applications
      .filter((app) => app.status === 'Progressed' || app.status === 'Interview')
      .map((app) => ({ app, next: nextUpcomingTime(linkedEntriesForApplication(data, app, data.applications), now) }))
      .sort((a, b) => {
        if (a.next !== b.next) {
          if (a.next === null) return 1
          if (b.next === null) return -1
          return a.next - b.next
        }
        return a.app.company.localeCompare(b.app.company)
      })
      .map(({ app }) => app)
  }, [data])

  const detailAppLive =
    detailApp === null
      ? null
      : (data.applications.find((a) => a.sheetRow === detailApp.sheetRow) ?? detailApp)
  const detailLinked = detailAppLive ? linkedEntriesForApplication(data, detailAppLive, data.applications) : undefined

  async function handleDetailStatusUpdate(app: Application, toStatus: ApplicationStatus) {
    if (!onSaveStatusChanges) {
      return
    }
    await onSaveStatusChanges([{ app, fromStatus: app.status, toStatus }])
  }

  return (
    <div className="flex w-full flex-col gap-3 lg:h-full lg:min-h-0 lg:gap-2.5">
      <ApplicationDetailModal
        app={detailAppLive}
        saving={saving}
        onClose={() => {
          if (!saving) {
            setDetailApp(null)
          }
        }}
        onUpdateStatus={onSaveStatusChanges ? handleDetailStatusUpdate : undefined}
        linked={detailLinked}
        linkedActions={linkedActions}
      />

      <div className="flex shrink-0 items-center justify-between">
        <h1 className="text-[15px] font-bold text-app-text">In Progress</h1>
        <p className="text-[12px] font-bold text-app-text-weak tabular-nums">
          {inProgress.length} active
        </p>
      </div>

      <div className="w-full overflow-hidden rounded-xl border border-panel-border bg-app-surface lg:min-h-0 lg:flex-1 lg:overflow-auto lg:rounded-md">
        {inProgress.length === 0 ? (
          <p className="px-4 py-8 text-center text-[14px] font-semibold text-app-text-weak">
            No applications are currently Progressed or in Interview.
          </p>
        ) : (
          <ul className="divide-y divide-app-border">
            {inProgress.map((app) => {
              const linked = linkedEntriesForApplication(data, app, data.applications)
              const pendingLabel = nextPendingLabel(linked)
              return (
                <li key={app.sheetRow}>
                  <button
                    type="button"
                    onClick={() => setDetailApp(app)}
                    className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left hover:bg-app-hover"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold text-app-text">
                        {app.company || 'Untitled'}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] font-semibold text-app-text-weak">
                        {[app.role, app.location].filter(Boolean).join(' · ')}
                      </p>
                      {pendingLabel ? (
                        <p className="mt-1 text-[11px] font-semibold text-kpi-oa-text">
                          {pendingLabel}
                        </p>
                      ) : null}
                    </div>
                    <StatusPill status={app.status} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
