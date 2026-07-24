import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Application } from '../types'
import {
  calendarDaysBetween,
  endOfMonth,
  formatDisplayDate,
  parseSheetDate,
  startOfDay,
  startOfMonth,
  toDateInputValue,
} from '../lib/time'

interface AppsPerDayChartProps {
  applications: Application[]
}

type DayPoint = {
  key: string
  label: string
  actual: number | null
  projected: number | null
  isFuture: boolean
}

type PaceVerdict = 'crushing' | 'onTrack' | 'behind' | 'slacking'

const GOAL_MIN = 1
const GOAL_TARGET = 2

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

function eachDayInclusive(from: Date, to: Date): Date[] {
  const days: Date[] = []
  const cursor = startOfDay(from)
  const end = startOfDay(to)
  if (cursor.getTime() > end.getTime()) {
    return days
  }
  while (cursor.getTime() <= end.getTime()) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function shortDayLabel(date: Date, withYear: boolean): string {
  if (withYear) {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    })
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function countByDayKey(applications: Application[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const app of applications) {
    const date = parseSheetDate(app.dateApplied)
    if (!date) {
      continue
    }
    const key = toDateInputValue(date)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/** Daily counts for elapsed days in the selected range (through today). */
function elapsedSeries(
  counts: Map<string, number>,
  rangeStart: Date,
  rangeEnd: Date,
  today: Date,
): number[] {
  const from = startOfDay(rangeStart)
  const lastElapsed = new Date(Math.min(startOfDay(rangeEnd).getTime(), startOfDay(today).getTime()))
  if (from.getTime() > lastElapsed.getTime()) {
    return []
  }

  const values: number[] = []
  const cursor = new Date(from)
  while (cursor.getTime() <= lastElapsed.getTime()) {
    values.push(counts.get(toDateInputValue(cursor)) ?? 0)
    cursor.setDate(cursor.getDate() + 1)
  }
  return values
}

type TrendDirection = 'up' | 'down' | 'flat'

type RangeTrend = {
  /** Apps/day change per day from linear fit over the range so far. */
  slope: number
  /** Fitted value on the last elapsed day (anchor for the future path). */
  lastFitted: number
  direction: TrendDirection
  sampleDays: number
}

/**
 * Linear regression over daily counts.
 * Positive slope = trending up, negative = down.
 * For long series, fit only the recent window so early zeros don't flatten the trend.
 */
function computeRangeTrend(series: number[]): RangeTrend | null {
  const TREND_WINDOW = 28
  const windowed =
    series.length > TREND_WINDOW ? series.slice(series.length - TREND_WINDOW) : series
  const n = windowed.length
  if (n < 2) {
    return null
  }

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (let i = 0; i < n; i += 1) {
    const y = windowed[i]!
    sumX += i
    sumY += y
    sumXY += i * y
    sumXX += i * i
  }

  const denom = n * sumXX - sumX * sumX
  if (denom === 0) {
    return null
  }

  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  const lastFitted = intercept + slope * (n - 1)

  // Ignore tiny wobble — less than ~0.05 apps/day of drift reads as flat.
  const direction: TrendDirection =
    slope > 0.05 ? 'up' : slope < -0.05 ? 'down' : 'flat'

  return {
    slope,
    lastFitted: Math.max(0, lastFitted),
    direction,
    sampleDays: n,
  }
}

function projectFromTrend(trend: RangeTrend, daysAheadFromToday: number): number {
  // daysAheadFromToday: 0 = today (anchor), 1 = tomorrow, …
  const raw = trend.lastFitted + trend.slope * daysAheadFromToday
  return Math.max(0, Math.round(raw * 10) / 10)
}

function trendLabel(direction: TrendDirection): string {
  if (direction === 'up') {
    return 'trending up'
  }
  if (direction === 'down') {
    return 'trending down'
  }
  return 'holding flat'
}

function buildRecommendation(args: {
  avgSoFar: number
  totalSoFar: number
  daysElapsed: number
  daysRemaining: number
  zeroStreak: number
  todayCount: number
}): { verdict: PaceVerdict; headline: string; detail: string } {
  const { avgSoFar, totalSoFar, daysElapsed, daysRemaining, zeroStreak, todayCount } = args
  const neededForFloor = Math.max(0, Math.ceil(GOAL_MIN * (daysElapsed + daysRemaining) - totalSoFar))
  const neededPerDay =
    daysRemaining > 0 ? neededForFloor / daysRemaining : neededForFloor > 0 ? Infinity : 0

  if (daysElapsed === 0) {
    return {
      verdict: 'onTrack',
      headline: 'Range starts today',
      detail: `Hit at least ${GOAL_MIN}–${GOAL_TARGET} apps today to stay on the floor.`,
    }
  }

  if (zeroStreak >= 3 && avgSoFar < GOAL_MIN) {
    return {
      verdict: 'slacking',
      headline: `${zeroStreak} days with zero apps`,
      detail:
        neededForFloor > 0
          ? `That's a dry spell. You need ~${neededPerDay.toFixed(1)}/day for the rest of this range just to salvage a 1/day average.`
          : 'Open the sheet and send something before the day ends.',
    }
  }

  if (avgSoFar >= GOAL_TARGET) {
    return {
      verdict: 'crushing',
      headline: `${avgSoFar.toFixed(1)}/day — above the bar`,
      detail:
        todayCount === 0 && daysRemaining >= 0
          ? `Strong pace. Still worth landing ${GOAL_MIN}+ today so the streak doesn't break.`
          : `You're clearing the ${GOAL_TARGET}/day target. Keep the machine fed.`,
    }
  }

  if (avgSoFar >= GOAL_MIN) {
    return {
      verdict: 'onTrack',
      headline: `${avgSoFar.toFixed(1)}/day — on the floor`,
      detail:
        todayCount === 0
          ? `Floor held so far. One more today keeps you honest.`
          : `Solid. Push toward ${GOAL_TARGET}/day when you have bandwidth.`,
    }
  }

  if (avgSoFar > 0) {
    return {
      verdict: 'behind',
      headline: `${avgSoFar.toFixed(1)}/day — below 1/day`,
      detail:
        daysRemaining > 0 && neededForFloor > 0
          ? `Behind the minimum. About ${neededPerDay.toFixed(1)} apps/day for the remaining ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} to hit a 1/day average.`
          : `Finished this range under the floor (${totalSoFar} apps across ${daysElapsed} days).`,
    }
  }

  return {
    verdict: 'slacking',
    headline: 'Zero apps in this range',
    detail:
      daysRemaining > 0
        ? `Nothing logged. You need ${GOAL_MIN}–${GOAL_TARGET} today just to start existing on the chart.`
        : 'Empty range. Either widen the dates or apply to something.',
  }
}

const VERDICT_CLASS: Record<PaceVerdict, string> = {
  crushing: 'border-kpi-offer-border bg-kpi-offer-bg text-kpi-offer-text',
  onTrack: 'border-kpi-applied-border bg-kpi-applied-bg text-kpi-applied-text',
  behind: 'border-kpi-interview-border bg-kpi-interview-bg text-kpi-interview-text',
  slacking: 'border-kpi-reject-border bg-kpi-reject-bg text-kpi-reject-text',
}

const fieldClass =
  'h-7 w-[6.5rem] rounded-md border border-app-border bg-app-surface px-2 text-[12px] text-app-text tabular-nums placeholder:text-app-text-weak/50 focus:border-app-brand focus:outline-none lg:h-6 lg:text-[11px]'

const chipClass =
  'h-7 rounded-md border border-app-border bg-app-surface px-2 text-[11px] font-medium text-app-text hover:bg-app-hover lg:h-6 lg:text-[10px]'

/** Typeable date field (M/D/YYYY or YYYY-MM-DD) with a separate calendar control. */
function TypedDateField({
  label,
  value,
  onChange,
}: {
  label: string
  /** Canonical YYYY-MM-DD */
  value: string
  onChange: (iso: string) => void
}) {
  const [draft, setDraft] = useState(() => formatDisplayDate(value))
  const [invalid, setInvalid] = useState(false)
  const pickerRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(formatDisplayDate(value))
    setInvalid(false)
  }, [value])

  function commit(raw: string) {
    const parsed = parseSheetDate(raw.trim())
    if (!parsed) {
      setInvalid(true)
      setDraft(formatDisplayDate(value))
      return
    }
    setInvalid(false)
    const next = toDateInputValue(parsed)
    setDraft(formatDisplayDate(parsed))
    if (next !== value) {
      onChange(next)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] font-medium tracking-wide text-app-text-weak uppercase">
        {label}
      </span>
      <div className="flex items-center gap-0.5">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          placeholder="M/D/YYYY"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setInvalid(false)
          }}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit(draft)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          aria-invalid={invalid}
          aria-label={label}
          title="Type M/D/YYYY or YYYY-MM-DD"
          className={[fieldClass, invalid ? 'border-kpi-reject-border text-kpi-reject-text' : ''].join(
            ' ',
          )}
        />
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-app-border bg-app-surface text-app-text-weak hover:bg-app-hover lg:h-6 lg:w-6"
          title={`Pick ${label.toLowerCase()} date`}
          aria-label={`${label} calendar`}
          onClick={() => {
            const el = pickerRef.current
            if (!el) {
              return
            }
            if (typeof el.showPicker === 'function') {
              el.showPicker()
            } else {
              el.click()
            }
          }}
        >
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="2" y="3.5" width="12" height="10.5" rx="1.5" />
            <path d="M2 6.5h12M5 2v3M11 2v3" />
          </svg>
        </button>
        <input
          ref={pickerRef}
          type="date"
          value={value}
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.value) {
              onChange(e.target.value)
            }
          }}
          className="sr-only"
          aria-hidden
        />
      </div>
    </div>
  )
}

export function AppsPerDayChart({ applications }: AppsPerDayChartProps) {
  const dark = usePrefersDark()
  const today = useMemo(() => startOfDay(new Date()), [])
  const [rangeFrom, setRangeFrom] = useState(() => toDateInputValue(startOfMonth(today)))
  const [rangeTo, setRangeTo] = useState(() => toDateInputValue(endOfMonth(today)))
  const [showProjection, setShowProjection] = useState(false)
  /** Extra calendar days past today available to scroll into while projecting. */
  const [futureExtraDays, setFutureExtraDays] = useState(60)
  const [centerNonce, setCenterNonce] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const extendingRef = useRef(false)
  const chartDataRef = useRef<DayPoint[]>([])

  const counts = useMemo(() => countByDayKey(applications), [applications])

  const { chartData, stats, recommendation, trend, canProject, rangeValid } = useMemo(() => {
    const fromDate = startOfDay(rangeFrom)
    const toDate = startOfDay(rangeTo)
    if (fromDate.getTime() > toDate.getTime()) {
      return {
        chartData: [] as DayPoint[],
        stats: null,
        recommendation: null,
        trend: null as RangeTrend | null,
        canProject: false,
        rangeValid: false,
      }
    }

    // Trend + pace stats use the user-selected range only.
    const series = elapsedSeries(counts, fromDate, toDate, today)
    const rangeTrend = computeRangeTrend(series)

    // Chart span: selected range, and when projecting, continue past today indefinitely.
    const chartEnd = showProjection
      ? (() => {
          const horizon = new Date(today)
          horizon.setDate(horizon.getDate() + futureExtraDays)
          return new Date(Math.max(toDate.getTime(), horizon.getTime()))
        })()
      : toDate

    const days = eachDayInclusive(fromDate, chartEnd)
    const withYear =
      days.length > 60 ||
      (days.length > 0 && days[0]!.getFullYear() !== days[days.length - 1]!.getFullYear())

    const todayIndex = days.findIndex((d) => d.getTime() === today.getTime())
    const points: DayPoint[] = days.map((day, index) => {
      const key = toDateInputValue(day)
      const isFuture = day.getTime() > today.getTime()
      const isTodayOrFuture = day.getTime() >= today.getTime()
      let projected: number | null = null
      if (showProjection && rangeTrend != null && isTodayOrFuture) {
        const daysAhead =
          todayIndex >= 0 ? index - todayIndex : calendarDaysBetween(today, day)
        projected = projectFromTrend(rangeTrend, Math.max(0, daysAhead))
      }
      return {
        key,
        label: shortDayLabel(day, withYear),
        actual: isFuture ? null : (counts.get(key) ?? 0),
        projected,
        isFuture,
      }
    })

    const selectedDays = eachDayInclusive(fromDate, toDate)
    const elapsedDays = selectedDays.filter((d) => d.getTime() <= today.getTime())
    const remainingInRange = selectedDays.filter((d) => d.getTime() > today.getTime())
    let totalSoFar = 0
    for (const day of elapsedDays) {
      totalSoFar += counts.get(toDateInputValue(day)) ?? 0
    }

    let zeroStreak = 0
    for (let i = elapsedDays.length - 1; i >= 0; i -= 1) {
      const count = counts.get(toDateInputValue(elapsedDays[i]!)) ?? 0
      if (count === 0) {
        zeroStreak += 1
      } else {
        break
      }
    }

    const daysElapsed = elapsedDays.length
    const avgSoFar = daysElapsed > 0 ? totalSoFar / daysElapsed : 0
    const todayCount = counts.get(toDateInputValue(today)) ?? 0
    const rec = buildRecommendation({
      avgSoFar,
      totalSoFar,
      daysElapsed,
      daysRemaining: remainingInRange.length,
      zeroStreak,
      todayCount,
    })

    return {
      chartData: points,
      stats: {
        totalSoFar,
        avgSoFar,
        daysElapsed,
        daysRemaining: remainingInRange.length,
        todayCount,
      },
      recommendation: rec,
      trend: rangeTrend,
      canProject: rangeTrend != null,
      rangeValid: true,
    }
  }, [counts, rangeFrom, rangeTo, showProjection, futureExtraDays, today])

  chartDataRef.current = chartData

  function setThisMonth() {
    setRangeFrom(toDateInputValue(startOfMonth(today)))
    setRangeTo(toDateInputValue(endOfMonth(today)))
    if (showProjection) {
      setCenterNonce((n) => n + 1)
    }
  }

  function setLastNDays(n: number) {
    const start = new Date(today)
    start.setDate(start.getDate() - (n - 1))
    setRangeFrom(toDateInputValue(start))
    setRangeTo(toDateInputValue(today))
    if (showProjection) {
      setCenterNonce((n) => n + 1)
    }
  }

  function handleProjectionToggle(checked: boolean) {
    setShowProjection(checked)
    if (checked) {
      setFutureExtraDays(60)
      setCenterNonce((n) => n + 1)
    }
  }

  useEffect(() => {
    if (!showProjection || centerNonce === 0) {
      return
    }
    const el = scrollRef.current
    if (!el || chartDataRef.current.length === 0) {
      return
    }
    const todayKey = toDateInputValue(today)
    const id = requestAnimationFrame(() => {
      const latest = chartDataRef.current
      const idx = latest.findIndex((p) => p.key === todayKey)
      if (idx < 0) {
        el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth)
        return
      }
      const px = el.scrollWidth / Math.max(latest.length, 1)
      el.scrollLeft = Math.max(0, idx * px - el.clientWidth * 0.35)
    })
    return () => cancelAnimationFrame(id)
  }, [centerNonce, showProjection, today])

  function onRangeFromChange(next: string) {
    setRangeFrom(next)
    if (showProjection) {
      setCenterNonce((n) => n + 1)
    }
  }

  function onRangeToChange(next: string) {
    setRangeTo(next)
    if (showProjection) {
      setCenterNonce((n) => n + 1)
    }
  }

  function handleChartScroll() {
    if (!showProjection) {
      return
    }
    const el = scrollRef.current
    if (!el || extendingRef.current) {
      return
    }
    const remaining = el.scrollWidth - el.scrollLeft - el.clientWidth
    if (remaining < 240) {
      extendingRef.current = true
      const prevScrollLeft = el.scrollLeft
      setFutureExtraDays((days) => days + 45)
      // Keep the viewport stable while the canvas grows to the right.
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollLeft = prevScrollLeft
        }
        extendingRef.current = false
      })
    }
  }

  const grid = cssVar('--color-chart-grid', '#d5e4ea')
  const tick = cssVar('--color-chart-tick', '#5b7c86')
  const surface = cssVar('--color-app-surface', '#fff')
  const text = cssVar('--color-app-text', '#134e4a')
  const tooltipBorder = cssVar('--color-chart-tooltip-border', '#99f6e4')
  const brand = cssVar('--color-app-brand', '#0d9488')
  const projectedStroke = dark ? '#94b8bd' : '#5b7c86'
  const goalStroke = dark ? '#fb923c' : '#f97316'

  // Sparse ticks: weekly while projecting (scrollable), ~7 labels when fitted.
  const xTickStep = showProjection
    ? 7
    : Math.max(1, Math.ceil(chartData.length / 7))
  const xTickKeys = chartData
    .filter((_, i) => i === 0 || i === chartData.length - 1 || i % xTickStep === 0)
    .map((p) => p.key)
  const labelByKey = new Map(chartData.map((p) => [p.key, p.label]))

  const showDots = chartData.length <= 40 && !showProjection
  const yTickCount = 5
  const pxPerDay = showProjection ? 28 : null
  const scrollWidth =
    pxPerDay != null ? Math.max(pxPerDay * chartData.length, pxPerDay * 14) : undefined

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-panel-border bg-app-surface">
      <div className="flex shrink-0 flex-col gap-2 border-b border-app-border bg-app-muted px-3 py-2.5 lg:px-2.5 lg:py-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[14px] font-bold text-panel-title lg:text-[12px] lg:font-semibold">
              Apps per day
            </h2>
            <p className="text-[11px] text-panel-sub/80 lg:text-[10px]">
              Goal {GOAL_MIN}–{GOAL_TARGET} / day
              {showProjection ? ' · scroll right for more future' : ''}
            </p>
          </div>
          <label
            className={[
              'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] lg:text-[10px]',
              canProject || showProjection
                ? 'cursor-pointer border-app-border bg-app-surface text-app-text'
                : 'cursor-not-allowed border-app-border/60 bg-app-surface/60 text-app-text-weak',
            ].join(' ')}
            title={
              canProject
                ? 'Project recent trend into the future — scroll right for more days'
                : 'Need at least 2 days of data in this range'
            }
          >
            <input
              type="checkbox"
              checked={showProjection}
              onChange={(e) => handleProjectionToggle(e.target.checked)}
              disabled={!canProject && !showProjection}
              className="accent-app-brand"
            />
            Projection
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="flex items-center gap-1">
            <button type="button" onClick={setThisMonth} className={chipClass}>
              This month
            </button>
            <button type="button" onClick={() => setLastNDays(7)} className={chipClass}>
              7d
            </button>
            <button type="button" onClick={() => setLastNDays(30)} className={chipClass}>
              30d
            </button>
          </div>
          <div className="hidden h-4 w-px bg-app-border sm:block" />
          <div className="flex flex-wrap items-center gap-2">
            <TypedDateField label="From" value={rangeFrom} onChange={onRangeFromChange} />
            <TypedDateField label="To" value={rangeTo} onChange={onRangeToChange} />
          </div>
        </div>
      </div>

      {recommendation && stats ? (
        <div
          className={`mx-3 mt-2 rounded-md border px-2.5 py-1.5 lg:mx-2.5 ${VERDICT_CLASS[recommendation.verdict]}`}
        >
          <p className="text-[12px] font-semibold lg:text-[11px]">{recommendation.headline}</p>
          <p className="mt-0.5 text-[11px] leading-snug opacity-90 lg:text-[10px]">
            {recommendation.detail}
          </p>
          <p className="mt-1 text-[10px] tabular-nums opacity-70 lg:text-[9px]">
            {stats.totalSoFar} apps · {stats.avgSoFar.toFixed(2)}/day avg
            {showProjection && trend != null
              ? ` · ${trendLabel(trend.direction)} (${trend.slope >= 0 ? '+' : ''}${trend.slope.toFixed(2)}/day over last ${trend.sampleDays}d)`
              : ''}
          </p>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        onScroll={handleChartScroll}
        className={[
          'h-56 px-2 pt-2 pb-3 lg:h-52 lg:px-1.5 lg:pb-2',
          showProjection ? 'overflow-x-auto overscroll-x-contain' : 'overflow-hidden',
        ].join(' ')}
      >
        {!rangeValid ? (
          <p className="flex h-full items-center justify-center text-[12px] text-app-text-weak">
            From date must be on or before To date.
          </p>
        ) : (
          <div
            className="h-full"
            style={scrollWidth != null ? { width: scrollWidth, minWidth: '100%' } : { width: '100%' }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={grid} strokeDasharray="0" vertical={false} />
                <XAxis
                  dataKey="key"
                  ticks={xTickKeys}
                  tickFormatter={(key) => labelByKey.get(String(key)) ?? String(key)}
                  tick={{ fill: tick, fontSize: 10 }}
                  axisLine={{ stroke: grid }}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={36}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: tick, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                  tickCount={yTickCount}
                  domain={[0, (dataMax: number) => Math.max(GOAL_TARGET, dataMax || 0) + 1]}
                />
                <Tooltip
                  contentStyle={{
                    background: surface,
                    color: text,
                    border: `1px solid ${tooltipBorder}`,
                    borderRadius: 6,
                    fontSize: 12,
                    boxShadow: 'none',
                    padding: '6px 8px',
                  }}
                  formatter={(value, name) => {
                    const n = typeof value === 'number' ? value : Number(value)
                    const seriesName =
                      name === 'projected' ? 'Projected (trend)' : 'Applications'
                    return [Number.isFinite(n) ? n : '—', seriesName]
                  }}
                  labelFormatter={(key) => labelByKey.get(String(key)) ?? String(key)}
                />
                <Legend
                  verticalAlign="top"
                  height={20}
                  iconType="plainline"
                  wrapperStyle={{ fontSize: 10, color: tick }}
                />
                <ReferenceLine
                  y={GOAL_MIN}
                  stroke={goalStroke}
                  strokeDasharray="4 4"
                  strokeOpacity={0.55}
                />
                <ReferenceLine
                  y={GOAL_TARGET}
                  stroke={goalStroke}
                  strokeDasharray="2 4"
                  strokeOpacity={0.35}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Applied"
                  stroke={brand}
                  strokeWidth={2}
                  dot={showDots ? { r: 2, fill: brand, strokeWidth: 0 } : false}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                {showProjection && trend != null ? (
                  <Line
                    type="monotone"
                    dataKey="projected"
                    name="Projected"
                    stroke={projectedStroke}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ) : null}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
