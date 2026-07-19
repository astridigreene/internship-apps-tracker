import { useEffect, useId, useState } from 'react'
import {
  isOaIncomplete,
  isRejectedStatus,
  nextPipelineStatus,
  OA_COMPLETE_VALUES,
  rejectionStatusFor,
  type Application,
  type ApplicationStatus,
  type OaComplete,
} from '../types'
import { StatusPill } from './StatusPill'
import { StatusSelect } from './StatusSelect'

interface ApplicationDetailModalProps {
  app: Application | null
  saving?: boolean
  onClose: () => void
  onUpdateStatus?: (app: Application, toStatus: ApplicationStatus) => Promise<void>
  onUpdateOaComplete?: (app: Application, oaComplete: OaComplete) => Promise<void>
}

export function ApplicationDetailModal({
  app,
  saving,
  onClose,
  onUpdateStatus,
  onUpdateOaComplete,
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
  const rejectTarget = rejectionStatusFor(currentStatus)
  const alreadyRejected = isRejectedStatus(currentStatus)
  const canWrite = Boolean(onUpdateStatus)
  const isOaStatus = currentStatus === 'OA'
  const canEditOaComplete =
    Boolean(onUpdateOaComplete) && current.oaComplete !== null && isOaStatus
  const showOaCompleteButton =
    canEditOaComplete && isOaIncomplete(current.oaComplete)
  const showOaCompleteField = current.oaComplete !== null && isOaStatus

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

  async function writeOaComplete(value: OaComplete) {
    if (!onUpdateOaComplete || saving || current.oaComplete === value) {
      return
    }
    setError(null)
    try {
      await onUpdateOaComplete(current, value)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update OA Complete')
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

  const fieldLabel =
    'text-[11px] font-bold tracking-[0.06em] uppercase text-app-text-weak'
  const fieldValue = 'mt-1 text-[14px] font-semibold text-app-text'
  const selectClass =
    'mt-1.5 h-9 w-full max-w-[140px] rounded border border-app-border bg-app-surface px-2.5 text-[13px] font-semibold text-app-text outline-none focus:border-app-brand disabled:opacity-60'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
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
        className="w-full max-w-md rounded-lg border border-panel-border bg-app-surface shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
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
            <p className={`${fieldValue} tabular-nums`}>{app.dateApplied || '—'}</p>
          </div>
          <div>
            <p className={fieldLabel}>Last Updated</p>
            <p className={`${fieldValue} tabular-nums`}>{app.lastUpdated || '—'}</p>
          </div>
          {showOaCompleteField ? (
            <div>
              <p className={fieldLabel}>OA Complete</p>
              {canEditOaComplete ? (
                <select
                  aria-label="OA Complete"
                  value={app.oaComplete ?? 'N/A'}
                  disabled={saving}
                  onChange={(event) => {
                    void writeOaComplete(event.target.value as OaComplete)
                  }}
                  className={selectClass}
                >
                  {OA_COMPLETE_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              ) : (
                <p className={fieldValue}>{app.oaComplete}</p>
              )}
            </div>
          ) : null}
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
                {showOaCompleteButton ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      void writeOaComplete('Y')
                    }}
                    className="h-9 rounded border border-sky-300 bg-sky-500/10 px-3 text-[12px] font-bold text-sky-800 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40 dark:border-sky-500/40 dark:text-sky-200"
                  >
                    {saving ? 'Saving…' : 'OA complete'}
                  </button>
                ) : null}
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
                    title={`Set status to ${rejectTarget}`}
                    onClick={() => {
                      void writeStatus(rejectTarget)
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
        </div>
      </div>
    </div>
  )
}
