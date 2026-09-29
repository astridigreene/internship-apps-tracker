import { useMemo } from 'react'
import type { AssessmentEntry } from '../types'
import { isDueSoon, parseSheetDate } from '../lib/time'

interface DueSoonBannerProps {
  oaEntries: AssessmentEntry[]
  hireVueEntries: AssessmentEntry[]
  onSelectCompany?: (company: string) => void
}

export function DueSoonBanner({ oaEntries, hireVueEntries, onSelectCompany }: DueSoonBannerProps) {
  const dueSoon = useMemo(() => {
    return [...oaEntries, ...hireVueEntries].filter(
      (entry) => !entry.complete && isDueSoon(parseSheetDate(entry.deadline)),
    )
  }, [oaEntries, hireVueEntries])

  if (dueSoon.length === 0) {
    return null
  }

  return (
    <div
      role="alert"
      className="flex shrink-0 flex-col gap-1.5 rounded-lg border border-amber-300 bg-amber-500/10 px-3.5 py-3 dark:border-amber-500/40 dark:bg-amber-500/10"
    >
      <p className="text-[13px] font-bold text-amber-800 lg:text-[12px] dark:text-amber-300">
        ⚠ {dueSoon.length} due within 24 hours — finish {dueSoon.length === 1 ? 'this' : 'these'} soon
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {dueSoon.map((entry) => (
          <li key={`${entry.kind}-${entry.sheetRow}`}>
            <button
              type="button"
              disabled={!onSelectCompany}
              onClick={() => onSelectCompany?.(entry.company)}
              className={[
                'text-[12px] font-semibold text-amber-800 lg:text-[11px] dark:text-amber-300',
                onSelectCompany ? 'cursor-pointer hover:underline' : 'cursor-default',
              ].join(' ')}
            >
              {entry.company || 'Untitled'} · {entry.kind}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
