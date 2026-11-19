import { isRejectedStatus, isWithdrewStatus, type OfferDecision } from '../types'

const STATUS_STYLES: Record<string, string> = {
  Applied: 'bg-status-applied-bg text-status-applied-text',
  Progressed: 'bg-status-oa-bg text-status-oa-text',
  Interview: 'bg-status-interview-bg text-status-interview-text',
  Offer: 'bg-status-offer-bg text-status-offer-text',
  Rejected: 'bg-status-rejected-bg text-status-rejected-text',
  Withdrew: 'bg-status-withdrew-bg text-status-withdrew-text',
}

interface StatusPillProps {
  status: string
}

export function StatusPill({ status }: StatusPillProps) {
  const styles = isRejectedStatus(status)
    ? STATUS_STYLES.Rejected
    : isWithdrewStatus(status)
      ? STATUS_STYLES.Withdrew
      : (STATUS_STYLES[status] ?? 'bg-status-applied-bg text-status-applied-text')
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] leading-4 font-bold whitespace-nowrap ${styles}`}
    >
      {status}
    </span>
  )
}

const DECISION_STYLES: Record<Exclude<OfferDecision, ''>, string> = {
  Accepted: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
  Declined: 'border-slate-400/50 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  Reneged: 'border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-200',
}

/** Small badge for what you did with an offer; renders nothing while undecided. */
export function OfferDecisionBadge({ decision }: { decision: OfferDecision }) {
  if (!decision) {
    return null
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-4 font-bold whitespace-nowrap ${DECISION_STYLES[decision]}`}
    >
      {decision}
    </span>
  )
}
