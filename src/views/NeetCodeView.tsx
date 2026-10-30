import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  NeetCodeData,
  NeetCodeDifficulty,
  NeetCodeProblem,
  NeetCodeStatusKind,
  NeetCodeStudyDay,
} from '../types'
import { KpiCard } from '../components/KpiCard'
import {
  fetchNeetCodeData,
  getSavedNeetCodeSheetId,
  neetcodeSheetUrl,
  NeetCodeSetupError,
  saveNeetCodeSheetId,
  setNeetCodeDone,
} from '../lib/neetcode'
import { dateFromIso } from '../lib/neetcodeParse'
import { parseSpreadsheetId } from '../lib/session'

interface NeetCodeViewProps {
  accessToken: string
  userEmail: string
  /** VITE_NEETCODE_SHEET_ID — used until the user connects a different sheet. */
  defaultSheetId: string
}

type StatusFilter = 'All' | 'To do' | 'Done' | 'Behind' | 'Ahead' | 'On track' | 'No slot'
type DiffFilter = 'All' | NeetCodeDifficulty

const STATUS_FILTERS: StatusFilter[] = ['All', 'To do', 'Behind', 'Ahead', 'On track', 'No slot', 'Done']
const DIFF_LABEL: Record<NeetCodeDifficulty, string> = { E: 'Easy', M: 'Medium', H: 'Hard' }

const DIFF_CLASS: Record<NeetCodeDifficulty, string> = {
  E: 'bg-status-offer-bg text-status-offer-text',
  M: 'bg-status-interview-bg text-status-interview-text',
  H: 'bg-status-rejected-bg text-status-rejected-text',
}

const STATUS_PILL_CLASS: Record<NeetCodeStatusKind, string> = {
  done: 'bg-app-border/60 text-app-text-weak',
  onTrack: 'bg-status-applied-bg text-status-applied-text',
  ahead: 'bg-status-offer-bg text-status-offer-text',
  behind: 'bg-status-rejected-bg text-status-rejected-text',
  needsTime: 'bg-status-rejected-bg text-status-rejected-text',
  noSlot: 'bg-status-interview-bg text-status-interview-text',
  other: 'bg-app-border/60 text-app-text',
}

const ROW_CLASS: Record<NeetCodeStatusKind, string> = {
  done: 'bg-app-muted/60 text-app-text-weak',
  onTrack: '',
  ahead: 'bg-kpi-offer-bg/70',
  behind: 'bg-kpi-reject-bg/70',
  needsTime: 'bg-kpi-reject-bg/70',
  noSlot: 'bg-kpi-interview-bg/60',
  other: '',
}

function matchesStatus(problem: NeetCodeProblem, filter: StatusFilter): boolean {
  switch (filter) {
    case 'All':
      return true
    case 'To do':
      return !problem.done
    case 'Done':
      return problem.done
    case 'Behind':
      return problem.statusKind === 'behind' || problem.statusKind === 'needsTime'
    case 'Ahead':
      return problem.statusKind === 'ahead'
    case 'On track':
      return problem.statusKind === 'onTrack'
    case 'No slot':
      return problem.statusKind === 'noSlot'
  }
}

function formatShortDate(iso: string | null): string {
  if (!iso) {
    return '—'
  }
  return dateFromIso(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDayHeading(iso: string): string {
  const date = dateFromIso(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  const label = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  if (days === 0) return `Today · ${label}`
  if (days === 1) return `Tomorrow · ${label}`
  return label
}

function statusLabel(problem: NeetCodeProblem): string {
  if (problem.done) return 'Done'
  if (problem.statusKind === 'noSlot') return 'No slot'
  return problem.status || '—'
}

function DiffBadge({ difficulty }: { difficulty: NeetCodeDifficulty | '' }) {
  if (!difficulty) {
    return null
  }
  return (
    <span
      className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded px-1 text-[11px] font-bold ${DIFF_CLASS[difficulty]}`}
      title={DIFF_LABEL[difficulty]}
    >
      {difficulty}
    </span>
  )
}

function DoneCheckbox({
  problem,
  checked,
  busy,
  onToggle,
}: {
  problem: NeetCodeProblem
  checked: boolean
  busy: boolean
  onToggle: (problem: NeetCodeProblem, done: boolean) => void
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={busy}
      onChange={(e) => onToggle(problem, e.target.checked)}
      aria-label={`Mark ${problem.name} ${checked ? 'not done' : 'done'}`}
      className="h-5 w-5 shrink-0 cursor-pointer accent-app-brand disabled:cursor-wait disabled:opacity-60 lg:h-4 lg:w-4"
    />
  )
}

function ConnectNeetCodeSheet({
  error,
  onConnect,
}: {
  error?: string | null
  onConnect: (sheetId: string) => void
}) {
  const [value, setValue] = useState('')
  const [invalid, setInvalid] = useState(false)
  return (
    <form
      className="mx-auto mt-6 w-full max-w-md rounded-xl border border-panel-border bg-app-surface p-4 lg:rounded-md"
      onSubmit={(e) => {
        e.preventDefault()
        const id = parseSpreadsheetId(value)
        setInvalid(!id)
        if (id) {
          onConnect(id)
        }
      }}
    >
      <h2 className="text-[15px] font-bold text-app-text">Connect your NeetCode sheet</h2>
      <p className="mt-1 text-[13px] text-app-text-weak">
        Paste the URL or ID of your “NeetCode Tracker” Google Sheet (tabs: Checklist, Next Up, Capacity).
      </p>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="https://docs.google.com/spreadsheets/d/…"
        className="mt-3 h-11 w-full rounded-lg border border-app-border bg-app-surface px-3 text-[14px] text-app-text outline-none focus:border-app-brand lg:h-9 lg:text-[13px]"
      />
      {invalid ? (
        <p className="mt-1.5 text-[12px] text-kpi-reject-text">That doesn’t look like a Google Sheets URL or ID.</p>
      ) : null}
      {error ? <p className="mt-1.5 text-[12px] text-kpi-reject-text">{error}</p> : null}
      <button
        type="submit"
        className="mt-3 h-11 w-full rounded-lg bg-app-brand text-[14px] font-bold text-white hover:bg-app-brand-dark lg:h-9 lg:text-[13px] dark:text-teal-950"
      >
        Connect
      </button>
    </form>
  )
}

function StudyDayCard({
  title,
  day,
  isChecked,
  isBusy,
  onToggle,
}: {
  title: string
  day: NeetCodeStudyDay
  isChecked: (problem: NeetCodeProblem) => boolean
  isBusy: (problem: NeetCodeProblem) => boolean
  onToggle: (problem: NeetCodeProblem, done: boolean) => void
}) {
  const minutes = day.problems.reduce((sum, item) => sum + (item.problem?.minutes ?? 0), 0)
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-kpi-oa-border bg-kpi-oa-bg lg:rounded-md">
      <div className="flex items-baseline justify-between gap-2 border-b border-kpi-oa-border/60 px-3 py-2.5 lg:px-2.5 lg:py-1.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-kpi-oa-text/80 lg:text-[10px]">
            {title}
          </p>
          <h3 className="truncate text-[14px] font-bold text-kpi-oa-text lg:text-[13px]">
            {day.date ? formatDayHeading(day.date) : 'No study day scheduled'}
          </h3>
        </div>
        {minutes > 0 ? (
          <p className="shrink-0 text-[12px] font-semibold tabular-nums text-kpi-oa-text lg:text-[11px]">
            {minutes} min
          </p>
        ) : null}
      </div>
      {!day.date ? (
        <p className="px-3 py-3 text-[13px] text-kpi-oa-text/80 lg:px-2.5 lg:py-2 lg:text-[12px]">
          {day.label || 'No open slot.'} Add days to the <span className="font-semibold">Capacity</span> tab.
        </p>
      ) : day.problems.length === 0 ? (
        <p className="px-3 py-3 text-[13px] text-kpi-oa-text/80 lg:px-2.5 lg:py-2 lg:text-[12px]">
          Nothing planned for this day.
        </p>
      ) : (
        <ul>
          {day.problems.map((item, i) => {
            const problem = item.problem
            const checked = problem ? isChecked(problem) : false
            return (
              <li
                key={`${item.label}-${i}`}
                className="border-b border-kpi-oa-border/40 last:border-b-0"
              >
                <label className="flex min-h-12 cursor-pointer items-center gap-2.5 px-3 py-2 lg:min-h-0 lg:px-2.5 lg:py-1.5">
                  {problem ? (
                    <DoneCheckbox problem={problem} checked={checked} busy={isBusy(problem)} onToggle={onToggle} />
                  ) : (
                    <span className="h-5 w-5 shrink-0 lg:h-4 lg:w-4" />
                  )}
                  <span
                    className={[
                      'min-w-0 flex-1 truncate text-[14px] font-semibold lg:text-[12px]',
                      checked ? 'text-app-text-weak line-through' : 'text-kpi-oa-text',
                    ].join(' ')}
                  >
                    {problem?.name ?? item.label}
                  </span>
                  {problem ? <DiffBadge difficulty={problem.difficulty} /> : null}
                  {problem?.minutes ? (
                    <span className="shrink-0 text-[12px] tabular-nums text-app-text-weak lg:text-[11px]">
                      {problem.minutes}m
                    </span>
                  ) : null}
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function CategoryProgress({ problems }: { problems: NeetCodeProblem[] }) {
  const categories = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>()
    for (const p of problems) {
      const key = p.category || 'Uncategorized'
      const entry = map.get(key) ?? { done: 0, total: 0 }
      entry.total += 1
      entry.done += p.done ? 1 : 0
      map.set(key, entry)
    }
    return [...map.entries()]
  }, [problems])

  return (
    <div className="rounded-xl border border-panel-border bg-app-surface lg:rounded-md">
      <h2 className="border-b border-app-border px-3 py-2.5 text-[14px] font-bold text-panel-title lg:px-2.5 lg:py-1.5 lg:text-[12px] lg:font-semibold">
        Progress by category
      </h2>
      <ul className="grid gap-x-4 gap-y-2.5 p-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-1.5 lg:p-2.5 xl:grid-cols-6">
        {categories.map(([name, { done, total }]) => {
          const pct = total ? Math.round((done / total) * 100) : 0
          return (
            <li key={name} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2 text-[12px] lg:text-[11px]">
                <span className="truncate font-semibold text-app-text">{name}</span>
                <span className="shrink-0 tabular-nums text-app-text-weak">
                  {done}/{total}
                </span>
              </div>
              <div
                className="mt-1 h-1.5 overflow-hidden rounded-full bg-app-border"
                role="progressbar"
                aria-label={`${name} progress`}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={done}
              >
                <div className="h-full rounded-full bg-app-brand" style={{ width: `${pct}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const selectClass =
  'h-10 min-w-0 rounded-lg border border-app-border bg-app-surface px-2 text-[13px] font-semibold text-app-text outline-none focus:border-app-brand lg:h-8 lg:rounded lg:text-[12px]'

function ProblemTable({
  problems,
  isChecked,
  isBusy,
  onToggle,
}: {
  problems: NeetCodeProblem[]
  isChecked: (problem: NeetCodeProblem) => boolean
  isBusy: (problem: NeetCodeProblem) => boolean
  onToggle: (problem: NeetCodeProblem, done: boolean) => void
}) {
  const [category, setCategory] = useState('All')
  const [difficulty, setDifficulty] = useState<DiffFilter>('All')
  const [status, setStatus] = useState<StatusFilter>('To do')
  const [sortAsc, setSortAsc] = useState(true)

  const categories = useMemo(() => [...new Set(problems.map((p) => p.category).filter(Boolean))], [problems])

  const rows = useMemo(() => {
    const filtered = problems.filter(
      (p) =>
        (category === 'All' || p.category === category) &&
        (difficulty === 'All' || p.difficulty === difficulty) &&
        matchesStatus(p, status),
    )
    // Planned date order; ties (and blank planned dates) fall back to checklist order.
    return filtered.sort((a, b) => {
      if (a.plannedDate !== b.plannedDate) {
        if (!a.plannedDate) return 1
        if (!b.plannedDate) return -1
        return (a.plannedDate < b.plannedDate ? -1 : 1) * (sortAsc ? 1 : -1)
      }
      return a.sheetRow - b.sheetRow
    })
  }, [problems, category, difficulty, status, sortAsc])

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-panel-border bg-app-surface lg:rounded-md">
      <div className="flex flex-wrap items-center gap-2 border-b border-app-border px-3 py-2.5 lg:px-2.5 lg:py-1.5">
        <h2 className="mr-auto text-[14px] font-bold text-panel-title lg:text-[12px] lg:font-semibold">
          All problems <span className="font-normal text-app-text-weak tabular-nums">· {rows.length}</span>
        </h2>
        <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto">
          <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
            <option value="All">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            aria-label="Difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as DiffFilter)}
            className={selectClass}
          >
            <option value="All">All levels</option>
            <option value="E">Easy</option>
            <option value="M">Medium</option>
            <option value="H">Hard</option>
          </select>
          <select
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className={selectClass}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === 'All' ? 'All statuses' : s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-[14px] font-semibold text-app-text-weak">
          No problems match these filters.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] lg:text-[12px]">
            <thead className="bg-app-muted text-[11px] font-bold tracking-[0.06em] text-app-text-weak uppercase lg:text-[10px]">
              <tr>
                <th className="w-11 px-3 py-2 lg:w-9 lg:px-2.5 lg:py-1.5">
                  <span className="sr-only">Done</span>
                </th>
                <th className="hidden w-10 py-2 sm:table-cell lg:py-1.5">#</th>
                <th className="py-2 pr-2 lg:py-1.5">Problem</th>
                <th className="hidden w-44 py-2 pr-2 md:table-cell lg:py-1.5">Category</th>
                <th className="hidden w-12 py-2 pr-2 sm:table-cell lg:py-1.5">Min</th>
                <th className="w-[4.25rem] py-2 pr-2 sm:w-24 lg:py-1.5">
                  <button
                    type="button"
                    onClick={() => setSortAsc((v) => !v)}
                    className="inline-flex items-center gap-1 whitespace-nowrap uppercase hover:text-app-text"
                    aria-label={`Sort by planned date ${sortAsc ? 'descending' : 'ascending'}`}
                  >
                    Planned {sortAsc ? '↑' : '↓'}
                  </button>
                </th>
                <th className="hidden w-20 py-2 pr-2 lg:table-cell lg:py-1.5">Original</th>
                <th className="w-[6.5rem] py-2 pr-3 sm:w-32 lg:py-1.5 lg:pr-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {rows.map((p) => {
                const checked = isChecked(p)
                const kind: NeetCodeStatusKind = checked ? 'done' : p.statusKind === 'done' ? 'onTrack' : p.statusKind
                return (
                  <tr key={p.sheetRow} className={ROW_CLASS[kind]}>
                    <td className="px-3 py-2 lg:px-2.5 lg:py-1">
                      <DoneCheckbox problem={p} checked={checked} busy={isBusy(p)} onToggle={onToggle} />
                    </td>
                    <td className="hidden py-2 tabular-nums text-app-text-weak sm:table-cell lg:py-1">{p.number ?? ''}</td>
                    <td className="max-w-0 py-2 pr-2 lg:py-1">
                      <div className="flex items-center gap-1.5">
                        <DiffBadge difficulty={p.difficulty} />
                        <span
                          className={[
                            'truncate font-semibold',
                            checked ? 'text-app-text-weak line-through' : 'text-app-text',
                          ].join(' ')}
                          title={p.name}
                        >
                          {p.name}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-app-text-weak md:hidden">{p.category}</p>
                    </td>
                    <td className="hidden truncate py-2 pr-2 text-app-text-weak md:table-cell lg:py-1">{p.category}</td>
                    <td className="hidden py-2 pr-2 tabular-nums text-app-text-weak sm:table-cell lg:py-1">{p.minutes ?? ''}</td>
                    <td className="py-2 pr-2 whitespace-nowrap tabular-nums text-app-text lg:py-1">
                      {formatShortDate(p.plannedDate)}
                    </td>
                    <td className="hidden py-2 pr-2 whitespace-nowrap tabular-nums text-app-text-weak lg:table-cell lg:py-1">
                      {formatShortDate(p.originalDeadline)}
                    </td>
                    <td className="py-2 pr-3 lg:py-1 lg:pr-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${STATUS_PILL_CLASS[kind]}`}
                      >
                        {checked ? 'Done' : statusLabel(p)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function NeetCodeView({ accessToken, userEmail, defaultSheetId }: NeetCodeViewProps) {
  const [sheetId, setSheetId] = useState<string | null>(
    () => getSavedNeetCodeSheetId(userEmail) || defaultSheetId || null,
  )
  const [data, setData] = useState<NeetCodeData | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [setupError, setSetupError] = useState<NeetCodeSetupError | null>(null)
  const [writeError, setWriteError] = useState<string | null>(null)
  /** Sheet row → done value the UI shows while its write + refetch are in flight. */
  const [pending, setPending] = useState<Map<number, boolean>>(() => new Map())
  const writeQueue = useRef<Promise<void>>(Promise.resolve())
  const inFlight = useRef(0)

  const load = useCallback(
    async (opts?: { quiet?: boolean }): Promise<boolean> => {
      if (!sheetId) {
        return false
      }
      if (!opts?.quiet) {
        setLoading(true)
      }
      try {
        const next = await fetchNeetCodeData(sheetId, accessToken)
        setData(next)
        setLoadError(null)
        setSetupError(null)
        return true
      } catch (err) {
        if (err instanceof NeetCodeSetupError) {
          setSetupError(err)
        } else {
          setLoadError(err instanceof Error ? err.message : 'Could not load the NeetCode sheet.')
        }
        return false
      } finally {
        setLoading(false)
      }
    },
    [sheetId, accessToken],
  )

  useEffect(() => {
    void load()
  }, [load])

  const isChecked = useCallback(
    (problem: NeetCodeProblem) => pending.get(problem.sheetRow) ?? problem.done,
    [pending],
  )
  const isBusy = useCallback((problem: NeetCodeProblem) => pending.has(problem.sheetRow), [pending])

  function handleToggle(problem: NeetCodeProblem, done: boolean) {
    if (!sheetId || !data) {
      return
    }
    const { doneColumn } = data
    setWriteError(null)
    setPending((prev) => new Map(prev).set(problem.sheetRow, done))
    inFlight.current += 1
    // Writes run one at a time; the sheet is refetched once the queue drains so the
    // planned dates/status reflect every tick.
    writeQueue.current = writeQueue.current
      .then(() => setNeetCodeDone({ spreadsheetId: sheetId, accessToken, problem, doneColumn, done }))
      .catch((err: unknown) => {
        setWriteError(err instanceof Error ? err.message : 'Could not update the sheet.')
      })
      .then(async () => {
        inFlight.current -= 1
        if (inFlight.current > 0) {
          return
        }
        await load({ quiet: true })
        // Drop optimistic values either way: on success the refetch has them, on
        // failure the row snaps back to what the sheet says.
        setPending(new Map())
      })
  }

  function handleConnect(id: string) {
    saveNeetCodeSheetId(userEmail, id)
    setData(null)
    setSheetId(id)
  }

  function handleChangeSheet() {
    saveNeetCodeSheetId(userEmail, null)
    setData(null)
    setLoadError(null)
    setSetupError(null)
    setSheetId(null)
  }

  const sheetUrl = sheetId ? neetcodeSheetUrl(sheetId) : null

  const header = (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
      <h1 className="text-[15px] font-bold text-app-text">NeetCode</h1>
      {sheetUrl ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-10 items-center rounded-lg border border-app-border bg-app-surface px-3 text-[13px] font-bold text-app-text hover:bg-app-hover disabled:opacity-50 lg:h-8 lg:rounded lg:px-2.5 lg:text-[12px]"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <a
            href={sheetUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center rounded-lg border border-app-brand bg-app-brand px-3 text-[13px] font-bold text-white hover:bg-app-brand-dark lg:h-8 lg:rounded lg:px-2.5 lg:text-[12px] dark:text-teal-950"
          >
            Open in Sheets
          </a>
        </div>
      ) : null}
    </div>
  )

  if (!sheetId) {
    return (
      <div className="flex w-full flex-col gap-3">
        {header}
        <ConnectNeetCodeSheet onConnect={handleConnect} />
      </div>
    )
  }

  if (setupError || (loadError && !data)) {
    return (
      <div className="flex w-full flex-col gap-3">
        {header}
        <div className="mx-auto mt-4 w-full max-w-lg rounded-xl border border-kpi-reject-border bg-kpi-reject-bg p-4 text-kpi-reject-text lg:rounded-md">
          <h2 className="text-[14px] font-bold">
            {setupError ? 'The NeetCode sheet needs a quick fix' : 'Couldn’t load your NeetCode sheet'}
          </h2>
          <p className="mt-1 text-[13px]">{setupError?.message ?? loadError}</p>
          {setupError ? (
            <p className="mt-1 text-[12px] opacity-80">
              Expected Checklist headers: #, Problem, Category, Diff, Min, Done, Original deadline, Planned date,
              Status.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="h-10 rounded-lg bg-kpi-reject-text px-3 text-[13px] font-bold text-white disabled:opacity-50 lg:h-8 lg:text-[12px] dark:text-rose-950"
            >
              {loading ? 'Retrying…' : 'Retry'}
            </button>
            <button
              type="button"
              onClick={handleChangeSheet}
              className="h-10 rounded-lg border border-kpi-reject-border bg-app-surface px-3 text-[13px] font-bold text-kpi-reject-text lg:h-8 lg:text-[12px]"
            >
              Use a different sheet
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex w-full flex-col gap-3">
        {header}
        <p className="py-8 text-center text-[13px] text-app-text-weak">Loading NeetCode…</p>
      </div>
    )
  }

  const { progress, problems, nextDays } = data
  const total = progress.total || problems.length
  const pct = total ? Math.round((progress.done / total) * 100) : 0
  const behind =
    progress.originalFinish !== null &&
    progress.projectedFinish !== null &&
    progress.projectedFinish > progress.originalFinish
  // "Needs more time" rows with no planned date ran out of Capacity rows too.
  const noSlotCount = problems.filter((p) => !p.done && !p.plannedDate).length
  const extraPerDay = progress.extraMinutesPerStudyDay ?? 0
  const allDone = total > 0 && progress.done >= total
  const kpiClass = 'min-w-[9.5rem] shrink-0 snap-start lg:min-w-0'

  return (
    <div className="flex w-full flex-col gap-3 lg:h-full lg:min-h-0 lg:gap-2.5 lg:overflow-y-auto">
      {header}

      {loadError || writeError ? (
        <div className="rounded-lg border border-kpi-reject-border bg-kpi-reject-bg px-3 py-2 text-[12px] text-kpi-reject-text">
          {writeError ?? loadError}
          {sheetUrl ? (
            <>
              {' '}
              <a href={sheetUrl} target="_blank" rel="noreferrer" className="font-bold underline">
                Open in Sheets
              </a>
            </>
          ) : null}
        </div>
      ) : null}

      {noSlotCount > 0 ? (
        <div className="rounded-lg border border-kpi-interview-border bg-kpi-interview-bg px-3 py-2 text-[12px] text-kpi-interview-text">
          {noSlotCount} problem{noSlotCount === 1 ? ' has' : 's have'} no study slot. Add days to the{' '}
          <span className="font-bold">Capacity</span> tab to schedule {noSlotCount === 1 ? 'it' : 'them'}.
        </div>
      ) : null}

      <div className="-mx-3 flex shrink-0 gap-2 overflow-x-auto px-3 pb-0.5 snap-x snap-mandatory [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 lg:pb-0 lg:snap-none [&::-webkit-scrollbar]:hidden">
        <KpiCard className={kpiClass} compact tone="applied" label="Done" value={progress.done} suffix={`/ ${total}`} />
        <KpiCard
          className={kpiClass}
          compact
          tone="oa"
          label="Complete"
          value={`${pct}%`}
          rate={progress.remainingMinutes !== null ? `${progress.remainingMinutes} min left` : undefined}
        />
        <KpiCard
          className={kpiClass}
          compact
          tone={behind ? 'reject' : 'offer'}
          label="Projected finish"
          value={
            progress.projectedFinish
              ? formatShortDate(progress.projectedFinish)
              : progress.projectedFinishLabel || '—'
          }
          rate={progress.originalFinish ? `goal ${formatShortDate(progress.originalFinish)}` : undefined}
        />
        <KpiCard
          className={kpiClass}
          compact
          tone={extraPerDay > 0 ? 'reject' : 'offer'}
          label="Extra / study day"
          value={Math.ceil(extraPerDay)}
          suffix="min"
          rate={
            progress.problemsBehind ? `${progress.problemsBehind} behind` : extraPerDay > 0 ? undefined : 'on pace'
          }
        />
      </div>

      {allDone ? (
        <div className="rounded-xl border border-kpi-offer-border bg-kpi-offer-bg px-3 py-3 text-[14px] font-bold text-kpi-offer-text lg:rounded-md lg:text-[13px]">
          All {total} problems done. Nice work.
        </div>
      ) : (
        <div className="flex shrink-0 flex-col gap-3 md:flex-row lg:gap-2">
          <StudyDayCard
            title="Next up"
            day={nextDays[0]}
            isChecked={isChecked}
            isBusy={isBusy}
            onToggle={handleToggle}
          />
          <StudyDayCard
            title="After that"
            day={nextDays[1]}
            isChecked={isChecked}
            isBusy={isBusy}
            onToggle={handleToggle}
          />
        </div>
      )}

      <CategoryProgress problems={problems} />

      <ProblemTable problems={problems} isChecked={isChecked} isBusy={isBusy} onToggle={handleToggle} />
    </div>
  )
}
