import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { formatPay, parsePay, type ReturnOffer } from '../types'

interface ReturnOfferModalProps {
  open: boolean
  /** The logged return offer, or null to add one. */
  offer: ReturnOffer | null
  saving?: boolean
  onClose: () => void
  /** Save the offer, or remove it with null. */
  onSave?: (offer: ReturnOffer | null) => Promise<void>
}

const EMPTY: ReturnOffer = { company: '', location: '', role: '', pay: '' }

/** Add / edit / remove the year's single return offer. */
export function ReturnOfferModal({ open, offer, saving, onClose, onSave }: ReturnOfferModalProps) {
  const titleId = useId()
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<ReturnOffer>(EMPTY)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const pay = offer ? parsePay(offer.pay) : null
    setForm(offer ? { ...offer, pay: pay === null ? offer.pay : String(pay) } : EMPTY)
    setError(null)
    const id = window.setTimeout(() => firstFieldRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open, offer])

  useEffect(() => {
    if (!open) {
      return
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, saving])

  if (!open) {
    return null
  }

  const complete = form.company.trim() !== '' && form.role.trim() !== ''
  const payInvalid = form.pay.trim() !== '' && parsePay(form.pay) === null

  async function save(next: ReturnOffer | null) {
    if (!onSave || saving) {
      return
    }
    setError(null)
    try {
      await onSave(next)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save return offer')
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!complete || payInvalid) {
      setError(payInvalid ? 'Pay should be a number of dollars per hour.' : 'Company and Role are required.')
      return
    }
    void save(form)
  }

  const labelClass = 'block text-[11px] font-bold tracking-[0.06em] uppercase text-app-text-weak'
  const fieldClass =
    'mt-1 h-9 w-full rounded border border-app-border bg-app-surface px-2.5 text-[13px] font-semibold text-app-text outline-none focus:border-app-brand'

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
        <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
          <h2 id={titleId} className="text-[15px] font-bold text-app-text">
            {offer ? 'Return offer' : 'Log return offer'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-[12px] font-bold text-app-text-weak hover:text-app-text disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 px-4 py-4" noValidate>
          <label className={labelClass}>
            Company
            <input
              ref={firstFieldRef}
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              className={fieldClass}
              autoComplete="organization"
            />
          </label>
          <label className={labelClass}>
            Location
            <input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Role
            <input
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Pay ($/hr)
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="e.g. 45"
              value={form.pay}
              onChange={(e) => setForm((f) => ({ ...f, pay: e.target.value }))}
              className={fieldClass}
            />
          </label>

          {error ? (
            <p className="text-[12px] font-semibold text-kpi-reject-text" role="alert">
              {error}
            </p>
          ) : (
            <p className="text-[11px] font-medium text-app-text-weak">
              One per year. It counts toward your Offer stats
              {form.pay && !payInvalid ? ` · ${formatPay(form.pay)}` : ''}.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {offer ? (
              <button
                type="button"
                disabled={saving || !onSave}
                onClick={() => {
                  void save(null)
                }}
                className="h-9 rounded border border-rose-300 bg-rose-500/10 px-3 text-[12px] font-bold text-rose-700 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-500/40 dark:text-rose-300"
              >
                Remove
              </button>
            ) : null}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="h-9 rounded border border-app-border px-3 text-[12px] font-bold text-app-text hover:bg-app-hover disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!complete || payInvalid || saving || !onSave}
                className="h-9 rounded bg-app-brand px-3 text-[12px] font-bold text-white hover:bg-app-brand-dark disabled:cursor-not-allowed disabled:opacity-45 dark:text-teal-950"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
