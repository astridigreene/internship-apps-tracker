import type { TrackerData } from '../types'
import { KpiCard } from '../components/KpiCard'
import { StatusFunnel } from '../components/StatusFunnel'

interface DashboardViewProps {
  data: TrackerData
}

function formatRate(rate: number): string {
  return rate.toFixed(1)
}

export function DashboardView({ data }: DashboardViewProps) {
  const { stats, applications } = data

  const interviewRate =
    stats.interviewRate ??
    (stats.totalApplications === 0
      ? 0
      : Math.round((stats.interviews / stats.totalApplications) * 1000) / 10)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <section>
        <h2 className="mb-2 text-[11px] font-bold tracking-wider text-slds-text-weak uppercase">
          Volume
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard label="Total Applications" value={stats.totalApplications} />
          <KpiCard label="# OAs" value={stats.oas} />
          <KpiCard label="# Interviews" value={stats.interviews} />
          <KpiCard label="# Offers" value={stats.offers} />
          <KpiCard label="# Rejections" value={stats.rejections} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-bold tracking-wider text-slds-text-weak uppercase">
          Rates
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="OA Rate" value={formatRate(stats.oaRate)} suffix="%" />
          <KpiCard label="Interview Rate" value={formatRate(interviewRate)} suffix="%" />
          <KpiCard label="Offer Rate" value={formatRate(stats.offerRate)} suffix="%" />
          <KpiCard
            label="Rejection Rate"
            value={formatRate(stats.rejectionRate)}
            suffix="%"
          />
        </div>
      </section>

      <section>
        <StatusFunnel applications={applications} />
      </section>
    </div>
  )
}
