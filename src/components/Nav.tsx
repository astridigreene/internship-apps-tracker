import type { ViewId } from '../types'

interface NavProps {
  active: ViewId
  onNavigate: (view: ViewId) => void
}

const NAV_ITEMS: { id: ViewId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'applications', label: 'Applications' },
]

export function Nav({ active, onNavigate }: NavProps) {
  return (
    <nav className="flex items-center gap-0.5" aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const isActive = active === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={[
              'h-7 rounded px-2.5 text-[13px] font-medium transition-colors',
              isActive
                ? 'bg-white text-teal-700'
                : 'text-white/85 hover:bg-white/15 hover:text-white',
            ].join(' ')}
            aria-current={isActive ? 'page' : undefined}
          >
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
