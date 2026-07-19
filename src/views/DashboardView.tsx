import { useMemo } from 'react'
import type { TrackerData } from '../types'
import { KpiCard } from '../components/KpiCard'
import { StatusFunnel } from '../components/StatusFunnel'
import { RecentUpdates } from '../components/RecentUpdates'
import { OaCard } from '../components/OaCard'
import { computeStats } from '../lib/sheet'
import type { ApplicationsStatusFilter } from './ApplicationsView'

interface DashboardViewProps {
  data: TrackerData
  onOpenApplications: (filter: ApplicationsStatusFilter) => void
}

function formatRate(rate: number): string {
  return `${rate.toFixed(1)}%`
}

export function DashboardView({ data, onOpenApplications }: DashboardViewProps) {
  const stats = useMemo(() => computeStats(data.applications), [data.applications])

  return (
    <div className="flex min-h-0 flex-col gap-2 lg:h-full">
      <div className="grid shrink-0 grid-cols-5 gap-2">
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
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 max-lg:auto-rows-[180px] lg:grid-cols-12">
        <div className="min-h-0 lg:col-span-4">
          <OaCard
            applications={data.applications}
            onOpenAll={() => onOpenApplications('OA')}
          />
        </div>
        <div className="min-h-0 lg:col-span-5">
          <StatusFunnel applications={data.applications} fill />
        </div>
        <div className="min-h-0 lg:col-span-3">
          <RecentUpdates applications={data.applications} limit={5} />
        </div>
      </div>
    </div>
  )
}
