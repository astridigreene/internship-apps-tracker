interface KpiCardProps {
  label: string
  value: string | number
  suffix?: string
}

export function KpiCard({ label, value, suffix }: KpiCardProps) {
  return (
    <div className="rounded-[2px] border border-slds-border bg-slds-surface px-4 py-3">
      <p className="mb-2 text-[11px] font-bold tracking-wider text-slds-text-weak uppercase">
        {label}
      </p>
      <p className="text-[28px] leading-none font-bold text-slds-text tabular-nums">
        {value}
        {suffix ? (
          <span className="ml-0.5 text-base font-semibold text-slds-text-weak">
            {suffix}
          </span>
        ) : null}
      </p>
    </div>
  )
}
