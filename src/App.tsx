import { useState } from 'react'
import data from './data/data.json'
import type { TrackerData, ViewId } from './types'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { DashboardView } from './views/DashboardView'
import { ApplicationsView } from './views/ApplicationsView'

const trackerData = data as TrackerData

export default function App() {
  const [view, setView] = useState<ViewId>('dashboard')

  return (
    <div className="flex h-full min-h-0 bg-slds-bg">
      <Sidebar active={view} onNavigate={setView} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar lastSynced={trackerData.lastSynced} />
        <main className="min-h-0 flex-1 overflow-auto p-4">
          {view === 'dashboard' ? (
            <DashboardView data={trackerData} />
          ) : (
            <ApplicationsView applications={trackerData.applications} />
          )}
        </main>
      </div>
    </div>
  )
}
