import { useEffect, useId, useRef } from 'react'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Keep editing',
  danger,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const titleId = useId()
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const id = window.setTimeout(() => confirmRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
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
            {title}
          </h2>
        </div>
        <div className="space-y-3 px-4 py-4">
          <p className="text-[13px] font-semibold text-app-text">{message}</p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="h-9 rounded border border-app-border px-3 text-[12px] font-bold text-app-text hover:bg-app-hover"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              className={
                danger
                  ? 'h-9 rounded bg-rose-600 px-3 text-[12px] font-bold text-white hover:bg-rose-700'
                  : 'h-9 rounded bg-app-brand px-3 text-[12px] font-bold text-white hover:bg-app-brand-dark dark:text-teal-950'
              }
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
