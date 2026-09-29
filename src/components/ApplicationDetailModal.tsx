import { useEffect, useId, useState } from 'react'
import {
  effectiveHighestStage,
  isRejectedStatus,
  nextPipelineStatus,
  type Application,
  type ApplicationStatus,
  type AssessmentEntry,
  type InterviewEntry,
  type LinkedActions,
  type ScreeningEntry,
} from '../types'
import { StatusPill } from './StatusPill'
import { StatusSelect } from './StatusSelect'
import { AssessmentPanel } from './AssessmentPanel'
import { DateEntriesPanel } from './DateEntriesPanel'
import { formatDisplayDate } from '../lib/time'

interface ApplicationDetailModalProps {
  app: Application | null
  saving?: boolean
  onClose: () => void
  onUpdateStatus?: (app: Application, toStatus: ApplicationStatus) => Promise<void>
  linked?: {
    oa: AssessmentEntry[]
    hireVue: AssessmentEntry[]
    interviews: InterviewEntry[]
    screenings: ScreeningEntry[]
  }
  linkedActions?: LinkedActions
}

export function ApplicationDetailModal({
  app,
  saving,
  onClose,
  onUpdateStatus,
  linked,
  linkedActions,
}: ApplicationDetailModalProps) {
  const titleId = useId()
  const [editing, setEditing] = useState(false)
  const [draftStatus, setDraftStatus] = useState<ApplicationStatus | string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!app) {
      return
    }
    setEditing(false)
    setDraftStatus(app.status)
    setError(null)
  }, [app])

  useEffect(() => {
    if (!app) {
      return
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [app, onClose, saving])

  if (!app) {
    return null
  }

  const current = app
  const currentStatus = current.status
  const next = nextPipelineStatus(currentStatus)
  const alreadyRejected = isRejectedStatus(currentStatus)
  const canWrite = Boolean(onUpdateStatus)
  const highest = effectiveHighestStage(current)
  const showLinked = highest !== 'Applied' && Boolean(linked)

  async function writeStatus(toStatus: ApplicationStatus) {
    if (!onUpdateStatus || saving || toStatus === currentStatus) {
      return
    }
    setError(null)
    try {
      await onUpdateStatus(current, toStatus)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status')
    }
  }

  async function saveEdit() {
    const nextStatus = draftStatus as ApplicationStatus
    if (nextStatus === currentStatus) {
      setEditing(false)
      return
    }
    await writeStatus(nextStatus)
  }

  const fieldLabel = 'text-[11px] font-bold tracking-[0.06em] uppercase text-app-text-weak'
  const fieldValue = 'mt-1 text-[14px] font-semibold text-app-text'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[min(92dvh,100%)] w-full max-w-md overflow-y-auto rounded-t-xl border border-panel-border bg-app-surface shadow-[0_16px_40px_rgba(0,0,0,0.18)] sm:rounded-lg"
      >
        <div className="flex items-start justify-between gap-3 border-b border-app-border px-4 py-3">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-[15px] font-bold text-app-text">
              {app.company || 'Application'}
            </h2>
            <p className="mt-0.5 truncate text-[12px] font-semibold text-app-text-weak">
              {app.role}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="shrink-0 text-[12px] font-bold text-app-text-weak hover:text-app-text disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div>
            <p className={fieldLabel}>Location</p>
            <p className={fieldValue}>{app.location || '—'}</p>
          </div>
          <div>
            <p className={fieldLabel}>Role</p>
            <p className={fieldValue}>{app.role || '—'}</p>
          </div>
          <div>
            <p className={fieldLabel}>Date Applied</p>
            <p className={`${fieldValue} tabular-nums`}>
              {formatDisplayDate(app.dateApplied) || '—'}
            </p>
          </div>
          <div>
            <p className={fieldLabel}>Last Updated</p>
            <p className={`${fieldValue} tabular-nums`}>
              {formatDisplayDate(app.lastUpdated) || '—'}
            </p>
          </div>
          <div>
            <p className={fieldLabel}>Highest Stage</p>
            <p className={fieldValue}>{highest}</p>
          </div>
          <div>
            <p className={fieldLabel}>Status</p>
            <div className="mt-1.5">
              {editing ? (
                <StatusSelect
                  value={draftStatus}
                  disabled={saving || !canWrite}
                  onChange={setDraftStatus}
                />
              ) : (
                <StatusPill status={currentStatus} />
              )}
            </div>
          </div>

          {error ? (
            <p className="text-[12px] font-semibold text-kpi-reject-text" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-app-border pt-3">
            {editing ? (
              <div className="ml-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setEditing(false)
                    setDraftStatus(currentStatus)
                    setError(null)
                  }}
                  className="h-9 rounded border border-app-border px-3 text-[12px] font-bold text-app-text hover:bg-app-hover disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || !canWrite || draftStatus === currentStatus}
                  onClick={() => {
                    void saveEdit()
                  }}
                  className="h-9 rounded bg-app-brand px-3 text-[12px] font-bold text-white hover:bg-app-brand-dark disabled:cursor-not-allowed disabled:opacity-45 dark:text-teal-950"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  disabled={saving || !canWrite}
                  onClick={() => {
                    setDraftStatus(currentStatus)
                    setEditing(true)
                    setError(null)
                  }}
                  className="h-9 rounded border border-app-border px-3 text-[12px] font-bold text-app-text hover:bg-app-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Edit
                </button>
                {next ? (
                  <button
                    type="button"
                    disabled={saving || !canWrite}
                    onClick={() => {
                      void writeStatus(next)
                    }}
                    className="h-9 rounded bg-app-brand px-3 text-[12px] font-bold text-white hover:bg-app-brand-dark disabled:cursor-not-allowed disabled:opacity-40 dark:text-teal-950"
                  >
                    {saving ? 'Saving…' : next}
                  </button>
                ) : null}
                {!alreadyRejected ? (
                  <button
                    type="button"
                    disabled={saving || !canWrite}
                    title="Set status to Rejected"
                    onClick={() => {
                      void writeStatus('Rejected')
                    }}
                    className="h-9 rounded border border-rose-300 bg-rose-500/10 px-3 text-[12px] font-bold text-rose-700 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-500/40 dark:text-rose-300"
                  >
                    Rejected
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={saving}
                  onClick={onClose}
                  className="ml-auto h-9 rounded border border-app-border px-3 text-[12px] font-bold text-app-text hover:bg-app-hover disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            )}
          </div>

          {showLinked && linked ? (
            <div className="space-y-2 border-t border-app-border pt-3">
              <p className={fieldLabel}>Progress details</p>
              <AssessmentPanel
                kind="OA"
                entries={linked.oa}
                companyDefault={app.company}
                disabled={saving}
                onAdd={linkedActions ? (input) => linkedActions.addOa(input) : undefined}
                onToggleComplete={
                  linkedActions
                    ? (entry, complete) => linkedActions.toggleOaComplete(entry, complete)
                    : undefined
                }
                onDelete={linkedActions ? (entry) => linkedActions.deleteOa(entry) : undefined}
              />
              <AssessmentPanel
                kind="HireVue"
                entries={linked.hireVue}
                companyDefault={app.company}
                disabled={saving}
                onAdd={linkedActions ? (input) => linkedActions.addHireVue(input) : undefined}
                onToggleComplete={
                  linkedActions
                    ? (entry, complete) => linkedActions.toggleHireVueComplete(entry, complete)
                    : undefined
                }
                onDelete={linkedActions ? (entry) => linkedActions.deleteHireVue(entry) : undefined}
              />
              <DateEntriesPanel
                kind="Screening"
                entries={linked.screenings}
                companyDefault={app.company}
                disabled={saving}
                showComplete={false}
                onAdd={linkedActions ? (input) => linkedActions.addScreening(input) : undefined}
                onDelete={linkedActions ? (entry) => linkedActions.deleteScreening(entry) : undefined}
              />
              <DateEntriesPanel
                kind="Interview"
                entries={linked.interviews}
                companyDefault={app.company}
                disabled={saving}
                showComplete
                onAdd={linkedActions ? (input) => linkedActions.addInterview(input) : undefined}
                onToggleComplete={
                  linkedActions
                    ? (entry, complete) => linkedActions.toggleInterviewComplete(entry, complete)
                    : undefined
                }
                onDelete={linkedActions ? (entry) => linkedActions.deleteInterview(entry) : undefined}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
