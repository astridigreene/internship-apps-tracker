import type { ViewId } from '../types'

interface SidebarProps {
  active: ViewId
  onNavigate: (view: ViewId) => void
}

const NAV_ITEMS: { id: ViewId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'applications', label: 'Applications' },
]

export function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-slds-border bg-slds-surface">
      <div className="border-b border-slds-border px-4 py-3">
        <p className="text-[11px] font-bold tracking-wider text-slds-text-weak uppercase">
          Navigation
        </p>
      </div>
      <nav className="flex flex-col gap-0.5 p-2" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={[
                'rounded-[2px] px-3 py-2 text-left text-sm',
                isActive
                  ? 'bg-slds-active-nav font-semibold text-slds-brand'
                  : 'font-normal text-slds-text hover:bg-slds-hover',
              ].join(' ')}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.label}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
