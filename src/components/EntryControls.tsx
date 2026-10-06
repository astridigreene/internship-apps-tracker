import { useEffect, useState } from 'react'

/** Delete with a confirm step, so a stray tap next to the status pill can't remove a sheet row. */
export function DeleteButton({
  label,
  disabled,
  onConfirm,
}: {
  label: string
  disabled?: boolean
  onConfirm: () => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!confirming) return
    const timer = window.setTimeout(() => setConfirming(false), 4000)
    return () => window.clearTimeout(timer)
  }, [confirming])

  if (!confirming) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setConfirming(true)}
        aria-label={label}
        className="shrink-0 text-[11px] font-bold text-rose-600 hover:underline disabled:opacity-50 dark:text-rose-400"
      >
        Delete
      </button>
    )
  }

  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setConfirming(false)
          void onConfirm()
        }}
        className="rounded bg-rose-600 px-1.5 py-0.5 text-white hover:bg-rose-700 disabled:opacity-50"
      >
        Confirm delete
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-app-text-weak hover:underline"
      >
        Keep
      </button>
    </span>
  )
}

/** Shown on entries with no App Row — they appear on every role at the company until linked. */
export function UnlinkedNote({ disabled, onLink }: { disabled?: boolean; onLink: () => Promise<void> }) {
  return (
    <p className="mt-0.5 text-[11px] text-kpi-oa-text">
      Not linked to a role — shows on every role at this company ·{' '}
      <button
        type="button"
        disabled={disabled}
        onClick={() => void onLink().catch(() => {})}
        className="font-bold underline disabled:opacity-50"
      >
        Link to this role
      </button>
    </p>
  )
}
