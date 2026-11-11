import type { NeetCodeDifficulty } from '../types'

const DIFF_LABEL: Record<NeetCodeDifficulty, string> = { E: 'Easy', M: 'Medium', H: 'Hard' }

const DIFF_CLASS: Record<NeetCodeDifficulty, string> = {
  E: 'bg-status-offer-bg text-status-offer-text',
  M: 'bg-status-interview-bg text-status-interview-text',
  H: 'bg-status-rejected-bg text-status-rejected-text',
}

export function DiffBadge({ difficulty }: { difficulty: NeetCodeDifficulty | '' }) {
  if (!difficulty) {
    return null
  }
  return (
    <span
      className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded px-1 text-[11px] font-bold ${DIFF_CLASS[difficulty]}`}
      title={DIFF_LABEL[difficulty]}
    >
      {difficulty}
    </span>
  )
}
