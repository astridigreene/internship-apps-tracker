import { useId, useState, type KeyboardEvent } from 'react'

export interface SearchSelectOption {
  value: string
  label: string
  /** Second line under the label. */
  detail?: string
  /** Extra text the search matches against (besides label and detail). */
  keywords?: string
}

interface SearchSelectProps {
  options: SearchSelectOption[]
  value: string | null
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  emptyText?: string
  className?: string
}

/** A text box that filters a dropdown list as you type (arrow keys + Enter to pick). */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  emptyText = 'No matches',
  className = '',
}: SearchSelectProps) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const selected = options.find((o) => o.value === value) ?? null
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const filtered = options.filter((o) => {
    const haystack = `${o.label} ${o.detail ?? ''} ${o.keywords ?? ''}`.toLowerCase()
    return terms.every((term) => haystack.includes(term))
  })

  function pick(option: SearchSelectOption) {
    onChange(option.value)
    setOpen(false)
    setQuery('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, filtered.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter' && open) {
      event.preventDefault()
      if (filtered[active]) pick(filtered[active])
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div className={`relative ${className}`}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
        disabled={disabled}
        placeholder={selected ? selected.label : placeholder}
        value={open ? query : (selected?.label ?? '')}
        onFocus={() => {
          setOpen(true)
          setActive(0)
        }}
        onBlur={() => {
          setOpen(false)
          setQuery('')
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onKeyDown={handleKeyDown}
        className="h-8 w-full rounded border border-app-border bg-app-surface px-2 text-[12px] font-semibold text-app-text outline-none placeholder:text-app-text-weak focus:border-app-brand"
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 font-normal normal-case overflow-auto rounded-md border border-app-border bg-app-surface py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-2.5 py-2 text-[12px] text-app-text-weak">{emptyText}</li>
          ) : (
            filtered.map((option, i) => (
              <li
                key={option.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={option.value === value}
                // mousedown (not click) so the pick lands before the input's blur closes the list
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(option)
                }}
                onMouseEnter={() => setActive(i)}
                className={[
                  'cursor-pointer px-2.5 py-1.5',
                  i === active ? 'bg-app-hover' : '',
                  option.value === value ? 'font-bold' : '',
                ].join(' ')}
              >
                <p className="truncate text-[12px] font-semibold text-app-text">{option.label}</p>
                {option.detail ? (
                  <p className="truncate text-[11px] text-app-text-weak">{option.detail}</p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
