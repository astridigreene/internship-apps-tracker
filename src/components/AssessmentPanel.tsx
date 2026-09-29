import { useState, type FormEvent } from 'react'
import type { AssessmentEntry, NewAssessmentInput } from '../types'
import { formatDisplayDate } from '../lib/time'

interface AssessmentPanelProps {
  kind: 'OA' | 'HireVue'
  entries: AssessmentEntry[]
  companyDefault?: string
  disabled?: boolean
  onAdd?: (input: NewAssessmentInput) => Promise<void>
  onToggleComplete?: (entry: AssessmentEntry, complete: boolean) => Promise<void>
  onDelete?: (entry: AssessmentEntry) => Promise<void>
}

const EMPTY = (company: string): NewAssessmentInput => ({
  company,
  deadline: '',
  auto: false,
  dateOffered: '',
  lengthMinutes: '',
  site: '',
})

export function AssessmentPanel({
  kind,
  entries,
  companyDefault,
  disabled,
  onAdd,
  onToggleComplete,
  onDelete,
}: AssessmentPanelProps) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<NewAssessmentInput>(() => EMPTY(companyDefault ?? ''))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const sorted = [...entries].sort((a, b) => {
    if (a.complete !== b.complete) {
      return a.complete ? 1 : -1
    }
    const at = Date.parse(a.deadline)
    const bt = Date.parse(b.deadline)
    if (Number.isNaN(at) && Number.isNaN(bt)) return 0
    if (Number.isNaN(at)) return 1
    if (Number.isNaN(bt)) return -1
    return at - bt
  })

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!onAdd) return
    if (!form.company.trim() || !form.deadline.trim()) {
      setError('Company and Deadline are required.')
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
          <div className="grid grid-cols-2 gap-1.5">
            <label className="text-[10px] font-bold uppercase text-app-text-weak">
              Deadline
              <input
                type="date"
                required
                value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                className={fieldClass}
              />
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
        <p className="px-2.5 py-2.5 text-[12px] text-app-text-weak">No {kind} entries yet.</p>
      ) : (
        <ul className="divide-y divide-app-border">
          {sorted.map((entry) => (
            <li key={entry.sheetRow} className="flex items-center gap-2 px-2.5 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold text-app-text">
                  {formatDisplayDate(entry.deadline) || entry.deadline || 'No deadline'}
                  {entry.auto ? <span className="ml-1 font-normal text-app-text-weak">· Auto</span> : null}
                </p>
                <p className="truncate text-[11px] text-app-text-weak">
                  {[entry.site, entry.lengthMinutes ? `${entry.lengthMinutes} min` : '']
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </p>
              </div>
              {onToggleComplete ? (
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
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void onDelete(entry)}
                  aria-label={`Delete ${kind} entry`}
                  className="shrink-0 text-[11px] font-bold text-rose-600 hover:underline disabled:opacity-50 dark:text-rose-400"
                >
                  Delete
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
