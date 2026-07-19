const STATUS_STYLES: Record<string, string> = {
  Applied: 'bg-[#e5e5e5] text-[#3e3e3c]',
  OA: 'bg-[#d8e6fe] text-[#032d60]',
  Interview: 'bg-[#f9e3b6] text-[#8c4b02]',
  Offer: 'bg-[#cdefc4] text-[#194e31]',
  Rejected: 'bg-[#fddde3] text-[#8e030f]',
}

interface StatusPillProps {
  status: string
}

export function StatusPill({ status }: StatusPillProps) {
  const styles = STATUS_STYLES[status] ?? 'bg-[#e5e5e5] text-[#3e3e3c]'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${styles}`}
    >
      {status}
    </span>
  )
}
