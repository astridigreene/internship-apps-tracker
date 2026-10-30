import type {
  NeetCodeData,
  NeetCodeDifficulty,
  NeetCodeProblem,
  NeetCodeProgress,
  NeetCodeStatusKind,
  NeetCodeStudyDay,
} from '../types'

/**
 * Pure parsing of the NeetCode Tracker sheet. Every schedule value (planned date,
 * status, projected finish, …) comes from the sheet's own formulas — this file only
 * reads them, it never recomputes the schedule.
 *
 * Values arrive as UNFORMATTED_VALUE + SERIAL_NUMBER, so dates are serial numbers,
 * checkboxes are booleans, and everything else is a string or number.
 */
export type CellValue = string | number | boolean | null | undefined

export const CHECKLIST_TAB = 'Checklist'
export const NEXT_UP_TAB = 'Next Up'

/** Checklist header → matcher on the normalized header (lowercase, parentheticals dropped). */
const CHECKLIST_COLUMNS = {
  number: (h: string) => h === '#' || h === 'no' || h === 'number',
  name: (h: string) => h === 'problem' || h === 'name',
  category: (h: string) => h === 'category' || h === 'topic',
  difficulty: (h: string) => h.startsWith('diff'),
  minutes: (h: string) => h === 'min' || h.startsWith('minutes'),
  done: (h: string) => h.startsWith('done'),
  originalDeadline: (h: string) => h.startsWith('original deadline'),
  plannedDate: (h: string) => h.startsWith('planned'),
  status: (h: string) => h.startsWith('status'),
} as const

type ChecklistField = keyof typeof CHECKLIST_COLUMNS

/** Missing tab / header problems — shown as setup help rather than a crash. */
export class NeetCodeSetupError extends Error {
  readonly missing: string[]

  constructor(message: string, missing: string[] = []) {
    super(message)
    this.name = 'NeetCodeSetupError'
    this.missing = missing
  }
}

function text(value: CellValue): string {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value).trim()
}

function normalizeHeader(value: CellValue): string {
  return text(value)
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function toNumber(value: CellValue): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const raw = text(value).replace(/[,+]/g, '')
  if (!raw) {
    return null
  }
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function isoFromLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Sheets serial (days since 1899-12-30) or date text → YYYY-MM-DD, else null. */
export function toIsoDate(value: CellValue): string | null {
  if (typeof value === 'number') {
    if (value < 20_000 || value > 100_000) {
      return null
    }
    return isoFromLocalDate(new Date(1899, 11, 30 + Math.floor(value)))
  }
  const raw = text(value)
  if (!raw || !/\d{4}/.test(raw)) {
    return null
  }
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`
  }
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : isoFromLocalDate(parsed)
}

/** ISO date → local Date at midnight (avoids the UTC day-shift of `new Date('YYYY-MM-DD')`). */
export function dateFromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function isDone(value: CellValue): boolean {
  if (typeof value === 'boolean') {
    return value
  }
  const raw = text(value).toLowerCase()
  return raw === 'x' || raw === 'true' || raw === '✓' || raw === 'yes'
}

function toDifficulty(value: CellValue): NeetCodeDifficulty | '' {
  const first = text(value).charAt(0).toUpperCase()
  return first === 'E' || first === 'M' || first === 'H' ? first : ''
}

export function statusKindFor(status: string, done: boolean, plannedDate: string | null): NeetCodeStatusKind {
  const s = status.toLowerCase()
  if (done || s === 'done') {
    return 'done'
  }
  if (s.startsWith('behind')) {
    return 'behind'
  }
  if (s.startsWith('ahead')) {
    return 'ahead'
  }
  if (s.startsWith('needs')) {
    return 'needsTime'
  }
  if (!plannedDate) {
    return 'noSlot'
  }
  if (s.startsWith('on track')) {
    return 'onTrack'
  }
  return 'other'
}

export function parseChecklist(values: CellValue[][]): { problems: NeetCodeProblem[]; doneColumn: string } {
  if (values.length === 0) {
    throw new NeetCodeSetupError(`The ${CHECKLIST_TAB} tab is empty.`)
  }
  const headers = values[0].map(normalizeHeader)
  const index = {} as Record<ChecklistField, number>
  const missing: string[] = []
  for (const [field, matches] of Object.entries(CHECKLIST_COLUMNS) as [ChecklistField, (h: string) => boolean][]) {
    const i = headers.findIndex(matches)
    if (i === -1) {
      if (field !== 'number' && field !== 'originalDeadline') {
        missing.push(field)
      }
    }
    index[field] = i
  }
  if (missing.length > 0) {
    throw new NeetCodeSetupError(
      `The ${CHECKLIST_TAB} tab is missing columns: ${missing.join(', ')}.`,
      missing,
    )
  }

  const problems: NeetCodeProblem[] = []
  values.slice(1).forEach((row, i) => {
    const cell = (field: ChecklistField): CellValue => (index[field] === -1 ? undefined : row[index[field]])
    const name = text(cell('name'))
    if (!name) {
      return
    }
    const rawDone = cell('done')
    const done = isDone(rawDone)
    const plannedDate = toIsoDate(cell('plannedDate'))
    const status = text(cell('status'))
    problems.push({
      sheetRow: i + 2,
      number: toNumber(cell('number')),
      name,
      category: text(cell('category')),
      difficulty: toDifficulty(cell('difficulty')),
      minutes: toNumber(cell('minutes')),
      done,
      doneIsCheckbox: typeof rawDone === 'boolean',
      originalDeadline: toIsoDate(cell('originalDeadline')),
      plannedDate,
      status,
      statusKind: statusKindFor(status, done, plannedDate),
    })
  })
  return { problems, doneColumn: columnLetter(index.done) }
}

function columnLetter(index: number): string {
  let n = index + 1
  let out = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

/** "Contains Duplicate (E)" → "contains duplicate" for matching against Checklist names. */
function problemKey(label: string): string {
  return label
    .replace(/\s*\((?:E|M|H|Easy|Medium|Hard)\)\s*$/i, '')
    .trim()
    .toLowerCase()
}

/** Next Up stat label → field. Exact labels first so "Done" doesn't swallow "Do on …". */
type NumericProgressField =
  | 'remaining'
  | 'remainingMinutes'
  | 'problemsBehind'
  | 'extraMinutesNeeded'
  | 'extraMinutesPerStudyDay'

function progressFieldFor(
  label: string,
): NumericProgressField | 'done' | 'originalFinish' | 'projectedFinish' | null {
  if (label === 'done') return 'done'
  if (label === 'remaining') return 'remaining'
  if (label.startsWith('remaining min')) return 'remainingMinutes'
  if (label.startsWith('original finish')) return 'originalFinish'
  if (label.startsWith('projected finish')) return 'projectedFinish'
  if (label.startsWith('problems behind')) return 'problemsBehind'
  if (label.includes('per study day')) return 'extraMinutesPerStudyDay'
  if (label.startsWith('extra min')) return 'extraMinutesNeeded'
  return null
}

function studyDay(value: CellValue): NeetCodeStudyDay {
  return { date: toIsoDate(value), label: text(value), problems: [] }
}

export function parseNextUp(values: CellValue[][], problems: NeetCodeProblem[]): {
  nextDays: NeetCodeStudyDay[]
  progress: NeetCodeProgress
} {
  const byName = new Map(problems.map((p) => [p.name.toLowerCase(), p]))
  const labelAt = (row: CellValue[] | undefined, col: number) => normalizeHeader(row?.[col])

  let next = studyDay(undefined)
  let following = studyDay(undefined)
  const progress: NeetCodeProgress = {
    done: problems.filter((p) => p.done).length,
    total: problems.length,
    remaining: null,
    remainingMinutes: null,
    originalFinish: null,
    projectedFinish: null,
    projectedFinishLabel: '',
    problemsBehind: null,
    extraMinutesNeeded: null,
    extraMinutesPerStudyDay: null,
  }

  let listHeaderRow = -1
  let nextCol = -1
  let followingCol = -1

  values.forEach((row, r) => {
    row.forEach((cell, c) => {
      const label = normalizeHeader(cell)
      if (label.startsWith('do on next')) {
        listHeaderRow = r
        nextCol = c
      } else if (label.startsWith('do on following')) {
        listHeaderRow = r
        followingCol = c
      }
    })

    const label = labelAt(row, 0)
    const value = row[1]
    if (label === 'next study day') {
      next = studyDay(value)
      return
    }
    if (label === 'following study day') {
      following = studyDay(value)
      return
    }
    const field = progressFieldFor(label)
    if (!field) {
      return
    }
    if (field === 'originalFinish') {
      progress.originalFinish = toIsoDate(value)
    } else if (field === 'projectedFinish') {
      progress.projectedFinish = toIsoDate(value)
      progress.projectedFinishLabel = text(value)
    } else if (field === 'done') {
      progress.done = toNumber(value) ?? progress.done
    } else {
      progress[field] = toNumber(value)
    }
  })

  if (listHeaderRow !== -1) {
    // Problem lists run down from the "Do on …" headers until the Progress block.
    for (let r = listHeaderRow + 1; r < values.length; r++) {
      const row = values[r]
      if (labelAt(row, 0) === 'progress' || progressFieldFor(labelAt(row, 0))) {
        break
      }
      for (const [col, day] of [
        [nextCol, next],
        [followingCol, following],
      ] as const) {
        const label = col === -1 ? '' : text(row[col])
        if (label) {
          day.problems.push({ label, problem: byName.get(problemKey(label)) ?? null })
        }
      }
    }
  }

  return { nextDays: [next, following], progress }
}

export function buildNeetCodeData(checklist: CellValue[][], nextUp: CellValue[][] | null): NeetCodeData {
  const { problems, doneColumn } = parseChecklist(checklist)
  const { nextDays, progress } = parseNextUp(nextUp ?? [], problems)
  return { lastSynced: new Date().toISOString(), problems, doneColumn, nextDays, progress }
}
