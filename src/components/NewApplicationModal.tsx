import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
  type NewApplicationInput,
} from '../types'

interface NewApplicationModalProps {
  open: boolean
  submitting?: boolean
  onClose: () => void
  onSubmit: (application: NewApplicationInput) => Promise<void> | void
}

function todayInputValue(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const EMPTY: NewApplicationInput = {
  company: '',
  location: '',
  role: '',
  dateApplied: '',
  status: 'Applied',
}

export function NewApplicationModal({
  open,
  submitting,
  onClose,
  onSubmit,
}: NewApplicationModalProps) {
  const titleId = useId()
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<NewApplicationInput>(EMPTY)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    setForm({ ...EMPTY, dateApplied: todayInputValue() })
    setError(null)
    const id = window.setTimeout(() => firstFieldRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, submitting])

  const complete = useMemo(() => {
    return (
      form.company.trim() !== '' &&
      form.location.trim() !== '' &&
      form.role.trim() !== '' &&
      form.dateApplied.trim() !== '' &&
      Boolean(form.status)
    )
  }, [form])

  if (!open) {
    return null
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!complete || submitting) {
      setError('Fill in every field before saving.')
      return
    }
    setError(null)
    try {
      await onSubmit({
        company: form.company.trim(),
        location: form.location.trim(),
        role: form.role.trim(),
        dateApplied: form.dateApplied.trim(),
        status: form.status,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add application')
    }
  }

  const fieldClass =
    'mt-1 h-9 w-full rounded border border-app-border bg-app-surface px-2.5 text-[13px] font-semibold text-app-text outline-none focus:border-app-brand'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) {
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
        <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
          <h2 id={titleId} className="text-[15px] font-bold text-app-text">
            New application
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-[12px] font-bold text-app-text-weak hover:text-app-text disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 px-4 py-4" noValidate>
          <label className="block text-[11px] font-bold tracking-[0.06em] uppercase text-app-text-weak">
            Company
            <input
              ref={firstFieldRef}
              required
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              className={fieldClass}
              autoComplete="organization"
            />
          </label>

          <label className="block text-[11px] font-bold tracking-[0.06em] uppercase text-app-text-weak">
            Location
            <input
              required
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              className={fieldClass}
            />
          </label>

          <label className="block text-[11px] font-bold tracking-[0.06em] uppercase text-app-text-weak">
            Role
            <input
              required
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className={fieldClass}
            />
          </label>

          <label className="block text-[11px] font-bold tracking-[0.06em] uppercase text-app-text-weak">
            Date Applied
            <input
              required
              type="date"
              value={form.dateApplied}
              onChange={(e) => setForm((f) => ({ ...f, dateApplied: e.target.value }))}
              className={fieldClass}
            />
          </label>

          <label className="block text-[11px] font-bold tracking-[0.06em] uppercase text-app-text-weak">
            Status
            <select
              required
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as ApplicationStatus }))
              }
              className={fieldClass}
            >
              {APPLICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          {error ? (
            <p className="text-[12px] font-semibold text-kpi-reject-text" role="alert">
              {error}
            </p>
          ) : (
            <p className="text-[11px] font-medium text-app-text-weak">
              All fields are required. This adds a new row to the current year sheet.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-9 rounded border border-app-border px-3 text-[12px] font-bold text-app-text hover:bg-app-hover disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!complete || submitting}
              className="h-9 rounded bg-app-brand px-3 text-[12px] font-bold text-white hover:bg-app-brand-dark disabled:cursor-not-allowed disabled:opacity-45 dark:text-teal-950"
            >
              {submitting ? 'Saving…' : 'Add to sheet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
