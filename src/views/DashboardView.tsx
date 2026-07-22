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

  return (
    <div className="flex min-h-0 flex-col gap-2 lg:h-full">
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

      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        <KpiCard
          compact
          tone="applied"
          label="Applied"
          value={stats.totalApplications}
          onClick={() => onOpenApplications('All')}
        />
        <KpiCard
          compact
          tone="oa"
          label="OA"
          value={stats.oas}
          rate={formatRate(stats.oaRate)}
          onClick={() => onOpenApplications('OA')}
        />
        <KpiCard
          compact
          tone="interview"
          label="Interview"
          value={stats.interviews}
          rate={formatRate(stats.interviewRate)}
          onClick={() => onOpenApplications('Interview')}
        />
        <KpiCard
          compact
          tone="offer"
          label="Offer"
          value={stats.offers}
          rate={formatRate(stats.offerRate)}
          onClick={() => onOpenApplications('Offer')}
        />
        <KpiCard
          compact
          tone="reject"
          label="Rejected"
          value={stats.rejections}
          rate={formatRate(stats.rejectionRate)}
          onClick={() => onOpenApplications('Rejected')}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 max-lg:auto-rows-[min(220px,40vh)] lg:grid-cols-12">
        <div className="min-h-0 max-lg:min-h-[200px] lg:col-span-4">
          <OaCard
            applications={data.applications}
            onOpenAll={() => onOpenApplications('OA')}
            onSelectApplication={setDetailApp}
          />
        </div>
        <div className="min-h-0 max-lg:min-h-[220px] lg:col-span-5">
          <StatusFunnel
            applications={data.applications}
            fill
            onSelectStage={onOpenApplications}
          />
        </div>
        <div className="min-h-0 max-lg:min-h-[200px] lg:col-span-3">
          <RecentUpdates
            applications={data.applications}
            onSelectApplication={setDetailApp}
          />
        </div>
      </div>
    </div>
  )
}
