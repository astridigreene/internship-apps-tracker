import { useEffect, useId, useRef } from 'react'
import type { Application } from '../types'

interface DeleteConfirmModalProps {
  app: Application | null
  submitting?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteConfirmModal({
  app,
  submitting,
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  const titleId = useId()
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!app) {
      return
    }
    const id = window.setTimeout(() => confirmRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [app])

  useEffect(() => {
    if (!app) {
      return
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) {
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [app, onCancel, submitting])

  if (!app) {
    return null
  }

  const label = [app.company, app.role].filter(Boolean).join(' · ') || 'this application'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onCancel()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm rounded-t-xl border border-panel-border bg-app-surface shadow-[0_16px_40px_rgba(0,0,0,0.18)] sm:rounded-lg"
      >
        <div className="border-b border-app-border px-4 py-3">
          <h2 id={titleId} className="text-[15px] font-bold text-app-text">
            Delete application?
          </h2>
        </div>
        <div className="space-y-3 px-4 py-4">
          <p className="text-[13px] font-semibold text-app-text">
            Are you sure you want to delete?
          </p>
          <p className="text-[12px] font-medium text-app-text-weak">
            This will permanently remove <span className="font-bold text-app-text">{label}</span>{' '}
            from the Google Sheet and shift rows below it upward.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="h-9 rounded border border-app-border px-3 text-[12px] font-bold text-app-text hover:bg-app-hover disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              disabled={submitting}
              className="h-9 rounded bg-rose-600 px-3 text-[12px] font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
