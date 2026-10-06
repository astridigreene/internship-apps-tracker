import { useState, type FormEvent } from 'react'
import type { InterviewEntry, NewInterviewInput, NewScreeningInput, ScreeningEntry } from '../types'
import { formatDisplayDateTime, formatTimeOfDay, parseSheetDate, parseTimeOfDay } from '../lib/time'
import { DeleteButton, UnlinkedNote } from './EntryControls'

type Entry = InterviewEntry | ScreeningEntry
type Input = NewInterviewInput | NewScreeningInput

interface DateEntriesPanelProps<E extends Entry> {
  kind: 'Interview' | 'Screening'
  entries: E[]
  companyDefault?: string
  disabled?: boolean
  showComplete: boolean
  onAdd?: (input: Input) => Promise<void>
  onToggleComplete?: (entry: InterviewEntry, complete: boolean) => Promise<void>
  onDelete?: (entry: E) => Promise<void>
  /** Set this entry's App Row to the application being viewed. */
  onLink?: (entry: E) => Promise<void>
}

const EMPTY = (company: string): Input => ({ company, dateTime: '', endTime: '', notes: '' })

function hasComplete(entry: Entry): entry is InterviewEntry {
  return 'complete' in entry
}

export function DateEntriesPanel<E extends Entry>({
  kind,
  entries,
  companyDefault,
  disabled,
  showComplete,
  onAdd,
  onToggleComplete,
  onDelete,
  onLink,
}: DateEntriesPanelProps<E>) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<Input>(() => EMPTY(companyDefault ?? ''))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const sorted = [...entries].sort((a, b) => {
    const at = parseSheetDate(a.dateTime)?.getTime() ?? Number.NaN
    const bt = parseSheetDate(b.dateTime)?.getTime() ?? Number.NaN
    if (Number.isNaN(at) && Number.isNaN(bt)) return 0
    if (Number.isNaN(at)) return 1
    if (Number.isNaN(bt)) return -1
    return at - bt
  })

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!onAdd) return
    if (!form.company.trim() || !form.dateTime.trim()) {
      setError('Company and Date & Time are required.')
      return
    }
    const startMinutes = parseTimeOfDay(form.dateTime)
    const endMinutes = parseTimeOfDay(form.endTime ?? '')
    if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
      setError('End time must be after the start time.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onAdd(form)
      setForm(EMPTY(companyDefault ?? ''))
      setAdding(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not add ${kind}`)
    } finally {
      setSubmitting(false)
    }
  }

  const fieldClass =
    'h-8 w-full rounded border border-app-border bg-app-surface px-2 text-[12px] font-semibold text-app-text outline-none focus:border-app-brand'

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
            onClick={() => setAdding((v) => !v)}
            className="text-[11px] font-bold text-app-brand hover:underline disabled:opacity-50"
          >
            {adding ? 'Cancel' : `+ Add ${kind}`}
          </button>
        ) : null}
      </div>

      {adding ? (
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
          <div className="grid grid-cols-[2fr_1fr] gap-1.5">
            <label className="block text-[10px] font-bold uppercase text-app-text-weak">
              Date & Time
              <input
                type="datetime-local"
                required
                value={form.dateTime}
                onChange={(e) => setForm((f) => ({ ...f, dateTime: e.target.value }))}
                className={fieldClass}
              />
            </label>
            <label className="block text-[10px] font-bold uppercase text-app-text-weak">
              End time
              <input
                type="time"
                value={form.endTime ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                className={fieldClass}
              />
            </label>
          </div>
          <label className="block text-[10px] font-bold uppercase text-app-text-weak">
            Notes
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className={fieldClass}
            />
          </label>
          {error ? <p className="text-[11px] font-semibold text-kpi-reject-text">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="h-8 w-full rounded bg-app-brand text-[12px] font-bold text-white hover:bg-app-brand-dark disabled:opacity-50 dark:text-teal-950"
          >
            {submitting ? 'Saving…' : `Save ${kind}`}
          </button>
        </form>
      ) : null}

      {sorted.length === 0 ? (
        <p className="px-2.5 py-2.5 text-[12px] text-app-text-weak">No {kind.toLowerCase()}s yet.</p>
      ) : (
        <ul className="divide-y divide-app-border">
          {sorted.map((entry) => {
            const endMinutes = parseTimeOfDay(entry.endTime)
            const end = endMinutes === null ? entry.endTime : formatTimeOfDay(endMinutes)
            return (
              <li key={entry.sheetRow} className="flex items-center gap-2 px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold text-app-text">
                    {formatDisplayDateTime(entry.dateTime) || entry.dateTime || 'No date/time'}
                    {end ? ` – ${end}` : ''}
                  </p>
                  {entry.notes ? (
                    <p className="truncate text-[11px] text-app-text-weak">{entry.notes}</p>
                  ) : null}
                  {entry.appRow === null && onLink ? (
                    <UnlinkedNote disabled={disabled} onLink={() => onLink(entry)} />
                  ) : null}
                </div>
                {showComplete && hasComplete(entry) && onToggleComplete ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void onToggleComplete(entry, !entry.complete)}
                    className={[
                      'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold',
                      entry.complete
                        ? 'bg-kpi-offer-bg text-kpi-offer-text'
                        : 'bg-kpi-oa-bg text-kpi-oa-text',
                    ].join(' ')}
                  >
                    {entry.complete ? 'Complete' : 'Pending'}
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
