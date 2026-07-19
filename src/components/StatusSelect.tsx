import { APPLICATION_STATUSES, type ApplicationStatus } from '../types'

interface StatusSelectProps {
  value: string
  disabled?: boolean
  onChange: (status: ApplicationStatus) => void
}

export function StatusSelect({ value, disabled, onChange }: StatusSelectProps) {
  return (
    <select
      value={value}
      disabled={disabled}
      aria-label="Application status"
      onChange={(e) => onChange(e.target.value as ApplicationStatus)}
      className="h-8 w-full max-w-none rounded border border-app-border bg-app-surface px-1.5 text-[12px] font-bold text-app-text outline-none focus:border-app-brand disabled:opacity-60"
    >
      {!APPLICATION_STATUSES.includes(value as ApplicationStatus) ? (
        <option value={value}>{value}</option>
      ) : null}
      {APPLICATION_STATUSES.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  )
}
