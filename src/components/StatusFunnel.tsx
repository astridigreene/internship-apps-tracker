import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Application } from '../types'

interface StatusFunnelProps {
  applications: Application[]
}

const STAGES = ['Applied', 'OA', 'Interview', 'Offer'] as const

export function StatusFunnel({ applications }: StatusFunnelProps) {
  const counts: Record<(typeof STAGES)[number], number> = {
    Applied: 0,
    OA: 0,
    Interview: 0,
    Offer: 0,
  }

  for (const app of applications) {
    if (app.status in counts) {
      counts[app.status as (typeof STAGES)[number]] += 1
    }
  }

  // Cumulative: everyone who reached at least this stage (offer counts toward interview, OA, applied)
  const chartData = [
    {
      stage: 'Applied',
      count: counts.Applied + counts.OA + counts.Interview + counts.Offer,
    },
    {
      stage: 'OA',
      count: counts.OA + counts.Interview + counts.Offer,
    },
    {
      stage: 'Interview',
      count: counts.Interview + counts.Offer,
    },
    {
      stage: 'Offer',
      count: counts.Offer,
    },
  ]

  return (
    <div className="rounded-[2px] border border-slds-border bg-slds-surface">
      <div className="border-b border-slds-border px-4 py-3">
        <h2 className="text-sm font-bold text-slds-text">Status Funnel</h2>
        <p className="mt-0.5 text-xs text-slds-text-weak">
          Cumulative reach: Applied → OA → Interview → Offer (excludes Rejected)
        </p>
      </div>
      <div className="h-64 px-2 py-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            barCategoryGap="28%"
          >
            <CartesianGrid stroke="#dddbda" strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="stage"
              tick={{ fill: '#706e6b', fontSize: 12 }}
              axisLine={{ stroke: '#dddbda' }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: '#706e6b', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              cursor={{ fill: '#f3f2f2' }}
              contentStyle={{
                border: '1px solid #dddbda',
                borderRadius: 2,
                fontSize: 12,
                boxShadow: 'none',
              }}
              formatter={(value, _name, item) => {
                const stage = String(item?.payload?.stage ?? '') as (typeof STAGES)[number]
                const current = counts[stage] ?? 0
                return [
                  `${value as number} reached · ${current} currently here`,
                  'Count',
                ]
              }}
            />
            <Bar dataKey="count" fill="#0176d3" radius={[2, 2, 0, 0]} maxBarSize={64} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-4 gap-px border-t border-slds-border bg-slds-border">
        {STAGES.map((stage) => (
          <div key={stage} className="bg-slds-surface px-3 py-2 text-center">
            <p className="text-[11px] font-bold tracking-wider text-slds-text-weak uppercase">
              {stage}
            </p>
            <p className="text-sm font-semibold text-slds-text tabular-nums">
              {counts[stage]}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
