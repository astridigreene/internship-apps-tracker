import type { ViewId } from '../types'

interface MobileTabBarProps {
  active: ViewId
  onNavigate: (view: ViewId) => void
}

const TABS: { id: ViewId; label: string; icon: 'home' | 'list' }[] = [
  { id: 'dashboard', label: 'Home', icon: 'home' },
  { id: 'applications', label: 'Apps', icon: 'list' },
]

function TabIcon({ icon, active }: { icon: 'home' | 'list'; active: boolean }) {
  const stroke = active ? 'currentColor' : 'currentColor'
  if (icon === 'home') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path
          d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function MobileTabBar({ active, onNavigate }: MobileTabBarProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-app-border bg-app-surface/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))' }}
      aria-label="Primary"
    >
      <div className="grid grid-cols-2 gap-1 px-2 pt-1">
        {TABS.map((tab) => {
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-bold',
                isActive ? 'text-app-brand' : 'text-app-text-weak',
              ].join(' ')}
            >
              <TabIcon icon={tab.icon} active={isActive} />
              {tab.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
