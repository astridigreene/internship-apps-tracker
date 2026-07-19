import { isRejectedStatus } from '../types'

const STATUS_STYLES: Record<string, string> = {
  Applied: 'bg-status-applied-bg text-status-applied-text',
  OA: 'bg-status-oa-bg text-status-oa-text',
  Interview: 'bg-status-interview-bg text-status-interview-text',
  Offer: 'bg-status-offer-bg text-status-offer-text',
  Rejected: 'bg-status-rejected-bg text-status-rejected-text',
  'OA->Rejected': 'bg-status-rejected-bg text-status-rejected-text',
  'Interview->Rejected': 'bg-status-rejected-bg text-status-rejected-text',
}

interface StatusPillProps {
  status: string
}

export function StatusPill({ status }: StatusPillProps) {
  const styles = isRejectedStatus(status)
    ? STATUS_STYLES.Rejected
    : (STATUS_STYLES[status] ?? 'bg-status-applied-bg text-status-applied-text')
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] leading-4 font-bold whitespace-nowrap ${styles}`}
    >
      {status}
    </span>
  )
}
