type KpiTone = 'applied' | 'oa' | 'interview' | 'offer' | 'reject' | 'neutral'

interface KpiCardProps {
  label: string
  value: string | number
  suffix?: string
  rate?: string
  compact?: boolean
  tone?: KpiTone
  onClick?: () => void
  className?: string
}

const TONE_CLASS: Record<KpiTone, string> = {
  applied: 'border-kpi-applied-border bg-kpi-applied-bg text-kpi-applied-text',
  oa: 'border-kpi-oa-border bg-kpi-oa-bg text-kpi-oa-text',
  interview: 'border-kpi-interview-border bg-kpi-interview-bg text-kpi-interview-text',
  offer: 'border-kpi-offer-border bg-kpi-offer-bg text-kpi-offer-text',
  reject: 'border-kpi-reject-border bg-kpi-reject-bg text-kpi-reject-text',
  neutral: 'border-app-border bg-app-surface text-app-text',
}

export function KpiCard({
  label,
  value,
  suffix,
  rate,
  compact,
  tone = 'neutral',
  onClick,
  className: classNameProp,
}: KpiCardProps) {
  const className = [
    'rounded-xl border text-left lg:rounded-md',
    TONE_CLASS[tone],
    compact ? 'px-3 py-2.5 lg:px-2.5 lg:py-1.5' : 'px-3.5 py-3',
    onClick
      ? 'w-full transition hover:brightness-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-brand'
      : '',
    classNameProp ?? '',
  ].join(' ')

  const content = (
    <>
      <p className="text-[11px] font-semibold tracking-[0.08em] uppercase opacity-80 lg:text-[10px]">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-1.5 lg:mt-0.5">
        <p
          className={[
            'leading-none font-bold tracking-tight tabular-nums',
            compact ? 'text-[22px] lg:text-[18px]' : 'text-[22px]',
          ].join(' ')}
        >
          {value}
          {suffix ? (
            <span className="ml-0.5 text-[11px] font-semibold opacity-70">{suffix}</span>
          ) : null}
        </p>
        {rate ? (
          <p className="text-[12px] font-semibold tabular-nums opacity-70 lg:text-[11px]">{rate}</p>
        ) : null}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}
