import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Application } from '../types'
import { isRejectedStatus } from '../types'
import type { ApplicationsStatusFilter } from '../views/ApplicationsView'

interface StatusFunnelProps {
  applications: Application[]
  fill?: boolean
  onSelectStage?: (filter: ApplicationsStatusFilter) => void
}

const STAGES = ['OA', 'Interview', 'Offer', 'Rejected'] as const

type Stage = (typeof STAGES)[number]

function stageToFilter(stage: Stage): ApplicationsStatusFilter {
  return stage
}

const STAGE_COLORS_LIGHT: Record<Stage, string> = {
  OA: '#3b82f6',
  Interview: '#f97316',
  Offer: '#10b981',
  Rejected: '#f43f5e',
}

const STAGE_COLORS_DARK: Record<Stage, string> = {
  OA: '#60a5fa',
  Interview: '#fb923c',
  Offer: '#34d399',
  Rejected: '#fb7185',
}

const STAGE_FOOTER: Record<Stage, string> = {
  OA: 'bg-status-oa-bg text-status-oa-text',
  Interview: 'bg-status-interview-bg text-status-interview-text',
  Offer: 'bg-status-offer-bg text-status-offer-text',
  Rejected: 'bg-status-rejected-bg text-status-rejected-text',
}

function usePrefersDark() {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setDark(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return dark
}

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') {
    return fallback
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

export function StatusFunnel({ applications, fill, onSelectStage }: StatusFunnelProps) {
  const dark = usePrefersDark()
  const stageColors = dark ? STAGE_COLORS_DARK : STAGE_COLORS_LIGHT

  const current = {
    OA: 0,
    Interview: 0,
    Offer: 0,
    Rejected: 0,
  }

  for (const app of applications) {
    if (isRejectedStatus(app.status)) {
      current.Rejected += 1
      continue
    }
    if (app.status in current) {
      current[app.status as keyof typeof current] += 1
    }
  }

  const chartData = STAGES.map((stage) => ({
    stage,
    count: current[stage],
  }))

  function selectStage(stage: Stage) {
    onSelectStage?.(stageToFilter(stage))
  }

  const grid = cssVar('--color-chart-grid', '#d5e4ea')
  const tick = cssVar('--color-chart-tick', '#5b7c86')
  const cursor = cssVar('--color-chart-cursor', '#f0fdfa')
  const tooltipBorder = cssVar('--color-chart-tooltip-border', '#99f6e4')
  const surface = cssVar('--color-app-surface', '#fff')
  const text = cssVar('--color-app-text', '#134e4a')

  return (
    <div
      className={[
        'flex min-h-0 flex-col overflow-hidden rounded-md border border-panel-border bg-app-surface',
        fill ? 'h-full' : '',
      ].join(' ')}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-app-border bg-app-muted px-2.5 py-1.5">
        <h2 className="text-[12px] font-semibold text-panel-title">Pipeline</h2>
        <p className="text-[10px] text-panel-sub/80">
          {onSelectStage ? 'Click a bar to filter' : 'Current status counts'}
        </p>
      </div>
      <div className={fill ? 'min-h-0 flex-1 px-1.5 py-2' : 'h-44 px-2 py-3'}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
            barCategoryGap="28%"
          >
            <CartesianGrid stroke={grid} strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="stage"
              tick={{ fill: tick, fontSize: 12 }}
              axisLine={{ stroke: grid }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: tick, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={22}
            />
            <Tooltip
              cursor={{ fill: cursor }}
              contentStyle={{
                background: surface,
                color: text,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: 6,
                fontSize: 12,
                boxShadow: 'none',
                padding: '6px 8px',
              }}
              formatter={(value, _name, item) => {
                const stage = String(item?.payload?.stage ?? '')
                return [`${value as number} current`, stage]
              }}
            />
            <Bar
              dataKey="count"
              radius={[3, 3, 0, 0]}
              maxBarSize={56}
              cursor={onSelectStage ? 'pointer' : undefined}
              onClick={(item) => {
                const stage = (item as { payload?: { stage?: Stage } })?.payload?.stage
                if (stage && STAGES.includes(stage)) {
                  selectStage(stage)
                }
              }}
            >
              {chartData.map((entry) => (
                <Cell key={entry.stage} fill={stageColors[entry.stage]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid shrink-0 grid-cols-4 gap-px border-t border-app-border bg-app-border">
        {STAGES.map((stage) => (
          <button
            key={stage}
            type="button"
            onClick={() => selectStage(stage)}
            disabled={!onSelectStage}
            className={`px-1.5 py-1 text-center ${STAGE_FOOTER[stage]} disabled:cursor-default`}
          >
            <p className="text-[9px] font-semibold tracking-[0.06em] uppercase opacity-80">
              {stage}
            </p>
            <p className="text-[12px] font-bold tabular-nums">{current[stage]}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
