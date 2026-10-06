import { useMemo, useState } from 'react'
import type { Application, ApplicationStatus, LinkedActions, TrackerData } from '../types'
import { StatusPill } from '../components/StatusPill'
import { ApplicationDetailModal } from '../components/ApplicationDetailModal'
import { linkedEntriesForApplication } from '../lib/sheet'
import { formatDueInDays, parseSheetDate } from '../lib/time'
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
    const kind = pendingAssessments[0]!.kind
    return `${pendingAssessments.length} ${kind}${pendingAssessments.length === 1 ? '' : ' items'} pending${
      soonest ? ` · ${formatDueInDays(soonest)}` : ''
    }`
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

export function InProgressView({ data, saving, onSaveStatusChanges, linkedActions }: InProgressViewProps) {
  const [detailApp, setDetailApp] = useState<Application | null>(null)

  const inProgress = useMemo(
    () =>
      data.applications
        .filter((app) => app.status === 'Progressed' || app.status === 'Interview')
        .slice()
        .sort((a, b) => a.company.localeCompare(b.company)),
    [data.applications],
  )

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
