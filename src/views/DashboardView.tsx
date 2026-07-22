import { useMemo, useState } from 'react'
import type { Application, ApplicationStatus, OaComplete, TrackerData } from '../types'
import { KpiCard } from '../components/KpiCard'
import { StatusFunnel } from '../components/StatusFunnel'
import { RecentUpdates } from '../components/RecentUpdates'
import { OaCard } from '../components/OaCard'
import { ApplicationDetailModal } from '../components/ApplicationDetailModal'
import { computeStats } from '../lib/sheet'
import type { ApplicationsStatusFilter, StatusEditChange } from './ApplicationsView'

interface DashboardViewProps {
  data: TrackerData
  saving?: boolean
  onOpenApplications: (filter: ApplicationsStatusFilter) => void
  onSaveStatusChanges?: (changes: StatusEditChange[]) => Promise<void>
  onUpdateOaComplete?: (app: Application, oaComplete: OaComplete) => Promise<void>
}

function formatRate(rate: number): string {
  return `${rate.toFixed(1)}%`
}

export function DashboardView({
  data,
  saving,
  onOpenApplications,
  onSaveStatusChanges,
  onUpdateOaComplete,
}: DashboardViewProps) {
  const stats = useMemo(() => computeStats(data.applications), [data.applications])
  const [detailApp, setDetailApp] = useState<Application | null>(null)

  const detailAppLive =
    detailApp === null
      ? null
      : (data.applications.find((a) => a.sheetRow === detailApp.sheetRow) ?? detailApp)

  async function handleDetailStatusUpdate(app: Application, toStatus: ApplicationStatus) {
    if (!onSaveStatusChanges) {
      return
    }
    await onSaveStatusChanges([
      {
        app,
        fromStatus: app.status,
        toStatus,
      },
    ])
  }

  const kpiClass = 'w-[46%] shrink-0 snap-start sm:w-[30%] lg:w-auto lg:shrink'

  return (
    <div className="flex flex-col gap-3 lg:h-full lg:min-h-0 lg:gap-2">
      <ApplicationDetailModal
        app={detailAppLive}
        saving={saving}
        onClose={() => {
          if (!saving) {
            setDetailApp(null)
          }
        }}
        onUpdateStatus={onSaveStatusChanges ? handleDetailStatusUpdate : undefined}
        onUpdateOaComplete={onUpdateOaComplete}
      />

      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-0.5 snap-x snap-mandatory [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0 lg:pb-0 lg:snap-none [&::-webkit-scrollbar]:hidden">
        <KpiCard
          className={kpiClass}
          compact
          tone="applied"
          label="Applied"
          value={stats.totalApplications}
          onClick={() => onOpenApplications('All')}
        />
        <KpiCard
          className={kpiClass}
          compact
          tone="oa"
          label="OA"
          value={stats.oas}
          rate={formatRate(stats.oaRate)}
          onClick={() => onOpenApplications('OA')}
        />
        <KpiCard
          className={kpiClass}
          compact
          tone="interview"
          label="Interview"
          value={stats.interviews}
          rate={formatRate(stats.interviewRate)}
          onClick={() => onOpenApplications('Interview')}
        />
        <KpiCard
          className={kpiClass}
          compact
          tone="offer"
          label="Offer"
          value={stats.offers}
          rate={formatRate(stats.offerRate)}
          onClick={() => onOpenApplications('Offer')}
        />
        <KpiCard
          className={kpiClass}
          compact
          tone="reject"
          label="Rejected"
          value={stats.rejections}
          rate={formatRate(stats.rejectionRate)}
          onClick={() => onOpenApplications('Rejected')}
        />
      </div>

      <div className="flex flex-col gap-3 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-12 lg:gap-2">
        <div className="lg:col-span-4 lg:min-h-0">
          <OaCard
            applications={data.applications}
            onOpenAll={() => onOpenApplications('OA')}
            onSelectApplication={setDetailApp}
          />
        </div>
        <div className="lg:col-span-5 lg:min-h-0">
          <StatusFunnel
            applications={data.applications}
            fill
            onSelectStage={onOpenApplications}
          />
        </div>
        <div className="lg:col-span-3 lg:min-h-0">
          <RecentUpdates
            applications={data.applications}
            limit={8}
            onSelectApplication={setDetailApp}
          />
        </div>
      </div>
    </div>
  )
}
