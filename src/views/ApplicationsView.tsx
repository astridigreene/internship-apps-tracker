import { useMemo, useState } from 'react'
import {
  isRejectedStatus,
  type Application,
  type ApplicationStatus,
  type NewApplicationInput,
  type OaComplete,
} from '../types'
import { StatusSelect } from '../components/StatusSelect'
import { StatusPill } from '../components/StatusPill'
import { NewApplicationModal } from '../components/NewApplicationModal'
import { DeleteConfirmModal } from '../components/DeleteConfirmModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { ApplicationDetailModal } from '../components/ApplicationDetailModal'
import { formatDisplayDate } from '../lib/time'

type SortKey = 'company' | 'location' | 'role' | 'dateApplied' | 'status'
type SortDir = 'asc' | 'desc'
type StatusFilter =
  | 'Active'
  | 'All'
  | 'Applied'
  | 'OA'
  | 'Interview'
  | 'Offer'
  | 'Rejected'

export type ApplicationsStatusFilter = StatusFilter

/** Filter dropdown — Rejected means all rejection variants. */
const STATUS_OPTIONS: StatusFilter[] = [
  'Active',
  'All',
  'Applied',
  'OA',
  'Interview',
  'Offer',
  'Rejected',
]

const COLUMNS: { key: SortKey; label: string; width: string }[] = [
  { key: 'company', label: 'Company', width: '21%' },
  { key: 'location', label: 'Location', width: '17%' },
  { key: 'role', label: 'Role', width: '28%' },
  { key: 'dateApplied', label: 'Applied', width: '13%' },
  { key: 'status', label: 'Status', width: '15%' },
]

export interface StatusEditChange {
  app: Application
  fromStatus: string
  toStatus: ApplicationStatus
}

interface ApplicationsViewProps {
  applications: Application[]
  statusFilter: ApplicationsStatusFilter
  onStatusFilterChange: (filter: ApplicationsStatusFilter) => void
  saving?: boolean
  adding?: boolean
  deleting?: boolean
  onSaveStatusChanges?: (changes: StatusEditChange[]) => Promise<void>
  onAddApplication?: (application: NewApplicationInput) => Promise<void>
  onDeleteApplication?: (app: Application) => Promise<void>
  onUpdateOaComplete?: (app: Application, oaComplete: OaComplete) => Promise<void>
}

function parseDate(value: string): number {
  const t = Date.parse(value)
  return Number.isNaN(t) ? 0 : t
}

function compareApps(
  a: Application,
  b: Application,
  key: SortKey,
  dir: SortDir,
  statusOf: (app: Application) => string,
): number {
  let cmp = 0
  if (key === 'dateApplied') {
    cmp = parseDate(a.dateApplied) - parseDate(b.dateApplied)
  } else if (key === 'status') {
    cmp = statusOf(a).localeCompare(statusOf(b), undefined, { sensitivity: 'base' })
  } else {
    cmp = String(a[key] ?? '').localeCompare(String(b[key] ?? ''), undefined, {
      sensitivity: 'base',
    })
  }
  return dir === 'asc' ? cmp : -cmp
}

function matchesStatus(
  status: string,
  filter: StatusFilter,
): boolean {
  if (filter === 'All') {
    return true
  }
  if (filter === 'Active') {
    return !isRejectedStatus(status)
  }
  if (filter === 'Rejected') {
    return isRejectedStatus(status)
  }
  return status === filter
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12.5 7.5 16.5 11.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5 10 17.5 19 7.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6.5 7l.8 12.2A1.5 1.5 0 0 0 8.8 20.5h6.4a1.5 1.5 0 0 0 1.5-1.3L17.5 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function ApplicationsView({
  applications,
  statusFilter,
  onStatusFilterChange,
  saving,
  adding,
  deleting,
  onSaveStatusChanges,
  onAddApplication,
  onDeleteApplication,
  onUpdateOaComplete,
}: ApplicationsViewProps) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('dateApplied')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [editing, setEditing] = useState(false)
  const [drafts, setDrafts] = useState<Record<number, ApplicationStatus | string>>({})
  const [newOpen, setNewOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Application | null>(null)
  const [detailApp, setDetailApp] = useState<Application | null>(null)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)

  const statusOf = (app: Application) => drafts[app.sheetRow] ?? app.status

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return applications
      .filter((app) => {
        const status = statusOf(app)
        if (!matchesStatus(status, statusFilter)) {
          return false
        }
        if (!q) {
          return true
        }
        return (
          app.company.toLowerCase().includes(q) ||
          app.location.toLowerCase().includes(q) ||
          app.role.toLowerCase().includes(q) ||
          status.toLowerCase().includes(q)
        )
      })
      .slice()
      .sort((a, b) => compareApps(a, b, sortKey, sortDir, statusOf))
  }, [applications, query, statusFilter, sortKey, sortDir, drafts])

  const pendingChanges = useMemo(() => {
    const changes: StatusEditChange[] = []
    for (const app of applications) {
      const drafted = drafts[app.sheetRow]
      if (drafted !== undefined && drafted !== app.status) {
        changes.push({
          app,
          fromStatus: app.status,
          toStatus: drafted as ApplicationStatus,
        })
      }
    }
    return changes
  }, [applications, drafts])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'dateApplied' ? 'desc' : 'asc')
    }
  }

  function startEditing() {
    setEditing(true)
    setDrafts({})
    setCancelConfirmOpen(false)
  }

  function discardEdits() {
    setEditing(false)
    setDrafts({})
    setCancelConfirmOpen(false)
  }

  function requestCancel() {
    if (pendingChanges.length > 0) {
      setCancelConfirmOpen(true)
      return
    }
    discardEdits()
  }

  function handleDraftStatusChange(app: Application, status: ApplicationStatus) {
    const previous = statusOf(app)
    if (previous === status) {
      return
    }
    setDrafts((current) => {
      if (status === app.status) {
        const next = { ...current }
        delete next[app.sheetRow]
        return next
      }
      return { ...current, [app.sheetRow]: status }
    })
  }

  async function handleSave() {
    if (!onSaveStatusChanges) {
      discardEdits()
      return
    }
    if (pendingChanges.length > 0) {
      await onSaveStatusChanges(pendingChanges)
    }
    discardEdits()
  }

  async function handleDetailStatusUpdate(app: Application, toStatus: ApplicationStatus) {
    if (!onSaveStatusChanges) {
      return
    }
    await onSaveStatusChanges([
      {
        app,
        fromStatus: app.status,
        toStatus,
      },
    ])
    setDrafts((current) => {
      if (!(app.sheetRow in current)) {
        return current
      }
      const next = { ...current }
      delete next[app.sheetRow]
      return next
    })
  }

  const busy = Boolean(saving || adding || deleting)
  const detailAppLive =
    detailApp === null
      ? null
      : (applications.find((a) => a.sheetRow === detailApp.sheetRow) ?? detailApp)

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2.5">
      <div className="flex w-full shrink-0 flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="h-9 min-w-0 flex-1 basis-[140px] rounded border border-app-border bg-app-surface px-3 text-[13px] font-semibold text-app-text outline-none placeholder:font-medium placeholder:text-app-text-weak focus:border-app-brand sm:min-w-[200px]"
        />
        <p className="text-[12px] font-bold text-app-text-weak tabular-nums">
          {filtered.length}/{applications.length}
        </p>

        <div className="flex w-full items-center gap-1.5 sm:ml-auto sm:w-auto">
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            disabled={!onAddApplication || busy}
            title="Add new application"
            aria-label="Add new application"
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded bg-app-brand px-2.5 text-[12px] font-bold text-white hover:bg-app-brand-dark disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none dark:text-teal-950"
          >
            <PlusIcon />
            New
          </button>
          {editing ? (
            <>
              <button
                type="button"
                onClick={requestCancel}
                disabled={saving}
                title="Cancel editing"
                aria-label="Cancel editing"
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded border border-app-border bg-app-surface px-2.5 text-[12px] font-bold text-app-text hover:bg-app-hover disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSave()
                }}
                disabled={saving || pendingChanges.length === 0}
                title={
                  pendingChanges.length === 0
                    ? 'No edits to save'
                    : 'Save status changes'
                }
                aria-label={
                  pendingChanges.length === 0
                    ? 'No edits to save'
                    : 'Save status changes'
                }
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded bg-app-brand px-2.5 text-[12px] font-bold text-white hover:bg-app-brand-dark disabled:cursor-not-allowed disabled:bg-app-brand/35 disabled:opacity-100 disabled:hover:bg-app-brand/35 sm:flex-none dark:text-teal-950 dark:disabled:text-teal-950/50"
              >
                <CheckIcon />
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startEditing}
              disabled={!onSaveStatusChanges || busy}
              title="Edit statuses"
              aria-label="Edit statuses"
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded border border-app-border bg-app-surface px-2.5 text-[12px] font-bold text-app-text hover:bg-app-hover disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
            >
              <PencilIcon />
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="text-[11px] font-bold tracking-[0.06em] uppercase text-app-text-weak sm:mr-0.5">
          Filters
        </span>
        <div
          role="group"
          aria-label="Status filters"
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible"
        >
          {STATUS_OPTIONS.map((opt) => {
            const active = statusFilter === opt
            return (
              <button
                key={opt}
                type="button"
                aria-pressed={active}
                onClick={() => onStatusFilterChange(opt)}
                className={[
                  'inline-flex h-8 shrink-0 items-center rounded border px-2.5 text-[12px] font-bold transition-colors',
                  active
                    ? 'border-app-brand bg-app-brand text-white dark:text-teal-950'
                    : 'border-app-border bg-app-surface text-app-text hover:border-app-brand/50 hover:bg-app-hover',
                ].join(' ')}
              >
                {opt}
              </button>
            )
          })}
        </div>
      </div>

      <NewApplicationModal
        open={newOpen}
        submitting={adding}
        onClose={() => {
          if (!adding) {
            setNewOpen(false)
          }
        }}
        onSubmit={async (application) => {
          if (!onAddApplication) {
            return
          }
          await onAddApplication(application)
          setNewOpen(false)
        }}
      />

      <ConfirmModal
        open={cancelConfirmOpen}
        title="Discard edits?"
        message="Are you sure you don’t want to save your edits?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        danger
        onCancel={() => setCancelConfirmOpen(false)}
        onConfirm={discardEdits}
      />

      <DeleteConfirmModal
        app={pendingDelete}
        submitting={deleting}
        onCancel={() => {
          if (!deleting) {
            setPendingDelete(null)
          }
        }}
        onConfirm={async () => {
          if (!pendingDelete || !onDeleteApplication) {
            return
          }
          await onDeleteApplication(pendingDelete)
          setPendingDelete(null)
        }}
      />

      <ApplicationDetailModal
        app={detailAppLive}
        saving={saving}
        onClose={() => {
          if (!saving) {
            setDetailApp(null)
          }
        }}
        onUpdateStatus={onSaveStatusChanges ? handleDetailStatusUpdate : undefined}
        onUpdateOaComplete={onUpdateOaComplete}
      />

      <div className="min-h-0 w-full flex-1 overflow-auto rounded-md border border-panel-border bg-app-surface">
        {/* Mobile card list */}
        <ul className="divide-y divide-app-border md:hidden">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-[13px] font-semibold text-app-text-weak">
              No applications match the current filters.
            </li>
          ) : (
            filtered.map((app, i) => {
              const status = statusOf(app)
              return (
                <li key={`${app.sheetRow}-${app.company}-${app.dateApplied}-${i}`}>
                  <div
                    role="button"
                    tabIndex={0}
                    className="flex cursor-pointer items-start gap-2 px-3 py-3 hover:bg-app-hover"
                    onClick={() => setDetailApp(app)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setDetailApp(app)
                      }
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-[14px] font-bold text-app-text">
                          {app.company || 'Untitled'}
                        </p>
                        {editing ? (
                          <div
                            className="shrink-0"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <StatusSelect
                              value={status}
                              disabled={saving || deleting || !onSaveStatusChanges}
                              onChange={(next) => handleDraftStatusChange(app, next)}
                            />
                          </div>
                        ) : (
                          <StatusPill status={status} />
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[12px] font-semibold text-app-text">
                        {app.role}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-app-text-weak">
                        {[app.location, formatDisplayDate(app.dateApplied) || app.dateApplied]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      title={`Delete ${app.company || 'application'}`}
                      aria-label={`Delete ${app.company || 'application'}`}
                      disabled={!onDeleteApplication || busy}
                      onClick={(event) => {
                        event.stopPropagation()
                        setPendingDelete(app)
                      }}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-rose-400 dark:hover:text-rose-300"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </li>
              )
            })
          )}
        </ul>

        {/* Desktop table */}
        <table className="hidden w-full table-fixed border-collapse text-left text-[13px] md:table">
          <colgroup>
            {COLUMNS.map((col) => (
              <col key={col.key} style={{ width: col.width }} />
            ))}
            <col style={{ width: '6%' }} />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-app-border bg-app-muted">
              {COLUMNS.map((col) => {
                const active = sortKey === col.key
                return (
                  <th key={col.key} className="px-3 py-0">
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex h-9 w-full items-center gap-1 text-[11px] font-bold tracking-[0.06em] uppercase text-app-text hover:text-app-brand"
                    >
                      {col.label}
                      <span
                        className={`text-[9px] ${active ? 'text-app-brand' : 'text-app-border-strong'}`}
                        aria-hidden
                      >
                        {active ? (sortDir === 'asc' ? '▲' : '▼') : '▾'}
                      </span>
                    </button>
                  </th>
                )
              })}
              <th className="px-2 py-0">
                <span className="sr-only">Delete</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length + 1}
                  className="px-3 py-6 text-center font-semibold text-app-text-weak"
                >
                  No applications match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((app, i) => {
                const status = statusOf(app)
                return (
                  <tr
                    key={`${app.sheetRow}-${app.company}-${app.dateApplied}-${i}`}
                    className="h-10 cursor-pointer border-b border-app-border last:border-b-0 hover:bg-app-hover"
                    onClick={() => setDetailApp(app)}
                  >
                    <td className="truncate px-3 py-0 font-bold text-app-text">{app.company}</td>
                    <td className="truncate px-3 py-0 font-semibold text-app-text">
                      {app.location}
                    </td>
                    <td className="truncate px-3 py-0 font-semibold text-app-text">{app.role}</td>
                    <td className="px-3 py-0 font-semibold whitespace-nowrap text-app-text tabular-nums">
                      {formatDisplayDate(app.dateApplied) || app.dateApplied}
                    </td>
                    <td
                      className="px-3 py-0"
                      onClick={(event) => {
                        if (editing) {
                          event.stopPropagation()
                        }
                      }}
                    >
                      {editing ? (
                        <StatusSelect
                          value={status}
                          disabled={saving || deleting || !onSaveStatusChanges}
                          onChange={(next) => handleDraftStatusChange(app, next)}
                        />
                      ) : (
                        <StatusPill status={status} />
                      )}
                    </td>
                    <td className="px-1 py-0 text-right">
                      <button
                        type="button"
                        title={`Delete ${app.company || 'application'}`}
                        aria-label={`Delete ${app.company || 'application'}`}
                        disabled={!onDeleteApplication || busy}
                        onClick={(event) => {
                          event.stopPropagation()
                          setPendingDelete(app)
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-rose-400 dark:hover:text-rose-300"
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
