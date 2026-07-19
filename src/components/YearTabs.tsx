interface YearTabsProps {
  years: string[]
  selected: string
  onSelect: (year: string) => void
  disabled?: boolean
}

export function YearTabs({ years, selected, onSelect, disabled }: YearTabsProps) {
  return (
    <div className="inline-flex items-center rounded-md border border-white/25 bg-black/10 p-0.5">
      {years.map((year) => {
        const active = year === selected
        return (
          <button
            key={year}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(year)}
            className={[
              'h-7 min-w-11 rounded px-2.5 text-[12px] font-semibold tabular-nums transition-colors disabled:opacity-50',
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
