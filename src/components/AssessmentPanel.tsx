import { useState, type FormEvent } from 'react'
import { SavedWithWarningError, type AssessmentEntry, type NewAssessmentInput } from '../types'
import {
  formatDisplayDateTime,
  isExpired,
  parseSheetDate,
} from '../lib/time'
import { DeleteButton, UnlinkedNote } from './EntryControls'
import { assessmentFormFromEntry } from '../lib/assessmentForm'

interface AssessmentPanelProps {
  kind: 'OA' | 'HireVue'
  entries: AssessmentEntry[]
  companyDefault?: string
  disabled?: boolean
  onAdd?: (input: NewAssessmentInput) => Promise<void>
  onToggleComplete?: (entry: AssessmentEntry, complete: boolean) => Promise<void>
  onDelete?: (entry: AssessmentEntry) => Promise<void>
  /** Set this entry's App Row to the application being viewed. */
  onLink?: (entry: AssessmentEntry) => Promise<void>
  onEdit?: (entry: AssessmentEntry, input: NewAssessmentInput) => Promise<void>
}

const EMPTY = (company: string): NewAssessmentInput => ({
  company,
  deadline: '',
  auto: false,
  dateOffered: '',
  lengthMinutes: '',
  site: '',
  scheduled: '',
})

export function AssessmentPanel({
  kind,
  entries,
  companyDefault,
  disabled,
  onAdd,
  onToggleComplete,
  onDelete,
  onLink,
  onEdit,
}: AssessmentPanelProps) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<AssessmentEntry | null>(null)
  const [form, setForm] = useState<NewAssessmentInput>(() => EMPTY(companyDefault ?? ''))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  /** A save that went through but whose calendar invite didn't (shown above the list). */
  const [warning, setWarning] = useState<string | null>(null)

  const sorted = [...entries].sort((a, b) => {
    if (a.complete !== b.complete) {
      return a.complete ? 1 : -1
    }
    const at = parseSheetDate(a.deadline)?.getTime() ?? Number.NaN
    const bt = parseSheetDate(b.deadline)?.getTime() ?? Number.NaN
    if (Number.isNaN(at) && Number.isNaN(bt)) return 0
    if (Number.isNaN(at)) return 1
    if (Number.isNaN(bt)) return -1
    return at - bt
  })

  function closeForm() {
    setAdding(false)
    setEditing(null)
    setError(null)
    setForm(EMPTY(companyDefault ?? ''))
  }

  function startEdit(entry: AssessmentEntry) {
    setAdding(false)
    setEditing(entry)
    setError(null)
    setForm(assessmentFormFromEntry(entry))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const save = editing ? onEdit && ((input: NewAssessmentInput) => onEdit(editing, input)) : onAdd
    if (!save) return
    if (!form.company.trim() || !form.deadline.trim()) {
      setError('Company and Deadline are required.')
      return
    }
    setSubmitting(true)
    setError(null)
    setWarning(null)
    try {
      await save(form)
      closeForm()
    } catch (err) {
      if (err instanceof SavedWithWarningError) {
        closeForm()
        setWarning(err.message)
        return
      }
      setError(err instanceof Error ? err.message : `Could not save ${kind}`)
    } finally {
      setSubmitting(false)
    }
  }

  const fieldClass =
    'h-8 w-full rounded border border-app-border bg-app-surface px-2 text-[12px] font-semibold text-app-text outline-none focus:border-app-brand'

  const formJsx = (
    <form onSubmit={handleSubmit} className="space-y-2 border-b border-app-border px-2.5 py-2">
      {!companyDefault ? (
        <input
          placeholder="Company"
          required
          value={form.company}
          onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
          className={fieldClass}
        />
      ) : null}
      <div className="grid grid-cols-2 gap-1.5">
        <label className="col-span-2 text-[10px] font-bold uppercase text-app-text-weak">
          Deadline (date &amp; time)
          <input
            type="datetime-local"
            required
            value={form.deadline}
            onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
            className={fieldClass}
          />
        </label>
        <label className="col-span-2 text-[10px] font-bold uppercase text-app-text-weak">
          Do it at (optional)
          <input
            type="datetime-local"
            value={form.scheduled ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, scheduled: e.target.value }))}
            className={fieldClass}
          />
          <span className="mt-0.5 block text-[10px] font-semibold normal-case text-app-text-weak">
            Blocks the time on your Google Calendar and sends you an invite.
          </span>
        </label>
        <label className="text-[10px] font-bold uppercase text-app-text-weak">
          Date Offered
          <input
            type="date"
            value={form.dateOffered}
            onChange={(e) => setForm((f) => ({ ...f, dateOffered: e.target.value }))}
            className={fieldClass}
          />
        </label>
        <label className="text-[10px] font-bold uppercase text-app-text-weak">
          Length (minutes)
          <input
            inputMode="numeric"
            value={form.lengthMinutes}
            onChange={(e) => setForm((f) => ({ ...f, lengthMinutes: e.target.value }))}
            className={fieldClass}
          />
        </label>
        <label className="text-[10px] font-bold uppercase text-app-text-weak">
          Site
          <input
            value={form.site}
            onChange={(e) => setForm((f) => ({ ...f, site: e.target.value }))}
            className={fieldClass}
          />
        </label>
      </div>
      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-app-text">
        <input
          type="checkbox"
          checked={form.auto}
          onChange={(e) => setForm((f) => ({ ...f, auto: e.target.checked }))}
          className="accent-app-brand"
        />
        Auto
      </label>
      {error ? <p className="text-[11px] font-semibold text-kpi-reject-text">{error}</p> : null}
      {editing ? (
        <button
          type="button"
          onClick={closeForm}
          className="h-8 w-full rounded border border-app-border text-[12px] font-bold text-app-text hover:bg-app-hover"
        >
          Cancel
        </button>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="h-8 w-full rounded bg-app-brand text-[12px] font-bold text-white hover:bg-app-brand-dark disabled:opacity-50 dark:text-teal-950"
      >
        {submitting ? 'Saving…' : editing ? 'Save changes' : `Save ${kind}`}
      </button>
    </form>
  )

  /** Clear an entry's scheduled time, which cancels its calendar invite. */
  async function cancelScheduled(entry: AssessmentEntry) {
    if (!onEdit) return
    setWarning(null)
    try {
      await onEdit(entry, { ...assessmentFormFromEntry(entry), scheduled: '' })
    } catch (err) {
      setWarning(err instanceof Error ? err.message : 'Could not cancel the scheduled time')
    }
  }

  return (
    <div className="rounded-md border border-app-border">
      <div className="flex items-center justify-between border-b border-app-border bg-app-muted px-2.5 py-1.5">
        <p className="text-[11px] font-bold tracking-[0.05em] uppercase text-app-text-weak">
          {kind} · {entries.length}
        </p>
        {onAdd ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              const wasAdding = adding
              closeForm()
              setAdding(!wasAdding)
            }}
            className="text-[11px] font-bold text-app-brand hover:underline disabled:opacity-50"
          >
            {adding ? 'Cancel' : `+ Add ${kind}`}
          </button>
        ) : null}
      </div>

      {warning ? (
        <div className="flex items-start gap-2 border-b border-app-border bg-kpi-reject-bg px-2.5 py-2 text-[11px] font-semibold text-kpi-reject-text">
          <p className="flex-1">{warning}</p>
          <button
            type="button"
            onClick={() => setWarning(null)}
            aria-label="Dismiss"
            className="shrink-0 font-bold hover:underline"
          >
            ✕
          </button>
        </div>
      ) : null}

      {adding ? formJsx : null}

      {sorted.length === 0 ? (
        <p className="px-2.5 py-2.5 text-[12px] text-app-text-weak">No {kind} entries yet.</p>
      ) : (
        <ul className="divide-y divide-app-border">
          {sorted.map((entry) => {
            if (editing?.sheetRow === entry.sheetRow) {
              return <li key={entry.sheetRow}>{formJsx}</li>
            }
            const expired = !entry.complete && isExpired(parseSheetDate(entry.deadline))
            return (
              <li key={entry.sheetRow} className="flex items-center gap-2 px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold text-app-text">
                    {formatDisplayDateTime(entry.deadline) || entry.deadline || 'No deadline'}
                    {entry.auto ? (
                      <span className="ml-1 font-normal text-app-text-weak">· Auto</span>
                    ) : null}
                  </p>
                  {entry.scheduled ? (
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-[11px] font-semibold text-kpi-oa-text">
                        Doing it {formatDisplayDateTime(entry.scheduled) || entry.scheduled}
                        {entry.calendarEventId ? ' · invite sent' : ' · no invite yet'}
                      </p>
                      {onEdit ? (
                        <DeleteButton
                          label={`Cancel the scheduled time for this ${kind}`}
                          text="Cancel time"
                          confirmText="Cancel it"
                          disabled={disabled}
                          onConfirm={() => cancelScheduled(entry)}
                        />
                      ) : null}
                    </div>
                  ) : null}
                  <p className="truncate text-[11px] text-app-text-weak">
                    {[entry.site, entry.lengthMinutes ? `${entry.lengthMinutes} min` : '']
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </p>
                  {entry.appRow === null && onLink ? (
                    <UnlinkedNote disabled={disabled} onLink={() => onLink(entry)} />
                  ) : null}
                </div>
                {onToggleComplete ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void onToggleComplete(entry, !entry.complete)}
                    title={expired ? 'Past its deadline — click to mark complete' : undefined}
                    className={[
                      'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold',
                      entry.complete
                        ? 'bg-kpi-offer-bg text-kpi-offer-text'
                        : expired
                          ? 'bg-kpi-reject-bg text-kpi-reject-text'
                          : 'bg-kpi-oa-bg text-kpi-oa-text',
                    ].join(' ')}
                  >
                    {entry.complete ? 'Complete' : expired ? 'Expired' : 'Pending'}
                  </button>
                ) : null}
                {onEdit ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => startEdit(entry)}
                    aria-label={`Edit ${kind} entry`}
                    className="shrink-0 text-[11px] font-bold text-app-brand hover:underline disabled:opacity-50"
                  >
                    Edit
                  </button>
                ) : null}
                {onDelete ? (
                  <DeleteButton
                    label={`Delete ${kind} entry`}
                    disabled={disabled}
                    onConfirm={() => onDelete(entry)}
                  />
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
