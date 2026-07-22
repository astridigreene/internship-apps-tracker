interface YearTabsProps {
  years: string[]
  selected: string
  onSelect: (year: string) => void
  disabled?: boolean
}

export function YearTabs({ years, selected, onSelect, disabled }: YearTabsProps) {
  return (
    <div className="inline-flex max-w-full items-center overflow-x-auto rounded-lg border border-white/25 bg-black/10 p-0.5 lg:rounded-md">
      {years.map((year) => {
        const active = year === selected
        return (
          <button
            key={year}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(year)}
            className={[
              'h-9 min-w-14 shrink-0 rounded-md px-3 text-[13px] font-semibold tabular-nums transition-colors disabled:opacity-50 lg:h-7 lg:min-w-11 lg:rounded lg:px-2.5 lg:text-[12px]',
              active
                ? 'bg-white text-teal-700'
                : 'text-white/80 hover:bg-white/10 hover:text-white',
            ].join(' ')}
          >
            {year}
          </button>
        )
      })}
    </div>
  )
}
