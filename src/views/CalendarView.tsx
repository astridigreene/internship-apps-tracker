import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { Application, ApplicationStatus, AssessmentEntry, LinkedActions, TrackerData } from '../types'
import { ApplicationDetailModal } from '../components/ApplicationDetailModal'
import { assessmentFormFromEntry } from '../lib/assessmentForm'
import { SearchSelect, type SearchSelectOption } from '../components/SearchSelect'
import { linkedApplicationFor, linkedEntriesForApplication } from '../lib/sheet'
import {
  endMoment,
  formatDisplayDateTime,
  formatTimeOfDay,
  hasMeetingEnded,
  isExpired,
  isSameDay,
  parseSheetDate,
  startOfDay,
  startOfMonth,
  toDateInputValue,
} from '../lib/time'
import type { StatusEditChange } from './ApplicationsView'

interface CalendarViewProps {
  data: TrackerData
  saving?: boolean
  onSaveStatusChanges?: (changes: StatusEditChange[]) => Promise<void>
  linkedActions?: LinkedActions
}

type EventType = 'interview' | 'screening' | 'deadline' | 'scheduled'

interface CalendarItem {
  key: string
  type: EventType
  /** e.g. "OA due", "Do HireVue", "Interview" */
  label: string
  company: string
  start: Date
  end: Date | null
  /** No time of day was set (bare-date deadline) — shown as all-day. */
  allDay: boolean
  done: boolean
  app: Application | undefined
}

const TYPE_STYLES: Record<EventType, { chip: string; dot: string; name: string }> = {
  interview: {
    chip: 'bg-kpi-interview-bg text-kpi-interview-text border-kpi-interview-border',
    dot: 'bg-kpi-interview-text',
    name: 'Interview',
  },
  screening: {
    chip: 'bg-kpi-applied-bg text-kpi-applied-text border-kpi-applied-border',
    dot: 'bg-kpi-applied-text',
    name: 'Screening',
  },
  deadline: {
    chip: 'bg-kpi-reject-bg text-kpi-reject-text border-kpi-reject-border',
    dot: 'bg-kpi-reject-text',
    name: 'OA/HireVue deadline',
  },
  scheduled: {
    chip: 'bg-kpi-oa-bg text-kpi-oa-text border-kpi-oa-border',
    dot: 'bg-kpi-oa-text',
    name: 'Scheduled OA/HireVue',
  },
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Day-cell geometry (px), matching the classes below: p-1 + border-b + h-5 day number + gap-0.5
const CELL_CHROME = 4 + 4 + 1 + 20 + 2
const CHIP_HEIGHT = 18 // leading-4 + 1px border top and bottom
const CHIP_GAP = 2
const MORE_LINE = 12 // leading-3
/** Chips shown when cells grow to fit their content (below lg) — keeps busy weeks from towering. */
const MAX_UNCONSTRAINED_CHIPS = 3

/**
 * How many chips to draw in a day cell, leaving room for "+N more" when some
 * are hidden. `space` is the px a cell has for chips, or null when cells grow to fit.
 */
function visibleChipCount(total: number, space: number | null): number {
  if (space === null) {
    return total <= MAX_UNCONSTRAINED_CHIPS ? total : MAX_UNCONSTRAINED_CHIPS
  }
  const slot = CHIP_HEIGHT + CHIP_GAP
  if (total <= Math.floor((space + CHIP_GAP) / slot)) {
    return total
  }
  return Math.max(0, Math.floor((space - MORE_LINE) / slot))
}

function hasTimeOfDay(date: Date): boolean {
  return date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0
}

function timeLabel(item: CalendarItem): string {
  if (item.allDay) return 'All day'
  const start = formatTimeOfDay(item.start.getHours() * 60 + item.start.getMinutes())
  if (!item.end) return start
  return `${start} – ${formatTimeOfDay(item.end.getHours() * 60 + item.end.getMinutes())}`
}

function shortTime(item: CalendarItem): string {
  if (item.allDay) return ''
  return formatTimeOfDay(item.start.getHours() * 60 + item.start.getMinutes()).replace(':00', '').replace(' ', '').toLowerCase()
}

/** Every dated thing for the year: interviews, screenings, OA/HireVue deadlines and scheduled times. */
function buildItems(data: TrackerData): CalendarItem[] {
  const items: CalendarItem[] = []
  const appFor = (entry: { company: string; appRow: number | null }) =>
    linkedApplicationFor(entry, data.applications)

  for (const entry of [...data.oaEntries, ...data.hireVueEntries]) {
    const deadline = parseSheetDate(entry.deadline)
    if (deadline) {
      items.push({
        key: `${entry.kind}-deadline-${entry.sheetRow}`,
        type: 'deadline',
        label: `${entry.kind} due`,
        company: entry.company,
        start: deadline,
        end: null,
        allDay: !hasTimeOfDay(deadline),
        done: entry.complete,
        app: appFor(entry),
      })
    }
    const scheduled = parseSheetDate(entry.scheduled)
    if (scheduled) {
      const length = Number(entry.lengthMinutes)
      items.push({
        key: `${entry.kind}-scheduled-${entry.sheetRow}`,
        type: 'scheduled',
        label: `Do ${entry.kind}`,
        company: entry.company,
        start: scheduled,
        end: Number.isFinite(length) && length > 0 ? new Date(scheduled.getTime() + length * 60_000) : null,
        allDay: false,
        done: entry.complete,
        app: appFor(entry),
      })
    }
  }

  const dated = [
    ...data.interviewEntries.map((e) => ({ entry: e, type: 'interview' as const, done: e.complete })),
    // Screenings have no Complete column — they're done once they've ended.
    ...data.screeningEntries.map((e) => ({
      entry: e,
      type: 'screening' as const,
      done: hasMeetingEnded(e.dateTime, e.endTime),
    })),
  ]
  for (const { entry, type, done } of dated) {
    const start = parseSheetDate(entry.dateTime)
    if (!start) continue
    items.push({
      key: `${type}-${entry.sheetRow}`,
      type,
      label: type === 'interview' ? 'Interview' : 'Screening',
      company: entry.company,
      start,
      end: endMoment(start, entry.endTime),
      allDay: !hasTimeOfDay(start),
      done,
      app: appFor(entry),
    })
  }

  return items.sort((a, b) => a.start.getTime() - b.start.getTime())
}

function isPast(item: CalendarItem, now: Date): boolean {
  return item.done || isExpired(item.end ?? item.start, now)
}

const entryKey = (entry: AssessmentEntry) => `${entry.kind}-${entry.sheetRow}`

/** Pick a pending OA/HireVue and a time on `day` to do it (sets its Scheduled For, which sends the invite). */
function ScheduleAssessmentForm({
  day,
  data,
  disabled,
  onSave,
  onDone,
}: {
  day: Date
  data: TrackerData
  disabled?: boolean
  onSave: (entry: AssessmentEntry, input: ReturnType<typeof assessmentFormFromEntry>) => Promise<void>
  onDone: () => void
}) {
  const [key, setKey] = useState<string | null>(null)
  const [time, setTime] = useState('')
  const [length, setLength] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const pending = useMemo(
    () =>
      [...data.oaEntries, ...data.hireVueEntries]
        .filter((entry) => !entry.complete)
        .sort(
          (a, b) =>
            (parseSheetDate(a.deadline)?.getTime() ?? Infinity) - (parseSheetDate(b.deadline)?.getTime() ?? Infinity),
        ),
    [data.oaEntries, data.hireVueEntries],
  )
  const options: SearchSelectOption[] = pending.map((entry) => {
    const app = linkedApplicationFor(entry, data.applications)
    return {
      value: entryKey(entry),
      label: `${entry.company || 'Untitled'} — ${entry.kind}`,
      detail: [
        app?.role,
        entry.deadline ? `due ${formatDisplayDateTime(entry.deadline) || entry.deadline}` : '',
        entry.lengthMinutes ? `${entry.lengthMinutes} min` : '',
        entry.scheduled ? `scheduled ${formatDisplayDateTime(entry.scheduled) || entry.scheduled}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      keywords: entry.site,
    }
  })
  const selected = pending.find((entry) => entryKey(entry) === key) ?? null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!selected || !time) {
      setError('Pick an OA/HireVue and a time.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSave(selected, {
        ...assessmentFormFromEntry(selected),
        lengthMinutes: length.trim(),
        scheduled: `${toDateInputValue(day)}T${time}`,
      })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not schedule it')
    } finally {
      setSubmitting(false)
    }
  }

  const fieldClass =
    'h-8 w-full rounded border border-app-border bg-app-surface px-2 text-[12px] font-semibold text-app-text outline-none focus:border-app-brand'

  return (
    <form onSubmit={handleSubmit} className="space-y-2 border-b border-app-border px-3 py-2.5">
      <label className="block text-[10px] font-bold uppercase text-app-text-weak">
        OA / HireVue
        <SearchSelect
          options={options}
          value={key}
          onChange={(value) => {
            setKey(value)
            const entry = pending.find((e) => entryKey(e) === value)
            setLength(entry?.lengthMinutes ?? '')
          }}
          placeholder="Search by company or role…"
          emptyText={pending.length ? 'No matches' : 'No pending OAs or HireVues'}
          disabled={disabled}
        />
      </label>
      <div className="grid grid-cols-2 gap-1.5">
        <label className="text-[10px] font-bold uppercase text-app-text-weak">
          Time
          <input
            type="time"
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="text-[10px] font-bold uppercase text-app-text-weak">
          Length (minutes)
          <input
            inputMode="numeric"
            value={length}
            onChange={(e) => setLength(e.target.value)}
            className={fieldClass}
          />
        </label>
      </div>
      {error ? <p className="text-[11px] font-semibold text-kpi-reject-text">{error}</p> : null}
      <button
        type="submit"
        disabled={disabled || submitting}
        className="h-8 w-full rounded bg-app-brand text-[12px] font-bold text-white hover:bg-app-brand-dark disabled:opacity-50 dark:text-teal-950"
      >
        {submitting ? 'Scheduling…' : 'Schedule & send invite'}
      </button>
    </form>
  )
}

export function CalendarView({ data, saving, onSaveStatusChanges, linkedActions }: CalendarViewProps) {
  const [month, setMonth] = useState(() => startOfMonth())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [detailApp, setDetailApp] = useState<Application | null>(null)
  const [scheduling, setScheduling] = useState(false)

  const items = useMemo(() => buildItems(data), [data])

  // On lg the six week rows split the panel's height evenly, so each cell has a
  // fixed height; measure it so a busy day shows "+N more" instead of overflowing.
  const gridRef = useRef<HTMLDivElement>(null)
  const [chipSpace, setChipSpace] = useState<number | null>(null)
  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const lg = window.matchMedia('(min-width: 1024px)')
    const measure = () =>
      setChipSpace(lg.matches ? grid.getBoundingClientRect().height / 6 - CELL_CHROME : null)
    const observer = new ResizeObserver(measure)
    observer.observe(grid)
    lg.addEventListener('change', measure)
    measure()
    return () => {
      observer.disconnect()
      lg.removeEventListener('change', measure)
    }
  }, [])
  const now = new Date()
  const today = startOfDay(now)

  // 6-week grid starting on the Sunday on/before the 1st
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay())
  const days = Array.from(
    { length: 42 },
    (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i),
  )
  const itemsByDay = new Map<number, CalendarItem[]>()
  for (const item of items) {
    const key = startOfDay(item.start).getTime()
    itemsByDay.set(key, [...(itemsByDay.get(key) ?? []), item])
  }

  const agenda = selectedDay
    ? (itemsByDay.get(selectedDay.getTime()) ?? [])
    : items.filter((item) => !isPast(item, now))
  const agendaTitle = selectedDay
    ? selectedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    : 'Upcoming'

  const detailAppLive =
    detailApp === null
      ? null
      : (data.applications.find((a) => a.sheetRow === detailApp.sheetRow) ?? detailApp)
  const detailLinked = detailAppLive ? linkedEntriesForApplication(data, detailAppLive, data.applications) : undefined

  async function handleDetailStatusUpdate(app: Application, toStatus: ApplicationStatus) {
    if (!onSaveStatusChanges) {
      return
    }
    await onSaveStatusChanges([{ app, fromStatus: app.status, toStatus }])
  }

  function shiftMonth(delta: number) {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
    setSelectedDay(null)
    setScheduling(false)
  }

  return (
    <div className="flex w-full flex-col gap-3 lg:h-full lg:min-h-0 lg:gap-2.5">
      <ApplicationDetailModal
        app={detailAppLive}
        saving={saving}
        onClose={() => {
          if (!saving) {
            setDetailApp(null)
          }
        }}
        onUpdateStatus={onSaveStatusChanges ? handleDetailStatusUpdate : undefined}
        linked={detailLinked}
        linkedActions={linkedActions}
      />

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h1 className="text-[15px] font-bold text-app-text">Calendar</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {(Object.keys(TYPE_STYLES) as EventType[]).map((type) => (
            <span key={type} className="flex items-center gap-1 text-[11px] font-semibold text-app-text-weak">
              <span className={`h-2 w-2 rounded-full ${TYPE_STYLES[type].dot}`} aria-hidden />
              {TYPE_STYLES[type].name}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:flex-row lg:gap-2.5">
        <section className="overflow-hidden rounded-xl border border-panel-border bg-app-surface lg:flex lg:min-h-0 lg:flex-[2] lg:flex-col lg:rounded-md">
          <div className="flex items-center justify-between border-b border-app-border px-3 py-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="h-7 w-7 rounded text-[16px] font-bold text-app-text hover:bg-app-hover"
            >
              ‹
            </button>
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-bold text-app-text">
                {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setMonth(startOfMonth())
                  setSelectedDay(null)
                }}
                className="rounded border border-app-border px-1.5 py-0.5 text-[11px] font-bold text-app-brand hover:bg-app-hover"
              >
                Today
              </button>
            </div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="h-7 w-7 rounded text-[16px] font-bold text-app-text hover:bg-app-hover"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-app-border bg-app-muted">
            {WEEKDAYS.map((d) => (
              <p key={d} className="py-1 text-center text-[10px] font-bold tracking-[0.05em] uppercase text-app-text-weak">
                {d}
              </p>
            ))}
          </div>

          <div ref={gridRef} className="grid grid-cols-7 lg:min-h-0 lg:flex-1 lg:auto-rows-fr">
            {days.map((day) => {
              const dayItems = itemsByDay.get(day.getTime()) ?? []
              const shown = visibleChipCount(dayItems.length, chipSpace)
              const inMonth = day.getMonth() === month.getMonth()
              const isToday = isSameDay(day, today)
              const isSelected = selectedDay !== null && isSameDay(day, selectedDay)
              return (
                <button
                  key={day.getTime()}
                  type="button"
                  onClick={() => {
                    setSelectedDay(isSelected ? null : day)
                    setScheduling(false)
                  }}
                  aria-pressed={isSelected}
                  aria-label={`${day.toDateString()}, ${dayItems.length} item${dayItems.length === 1 ? '' : 's'}`}
                  className={[
                    'flex min-h-14 min-w-0 flex-col items-stretch gap-0.5 overflow-hidden border-r border-b border-app-border p-1 text-left sm:min-h-20 lg:min-h-0',
                    '[&:nth-child(7n)]:border-r-0',
                    isSelected ? 'bg-app-brand-soft' : 'hover:bg-app-hover',
                    inMonth ? '' : 'opacity-45',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums',
                      isToday ? 'bg-app-brand text-white dark:text-teal-950' : 'text-app-text',
                    ].join(' ')}
                  >
                    {day.getDate()}
                  </span>
                  {/* Phones: dots only. Wider: compact chips. */}
                  <span className="flex flex-wrap gap-0.5 sm:hidden">
                    {dayItems.slice(0, 4).map((item) => (
                      <span
                        key={item.key}
                        className={`h-1.5 w-1.5 rounded-full ${TYPE_STYLES[item.type].dot} ${isPast(item, now) ? 'opacity-40' : ''}`}
                      />
                    ))}
                  </span>
                  <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                    {dayItems.slice(0, shown).map((item) => (
                      <span
                        key={item.key}
                        className={[
                          'truncate rounded border px-1 text-[10px] leading-4 font-semibold',
                          TYPE_STYLES[item.type].chip,
                          isPast(item, now) ? 'opacity-50' : '',
                          item.done ? 'line-through' : '',
                        ].join(' ')}
                      >
                        {shortTime(item) ? `${shortTime(item)} ` : ''}
                        {item.company}
                      </span>
                    ))}
                    {dayItems.length > shown ? (
                      <span className="text-[10px] leading-3 font-bold text-app-text-weak">
                        +{dayItems.length - shown} more
                      </span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* No overflow-hidden here: the OA search dropdown has to be able to hang past short content. */}
        <section className="rounded-xl border border-panel-border bg-app-surface lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:rounded-md">
          <div className="flex items-center justify-between gap-2 rounded-t-xl border-b border-app-border bg-app-muted px-3 py-2 lg:rounded-t-md">
            <h2 className="min-w-0 truncate text-[12px] font-bold text-app-text">{agendaTitle}</h2>
            {selectedDay ? (
              <div className="flex shrink-0 items-center gap-3 whitespace-nowrap">
                {linkedActions ? (
                  <button
                    type="button"
                    onClick={() => setScheduling((s) => !s)}
                    className="text-[11px] font-bold text-app-brand hover:underline"
                  >
                    {scheduling ? 'Cancel' : '+ Schedule'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDay(null)
                    setScheduling(false)
                  }}
                  className="text-[11px] font-bold text-app-brand hover:underline"
                >
                  All upcoming
                </button>
              </div>
            ) : (
              <span className="text-[11px] font-bold text-app-text-weak tabular-nums">{agenda.length}</span>
            )}
          </div>
          {selectedDay && scheduling && linkedActions ? (
            <ScheduleAssessmentForm
              day={selectedDay}
              data={data}
              disabled={saving}
              onSave={linkedActions.editAssessment}
              onDone={() => setScheduling(false)}
            />
          ) : null}
          {!selectedDay && linkedActions ? (
            <p className="border-b border-app-border px-3 py-1.5 text-[11px] font-semibold text-app-text-weak">
              Click a day to schedule a time for an OA or HireVue.
            </p>
          ) : null}
          {agenda.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] font-semibold text-app-text-weak">
              {selectedDay ? 'Nothing on this day.' : 'Nothing coming up.'}
            </p>
          ) : (
            <ul className="divide-y divide-app-border lg:min-h-0 lg:flex-1 lg:overflow-auto">
              {agenda.map((item, i) => {
                const showDate = !selectedDay && (i === 0 || !isSameDay(agenda[i - 1].start, item.start))
                return (
                  <li key={item.key}>
                    {showDate ? (
                      <p className="bg-app-surface px-3 pt-2.5 text-[10px] font-bold tracking-[0.05em] uppercase text-app-text-weak">
                        {isSameDay(item.start, today)
                          ? 'Today'
                          : item.start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      disabled={!item.app}
                      onClick={() => item.app && setDetailApp(item.app)}
                      className={[
                        'flex w-full items-center gap-2.5 px-3 py-2 text-left enabled:hover:bg-app-hover',
                        isPast(item, now) ? 'opacity-55' : '',
                      ].join(' ')}
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TYPE_STYLES[item.type].dot}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[13px] font-bold text-app-text ${item.done ? 'line-through' : ''}`}>
                          {item.company || 'Untitled'}
                        </span>
                        <span className="block truncate text-[11px] font-semibold text-app-text-weak">
                          {[item.label, item.app?.role].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-[11px] font-bold text-app-text-weak tabular-nums">
                        {timeLabel(item)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
