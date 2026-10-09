import {
  deriveHighestStageOnStatusChange,
  effectiveHighestStage,
  formatYesNo,
  isRejectedStatus,
  migrateLegacyStatus,
  normalizeOaComplete,
  normalizeYesNo,
  statusRank,
  type Application,
  type ApplicationStatus,
  type AssessmentEntry,
  type AssessmentSheetColumns,
  type HighestStage,
  type InterviewEntry,
  type InterviewSheetColumns,
  type LinkedTabState,
  type NewApplicationInput,
  type NewAssessmentInput,
  type NewInterviewInput,
  type NewScreeningInput,
  type OaComplete,
  type ScreeningEntry,
  type ScreeningSheetColumns,
  type SheetColumns,
  type Stats,
  type TrackerData,
} from '../types'
import { formatDisplayDate, formatSheetDateTime, formatTimeOfDay, parseSheetDate, parseTimeOfDay } from './time'

/** Required header labels shown in setup help. */
export const REQUIRED_COLUMN_GUIDE = [
  { label: 'Company', hint: 'Also accepts: Employer, Organization' },
  { label: 'Location', hint: 'Also accepts: Loc, City, Office' },
  { label: 'Role', hint: 'Also accepts: Position, Title, Job' },
  { label: 'Date Applied', hint: 'Also accepts: Applied, Applied On' },
  { label: 'Status', hint: 'Also accepts: Stage, Result, Outcome' },
] as const

/** Optional headers — app works without them, with reduced features. */
export const OPTIONAL_COLUMN_GUIDE = [
  {
    label: 'Last Updated',
    hint: 'Stamped when status changes',
  },
  {
    label: 'Highest Stage',
    hint: 'Auto-stamped: furthest stage reached, kept even after a rejection',
  },
] as const

/** Optional sibling tabs per year (e.g. "2027 OA") — created automatically on first use. */
export const LINKED_TAB_GUIDE = [
  {
    label: 'OA',
    hint: 'Columns: Deadline (date & time), Auto, Company, Date Offered, Length (minutes), Site, Complete',
  },
  {
    label: 'HireVue',
    hint: 'Same columns as OA',
  },
  {
    label: 'Interviews',
    hint: 'Columns: Company, Date & Time, Notes, Complete',
  },
  {
    label: 'Screening',
    hint: 'Columns: Company, Date & Time, Notes',
  },
] as const

export type SheetSetupReason = 'empty' | 'missing-columns' | 'no-year-tabs'

export interface SheetSetupDetails {
  reason: SheetSetupReason
  missing?: string[]
  foundHeaders?: string[]
  yearTab?: string
}

/** Recoverable spreadsheet setup problem — show directions, don’t treat as a crash. */
export class SheetSetupError extends Error {
  readonly code = 'SHEET_SETUP' as const
  readonly details: SheetSetupDetails

  constructor(details: SheetSetupDetails) {
    super(sheetSetupSummary(details))
    this.name = 'SheetSetupError'
    this.details = details
  }
}

export function isSheetSetupError(err: unknown): err is SheetSetupError {
  return (
    err instanceof SheetSetupError ||
    (typeof err === 'object' &&
      err !== null &&
      (err as { code?: string }).code === 'SHEET_SETUP' &&
      typeof (err as { details?: unknown }).details === 'object')
  )
}

function sheetSetupSummary(details: SheetSetupDetails): string {
  switch (details.reason) {
    case 'empty':
      return 'This year tab is empty. Add a header row with the required column names.'
    case 'no-year-tabs':
      return 'No year tabs found. Rename a sheet tab to a four-digit year like 2027.'
    case 'missing-columns': {
      const missing = details.missing?.join(', ') || 'required columns'
      return `Missing required columns: ${missing}. Add them as the first-row headers.`
    }
    default:
      return 'This spreadsheet needs a small setup fix before it can be used.'
  }
}

/** Canonical field → accepted header aliases (normalized). */
const HEADER_ALIASES: Record<string, string[]> = {
  company: ['company', 'employer', 'org', 'organization'],
  location: ['location', 'loc', 'city', 'office'],
  role: ['role', 'position', 'title', 'job', 'job title'],
  dateApplied: ['date applied', 'dateapplied', 'applied', 'applied on', 'application date'],
  status: ['status', 'stage', 'result', 'outcome', 'application status'],
  lastUpdated: [
    'last updated',
    'lastupdated',
    'status updated',
    'updated',
    'updated at',
    'oa sent',
    'oa date',
    'date oa',
  ],
  oaComplete: ['oa complete', 'oacomplete', 'oa completed', 'oa done', 'completed oa'],
  highestStage: ['highest stage', 'highest', 'furthest stage', 'best stage', 'stage reached'],
}

const LINKED_HEADER_ALIASES = {
  company: ['company', 'employer', 'org', 'organization'],
  deadline: ['deadline', 'due', 'due date'],
  auto: ['auto', 'auto-oa', 'auto oa', 'automated'],
  dateOffered: ['date offered', 'offered', 'date sent', 'sent'],
  lengthMinutes: ['length (minutes)', 'length minutes', 'length', 'duration', 'minutes'],
  site: ['site', 'platform', 'link', 'url'],
  scheduled: ['scheduled for', 'scheduled', 'scheduled time', 'planned', 'do at'],
  calendarEvent: ['calendar event', 'calendar event id', 'gcal event'],
  complete: ['complete', 'completed', 'done'],
  dateTime: [
    'date & time',
    'date and time',
    'datetime',
    'date time',
    'interview date',
    'date',
    'when',
  ],
  notes: ['notes', 'note', 'details'],
  endTime: ['end time', 'end', 'ends', 'ends at', 'until'],
  appRow: ['app row', 'application row', 'row'],
} as const

/** Parse an App Row cell into a year-tab row number (null when blank/invalid). */
function parseAppRow(raw: string): number | null {
  const n = Number(raw.trim())
  return Number.isInteger(n) && n >= 2 ? n : null
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Normalize status casing / arrow variants for known values. */
export function normalizeStatus(raw: string): string {
  const value = raw.trim()
  if (!value) {
    return 'Applied'
  }
  const known = ['Applied', 'Progressed', 'Interview', 'Offer', 'Rejected']
  const match = known.find((s) => s.toLowerCase() === value.toLowerCase())
  if (match) {
    return match
  }
  // Legacy 7-value sheet not yet migrated — fall back rather than crash.
  return migrateLegacyStatus(value).status
}

function resolveColumnIndex(
  headerMap: Map<string, number>,
  aliases: readonly string[],
): number | undefined {
  for (const alias of aliases) {
    const idx = headerMap.get(alias)
    if (idx !== undefined) {
      return idx
    }
  }
  return undefined
}

function columnLetter(zeroBasedIndex: number): string {
  let n = zeroBasedIndex
  let label = ''
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label
    n = Math.floor(n / 26) - 1
  }
  return label
}

function a1RangeForSheet(sheetTitle: string, cellRange = 'A1:Z'): string {
  const escaped = sheetTitle.replace(/'/g, "''")
  return `'${escaped}'!${cellRange}`
}

export function isYearSheetTitle(title: string): boolean {
  return /^\d{4}$/.test(title.trim())
}

export function pickDefaultYear(years: string[], preferred = '2027'): string {
  if (years.includes(preferred)) {
    return preferred
  }
  return years[0] ?? preferred
}

/** Upcoming internship summer year (e.g. Jul 2026 → "2027"). */
export function nextSummerYear(now = new Date()): string {
  const year = now.getFullYear()
  const month = now.getMonth() // 0 = Jan
  // Jan–May: still aiming at this year's summer. Jun–Dec: next year's summer.
  return String(month < 5 ? year : year + 1)
}

/** Sibling tab names for a year's OA / HireVue / Interviews / Screening data. */
export function linkedTabNames(year: string): {
  oa: string
  hireVue: string
  interviews: string
  screening: string
} {
  return {
    oa: `${year} OA`,
    hireVue: `${year} HireVue`,
    interviews: `${year} Interviews`,
    screening: `${year} Screening`,
  }
}

async function fetchSpreadsheetMeta(
  spreadsheetId: string,
  accessToken: string,
): Promise<{ sheetId: number; title: string }[]> {
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`,
  )
  url.searchParams.set('fields', 'sheets.properties(sheetId,title)')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (res.status === 403 || res.status === 404) {
    throw new Error(
      'Could not read the spreadsheet. Confirm it is shared with your Google account and the Sheet ID is correct.',
    )
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Sheets API error (${res.status}): ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    sheets?: { properties?: { sheetId?: number; title?: string } }[]
  }
  return (data.sheets ?? [])
    .filter((s) => s.properties?.sheetId !== undefined && s.properties?.title !== undefined)
    .map((s) => ({ sheetId: s.properties!.sheetId as number, title: s.properties!.title as string }))
}

/** List spreadsheet tabs whose titles are years (e.g. "2027", "2026"). */
export async function listYearSheets(
  spreadsheetId: string,
  accessToken: string,
): Promise<string[]> {
  const sheets = await fetchSpreadsheetMeta(spreadsheetId, accessToken)
  const years = sheets
    .map((s) => s.title.trim())
    .filter(isYearSheetTitle)
    .sort((a, b) => Number(b) - Number(a))

  if (!years.length) {
    throw new SheetSetupError({ reason: 'no-year-tabs' })
  }

  return years
}

export function parseSheetValues(values: string[][]): {
  applications: Application[]
  columns: SheetColumns
} {
  if (!values.length) {
    throw new SheetSetupError({
      reason: 'empty',
      foundHeaders: [],
      missing: REQUIRED_COLUMN_GUIDE.map((c) => c.label),
    })
  }

  const headers = values[0].map((h) => String(h ?? '').trim())
  const headerMap = new Map<string, number>()
  headers.forEach((h, i) => {
    if (h) {
      headerMap.set(normalizeHeader(h), i)
    }
  })

  const resolved = {
    company: resolveColumnIndex(headerMap, HEADER_ALIASES.company),
    location: resolveColumnIndex(headerMap, HEADER_ALIASES.location),
    role: resolveColumnIndex(headerMap, HEADER_ALIASES.role),
    dateApplied: resolveColumnIndex(headerMap, HEADER_ALIASES.dateApplied),
    status: resolveColumnIndex(headerMap, HEADER_ALIASES.status),
    lastUpdated: resolveColumnIndex(headerMap, HEADER_ALIASES.lastUpdated),
    oaComplete: resolveColumnIndex(headerMap, HEADER_ALIASES.oaComplete),
    highestStage: resolveColumnIndex(headerMap, HEADER_ALIASES.highestStage),
  }

  const missingLabels: string[] = []
  if (resolved.company === undefined) missingLabels.push('Company')
  if (resolved.location === undefined) missingLabels.push('Location')
  if (resolved.role === undefined) missingLabels.push('Role')
  if (resolved.dateApplied === undefined) missingLabels.push('Date Applied')
  if (resolved.status === undefined) missingLabels.push('Status')

  if (missingLabels.length) {
    throw new SheetSetupError({
      reason: values.every((row) => row.every((cell) => !String(cell ?? '').trim()))
        ? 'empty'
        : 'missing-columns',
      missing: missingLabels,
      foundHeaders: headers.filter(Boolean),
    })
  }

  const columns: SheetColumns = {
    company: resolved.company!,
    location: resolved.location!,
    role: resolved.role!,
    dateApplied: resolved.dateApplied!,
    status: resolved.status!,
    lastUpdated: resolved.lastUpdated ?? null,
    oaComplete: resolved.oaComplete ?? null,
    highestStage: resolved.highestStage ?? null,
  }

  const cellAt = (row: string[], idx: number | undefined | null) =>
    idx !== undefined && idx !== null && idx < row.length ? String(row[idx] ?? '').trim() : ''

  const apps: Application[] = []
  for (let i = 1; i < values.length; i++) {
    const row = values[i]
    const company = cellAt(row, columns.company)
    const location = cellAt(row, columns.location)
    const role = cellAt(row, columns.role)
    const dateApplied =
      formatDisplayDate(cellAt(row, columns.dateApplied)) || cellAt(row, columns.dateApplied)
    const rawStatus = cellAt(row, columns.status)
    const status = normalizeStatus(rawStatus)
    const lastUpdatedRaw = cellAt(row, columns.lastUpdated) || null
    const lastUpdated = lastUpdatedRaw ? formatDisplayDate(lastUpdatedRaw) || lastUpdatedRaw : null
    const oaComplete =
      columns.oaComplete === null ? null : normalizeOaComplete(cellAt(row, columns.oaComplete))
    const highestStageRaw = cellAt(row, columns.highestStage)
    const highestStage: HighestStage | null =
      columns.highestStage === null || !highestStageRaw
        ? null
        : (['Applied', 'Progressed', 'Interview', 'Offer'].find(
            (s) => s.toLowerCase() === highestStageRaw.toLowerCase(),
          ) as HighestStage | undefined) ?? migrateLegacyStatus(rawStatus).highestStage

    if (!company && !role && !status) {
      continue
    }

    apps.push({
      company,
      location,
      role,
      dateApplied,
      status,
      highestStage,
      lastUpdated,
      oaComplete,
      sheetRow: i + 1,
    })
  }

  return { applications: apps, columns }
}

export function computeStats(applications: Application[]): Stats {
  const total = applications.length
  let rejections = 0
  let progressed = 0
  let interviews = 0
  let offers = 0
  let inProgress = 0

  for (const app of applications) {
    if (isRejectedStatus(app.status)) {
      rejections += 1
    }
    const highest = effectiveHighestStage(app)
    if (highest === 'Progressed' || highest === 'Interview' || highest === 'Offer') {
      progressed += 1
    }
    if (highest === 'Interview' || highest === 'Offer') {
      interviews += 1
    }
    if (highest === 'Offer') {
      offers += 1
    }
    if (app.status === 'Progressed' || app.status === 'Interview') {
      inProgress += 1
    }
  }

  const rate = (count: number) => (total === 0 ? 0 : Math.round((count / total) * 1000) / 10)

  return {
    totalApplications: total,
    rejections,
    progressed,
    interviews,
    offers,
    rejectionRate: rate(rejections),
    progressedRate: rate(progressed),
    interviewRate: rate(interviews),
    offerRate: rate(offers),
    inProgress,
  }
}

// ---------------------------------------------------------------------------
// Linked tabs: OA / HireVue / Interviews / Screening
// ---------------------------------------------------------------------------

function parseAssessmentSheet(
  values: string[][],
  kind: 'OA' | 'HireVue',
): { entries: AssessmentEntry[]; columns: AssessmentSheetColumns | null } {
  if (!values.length) {
    return { entries: [], columns: null }
  }
  const headers = values[0].map((h) => String(h ?? '').trim())
  const headerMap = new Map<string, number>()
  headers.forEach((h, i) => {
    if (h) headerMap.set(normalizeHeader(h), i)
  })

  const company = resolveColumnIndex(headerMap, LINKED_HEADER_ALIASES.company)
  const deadline = resolveColumnIndex(headerMap, LINKED_HEADER_ALIASES.deadline)
  if (company === undefined || deadline === undefined) {
    return { entries: [], columns: null }
  }

  const columns: AssessmentSheetColumns = {
    company,
    deadline,
    auto: resolveColumnIndex(headerMap, LINKED_HEADER_ALIASES.auto) ?? null,
    dateOffered: resolveColumnIndex(headerMap, LINKED_HEADER_ALIASES.dateOffered) ?? null,
    lengthMinutes: resolveColumnIndex(headerMap, LINKED_HEADER_ALIASES.lengthMinutes) ?? null,
    site: resolveColumnIndex(headerMap, LINKED_HEADER_ALIASES.site) ?? null,
    scheduled: resolveColumnIndex(headerMap, LINKED_HEADER_ALIASES.scheduled) ?? null,
    calendarEvent: resolveColumnIndex(headerMap, LINKED_HEADER_ALIASES.calendarEvent) ?? null,
    complete: resolveColumnIndex(headerMap, LINKED_HEADER_ALIASES.complete) ?? null,
    appRow: resolveColumnIndex(headerMap, LINKED_HEADER_ALIASES.appRow) ?? null,
  }

  const cellAt = (row: string[], idx: number | null) =>
    idx !== null && idx < row.length ? String(row[idx] ?? '').trim() : ''

  const entries: AssessmentEntry[] = []
  for (let i = 1; i < values.length; i++) {
    const row = values[i]
    const companyVal = cellAt(row, columns.company)
    const deadlineVal = cellAt(row, columns.deadline)
    if (!companyVal && !deadlineVal) {
      continue
    }
    entries.push({
      kind,
      company: companyVal,
      deadline: deadlineVal,
      auto: normalizeYesNo(cellAt(row, columns.auto)),
      dateOffered: formatDisplayDate(cellAt(row, columns.dateOffered)) || cellAt(row, columns.dateOffered),
      lengthMinutes: cellAt(row, columns.lengthMinutes),
      site: cellAt(row, columns.site),
      scheduled: cellAt(row, columns.scheduled),
      calendarEventId: cellAt(row, columns.calendarEvent),
      complete: normalizeYesNo(cellAt(row, columns.complete)),
      appRow: parseAppRow(cellAt(row, columns.appRow)),
      sheetRow: i + 1,
    })
  }

  return { entries, columns }
}

function parseInterviewSheet(values: string[][]): {
  entries: InterviewEntry[]
  columns: InterviewSheetColumns | null
} {
  if (!values.length) {
    return { entries: [], columns: null }
  }
  const headers = values[0].map((h) => String(h ?? '').trim())
  const headerMap = new Map<string, number>()
  headers.forEach((h, i) => {
    if (h) headerMap.set(normalizeHeader(h), i)
  })

  const company = resolveColumnIndex(headerMap, LINKED_HEADER_ALIASES.company)
  const dateTime = resolveColumnIndex(headerMap, LINKED_HEADER_ALIASES.dateTime)
  if (company === undefined || dateTime === undefined) {
    return { entries: [], columns: null }
  }

  const columns: InterviewSheetColumns = {
    company,
    dateTime,
    endTime: resolveColumnIndex(headerMap, LINKED_HEADER_ALIASES.endTime) ?? null,
    notes: resolveColumnIndex(headerMap, LINKED_HEADER_ALIASES.notes) ?? null,
    complete: resolveColumnIndex(headerMap, LINKED_HEADER_ALIASES.complete) ?? null,
    appRow: resolveColumnIndex(headerMap, LINKED_HEADER_ALIASES.appRow) ?? null,
  }

  const cellAt = (row: string[], idx: number | null) =>
    idx !== null && idx < row.length ? String(row[idx] ?? '').trim() : ''

  const entries: InterviewEntry[] = []
  for (let i = 1; i < values.length; i++) {
    const row = values[i]
    const companyVal = cellAt(row, columns.company)
    const dateTimeVal = cellAt(row, columns.dateTime)
    if (!companyVal && !dateTimeVal) {
      continue
    }
    entries.push({
      company: companyVal,
      dateTime: dateTimeVal,
      endTime: cellAt(row, columns.endTime),
      notes: cellAt(row, columns.notes),
      complete: normalizeYesNo(cellAt(row, columns.complete)),
      appRow: parseAppRow(cellAt(row, columns.appRow)),
      sheetRow: i + 1,
    })
  }

  return { entries, columns }
}

function parseScreeningSheet(values: string[][]): {
  entries: ScreeningEntry[]
  columns: ScreeningSheetColumns | null
} {
  if (!values.length) {
    return { entries: [], columns: null }
  }
  const headers = values[0].map((h) => String(h ?? '').trim())
  const headerMap = new Map<string, number>()
  headers.forEach((h, i) => {
    if (h) headerMap.set(normalizeHeader(h), i)
  })

  const company = resolveColumnIndex(headerMap, LINKED_HEADER_ALIASES.company)
  const dateTime = resolveColumnIndex(headerMap, LINKED_HEADER_ALIASES.dateTime)
  if (company === undefined || dateTime === undefined) {
    return { entries: [], columns: null }
  }

  const columns: ScreeningSheetColumns = {
    company,
    dateTime,
    endTime: resolveColumnIndex(headerMap, LINKED_HEADER_ALIASES.endTime) ?? null,
    notes: resolveColumnIndex(headerMap, LINKED_HEADER_ALIASES.notes) ?? null,
    appRow: resolveColumnIndex(headerMap, LINKED_HEADER_ALIASES.appRow) ?? null,
  }

  const cellAt = (row: string[], idx: number | null) =>
    idx !== null && idx < row.length ? String(row[idx] ?? '').trim() : ''

  const entries: ScreeningEntry[] = []
  for (let i = 1; i < values.length; i++) {
    const row = values[i]
    const companyVal = cellAt(row, columns.company)
    const dateTimeVal = cellAt(row, columns.dateTime)
    if (!companyVal && !dateTimeVal) {
      continue
    }
    entries.push({
      company: companyVal,
      dateTime: dateTimeVal,
      endTime: cellAt(row, columns.endTime),
      notes: cellAt(row, columns.notes),
      appRow: parseAppRow(cellAt(row, columns.appRow)),
      sheetRow: i + 1,
    })
  }

  return { entries, columns }
}

export interface LinkedTrackerData {
  oaEntries: AssessmentEntry[]
  hireVueEntries: AssessmentEntry[]
  interviewEntries: InterviewEntry[]
  screeningEntries: ScreeningEntry[]
  oaTab: LinkedTabState<AssessmentSheetColumns>
  hireVueTab: LinkedTabState<AssessmentSheetColumns>
  interviewsTab: LinkedTabState<InterviewSheetColumns>
  screeningTab: LinkedTabState<ScreeningSheetColumns>
}

/** Fetch + parse all 4 optional linked tabs for a year. Tolerant of any/all missing. */
export async function fetchLinkedTrackerData(
  spreadsheetId: string,
  accessToken: string,
  year: string,
): Promise<LinkedTrackerData> {
  const names = linkedTabNames(year)
  const [oaValues, hireVueValues, interviewsValues, screeningValues] = await Promise.all([
    fetchOptionalSheetValues(spreadsheetId, accessToken, names.oa),
    fetchOptionalSheetValues(spreadsheetId, accessToken, names.hireVue),
    fetchOptionalSheetValues(spreadsheetId, accessToken, names.interviews),
    fetchOptionalSheetValues(spreadsheetId, accessToken, names.screening),
  ])

  const oaParsed = parseAssessmentSheet(oaValues ?? [], 'OA')
  const hireVueParsed = parseAssessmentSheet(hireVueValues ?? [], 'HireVue')
  const interviewsParsed = parseInterviewSheet(interviewsValues ?? [])
  const screeningParsed = parseScreeningSheet(screeningValues ?? [])

  return {
    oaEntries: oaParsed.entries,
    hireVueEntries: hireVueParsed.entries,
    interviewEntries: interviewsParsed.entries,
    screeningEntries: screeningParsed.entries,
    oaTab: { present: oaValues !== null, columns: oaParsed.columns },
    hireVueTab: { present: hireVueValues !== null, columns: hireVueParsed.columns },
    interviewsTab: { present: interviewsValues !== null, columns: interviewsParsed.columns },
    screeningTab: { present: screeningValues !== null, columns: screeningParsed.columns },
  }
}

export function buildTrackerData(values: string[][], linked: LinkedTrackerData): TrackerData {
  const { applications, columns } = parseSheetValues(values)
  return {
    lastSynced: new Date().toISOString(),
    stats: computeStats(applications),
    applications,
    columns,
    ...linked,
  }
}

export async function fetchSheetValues(
  spreadsheetId: string,
  accessToken: string,
  sheetTitle: string,
  cellRange?: string,
): Promise<string[][]> {
  const range = a1RangeForSheet(sheetTitle, cellRange)
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
  )
  url.searchParams.set('majorDimension', 'ROWS')

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (res.status === 403 || res.status === 404) {
    throw new Error(
      `Could not read sheet tab "${sheetTitle}". Confirm the tab exists and is shared with your Google account.`,
    )
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Sheets API error (${res.status}): ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as { values?: string[][] }
  return data.values ?? []
}

/** Like fetchSheetValues, but returns null instead of throwing when the tab is missing. */
export async function fetchOptionalSheetValues(
  spreadsheetId: string,
  accessToken: string,
  sheetTitle: string,
): Promise<string[][] | null> {
  try {
    return await fetchSheetValues(spreadsheetId, accessToken, sheetTitle)
  } catch {
    return null
  }
}

async function putSheetValues(options: {
  spreadsheetId: string
  accessToken: string
  sheetTitle: string
  startCell: string
  values: string[][]
}): Promise<void> {
  const range = a1RangeForSheet(options.sheetTitle, options.startCell)
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(options.spreadsheetId)}/values/${encodeURIComponent(range)}`,
  )
  url.searchParams.set('valueInputOption', 'USER_ENTERED')

  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values: options.values,
    }),
  })

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      'Could not update the sheet. Sign out and sign in again to grant edit access to Google Sheets.',
    )
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Sheets update failed (${res.status}): ${body.slice(0, 200)}`)
  }
}

/**
 * Ensure a header exists on the year tab, appending it as a new trailing column
 * if missing. Returns the 0-based column index.
 */
async function ensureHeaderColumn(options: {
  spreadsheetId: string
  accessToken: string
  sheetTitle: string
  headerRow: string[]
  aliases: readonly string[]
  headerLabel: string
}): Promise<number> {
  const headerMap = new Map<string, number>()
  options.headerRow.forEach((h, i) => {
    const key = normalizeHeader(String(h ?? ''))
    if (key) {
      headerMap.set(key, i)
    }
  })

  const existing = resolveColumnIndex(headerMap, options.aliases)
  if (existing !== undefined) {
    return existing
  }

  let nextIndex = options.headerRow.length
  while (nextIndex > 0 && !String(options.headerRow[nextIndex - 1] ?? '').trim()) {
    nextIndex -= 1
  }

  await putSheetValues({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle: options.sheetTitle,
    startCell: `${columnLetter(nextIndex)}1`,
    values: [[options.headerLabel]],
  })

  return nextIndex
}

export async function ensureLastUpdatedColumn(options: {
  spreadsheetId: string
  accessToken: string
  sheetTitle: string
  headerRow: string[]
}): Promise<number> {
  return ensureHeaderColumn({
    ...options,
    aliases: HEADER_ALIASES.lastUpdated,
    headerLabel: 'Last Updated',
  })
}

export async function ensureHighestStageColumn(options: {
  spreadsheetId: string
  accessToken: string
  sheetTitle: string
  headerRow: string[]
}): Promise<number> {
  return ensureHeaderColumn({
    ...options,
    aliases: HEADER_ALIASES.highestStage,
    headerLabel: 'Highest Stage',
  })
}

/** Update Status (+ Last Updated + Highest Stage) for an application row. */
export async function updateSheetStatus(options: {
  spreadsheetId: string
  accessToken: string
  sheetTitle: string
  sheetRow: number
  columns: SheetColumns
  status: string
  currentStatus: string
  currentHighestStage: HighestStage | null
  lastUpdatedStamp: string
}): Promise<SheetColumns> {
  await putSheetValues({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle: options.sheetTitle,
    startCell: `${columnLetter(options.columns.status)}${options.sheetRow}`,
    values: [[options.status]],
  })

  let columns = options.columns
  let headerValues: string[][] | null = null
  async function loadHeaderRow(): Promise<string[]> {
    if (!headerValues) {
      headerValues = await fetchSheetValues(
        options.spreadsheetId,
        options.accessToken,
        options.sheetTitle,
      )
    }
    return headerValues[0] ?? []
  }

  let lastUpdatedCol = columns.lastUpdated
  if (lastUpdatedCol === null) {
    lastUpdatedCol = await ensureLastUpdatedColumn({
      spreadsheetId: options.spreadsheetId,
      accessToken: options.accessToken,
      sheetTitle: options.sheetTitle,
      headerRow: await loadHeaderRow(),
    })
    columns = { ...columns, lastUpdated: lastUpdatedCol }
  }

  await putSheetValues({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle: options.sheetTitle,
    startCell: `${columnLetter(lastUpdatedCol)}${options.sheetRow}`,
    values: [[options.lastUpdatedStamp]],
  })

  let highestStageCol = columns.highestStage
  if (highestStageCol === null) {
    highestStageCol = await ensureHighestStageColumn({
      spreadsheetId: options.spreadsheetId,
      accessToken: options.accessToken,
      sheetTitle: options.sheetTitle,
      headerRow: await loadHeaderRow(),
    })
    columns = { ...columns, highestStage: highestStageCol }
  }

  const nextHighest = deriveHighestStageOnStatusChange(
    options.currentHighestStage,
    options.currentStatus,
    options.status as ApplicationStatus,
  )
  await putSheetValues({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle: options.sheetTitle,
    startCell: `${columnLetter(highestStageCol)}${options.sheetRow}`,
    values: [[nextHighest]],
  })

  return columns
}

function assertCompleteApplication(input: NewApplicationInput): NewApplicationInput {
  const company = input.company.trim()
  const location = input.location.trim()
  const role = input.role.trim()
  const dateApplied = input.dateApplied.trim()
  const status = input.status

  if (!company || !location || !role || !dateApplied || !status) {
    throw new Error('All fields are required: Company, Location, Role, Date Applied, and Status.')
  }

  return { company, location, role, dateApplied: formatDisplayDate(dateApplied) || dateApplied, status }
}

/** Append a complete application row to the year tab. Returns updated columns + sheet row. */
export async function appendSheetApplication(options: {
  spreadsheetId: string
  accessToken: string
  sheetTitle: string
  columns: SheetColumns
  application: NewApplicationInput
  lastUpdatedStamp: string
}): Promise<{ columns: SheetColumns; sheetRow: number }> {
  const app = assertCompleteApplication(options.application)

  let columns = options.columns
  let headerValues: string[][] | null = null
  async function loadHeaderRow(): Promise<string[]> {
    if (!headerValues) {
      headerValues = await fetchSheetValues(
        options.spreadsheetId,
        options.accessToken,
        options.sheetTitle,
      )
    }
    return headerValues[0] ?? []
  }

  if (columns.lastUpdated === null) {
    const lastUpdated = await ensureLastUpdatedColumn({
      spreadsheetId: options.spreadsheetId,
      accessToken: options.accessToken,
      sheetTitle: options.sheetTitle,
      headerRow: await loadHeaderRow(),
    })
    columns = { ...columns, lastUpdated }
  }
  if (columns.highestStage === null) {
    const highestStage = await ensureHighestStageColumn({
      spreadsheetId: options.spreadsheetId,
      accessToken: options.accessToken,
      sheetTitle: options.sheetTitle,
      headerRow: await loadHeaderRow(),
    })
    columns = { ...columns, highestStage }
  }

  const initialHighest = deriveHighestStageOnStatusChange(null, 'Applied', app.status)

  const width = Math.max(
    columns.company,
    columns.location,
    columns.role,
    columns.dateApplied,
    columns.status,
    columns.lastUpdated ?? 0,
    columns.oaComplete ?? 0,
    columns.highestStage ?? 0,
  )
  const row = Array.from({ length: width + 1 }, () => '')
  row[columns.company] = app.company
  row[columns.location] = app.location
  row[columns.role] = app.role
  row[columns.dateApplied] = app.dateApplied
  row[columns.status] = app.status
  if (columns.lastUpdated !== null) {
    row[columns.lastUpdated] = options.lastUpdatedStamp
  }
  if (columns.highestStage !== null) {
    row[columns.highestStage] = initialHighest
  }

  const range = a1RangeForSheet(options.sheetTitle, 'A:Z')
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(options.spreadsheetId)}/values/${encodeURIComponent(range)}:append`,
  )
  url.searchParams.set('valueInputOption', 'USER_ENTERED')
  url.searchParams.set('insertDataOption', 'INSERT_ROWS')

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      majorDimension: 'ROWS',
      values: [row],
    }),
  })

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      'Could not update the sheet. Sign out and sign in again to grant edit access to Google Sheets.',
    )
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Sheets append failed (${res.status}): ${body.slice(0, 200)}`)
  }

  const payload = (await res.json()) as {
    updates?: { updatedRange?: string }
  }
  const updatedRange = payload.updates?.updatedRange ?? ''
  const rowMatch = updatedRange.match(/![A-Z]+(\d+)/i)
  const sheetRow = rowMatch ? Number(rowMatch[1]) : 0
  if (!sheetRow) {
    throw new Error('Added the row, but could not determine its sheet row number. Refresh and try again.')
  }

  return { columns, sheetRow }
}

async function getSheetIdByTitle(options: {
  spreadsheetId: string
  accessToken: string
  sheetTitle: string
}): Promise<number | null> {
  const sheets = await fetchSpreadsheetMeta(options.spreadsheetId, options.accessToken)
  const match = sheets.find((s) => s.title.trim() === options.sheetTitle)
  return match?.sheetId ?? null
}

/**
 * Delete a spreadsheet row by 1-based row number.
 * Rows below shift upward (Google Sheets deleteDimension).
 */
export async function deleteSheetRow(options: {
  spreadsheetId: string
  accessToken: string
  sheetTitle: string
  sheetRow: number
}): Promise<void> {
  if (options.sheetRow < 2) {
    throw new Error('Cannot delete the header row.')
  }

  const sheetId = await getSheetIdByTitle(options)
  if (sheetId === null) {
    throw new Error(`Could not find sheet tab "${options.sheetTitle}".`)
  }
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(options.spreadsheetId)}:batchUpdate`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: options.sheetRow - 1,
              endIndex: options.sheetRow,
            },
          },
        },
      ],
    }),
  })

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      'Could not delete the row. Sign out and sign in again to grant edit access to Google Sheets.',
    )
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Sheets delete failed (${res.status}): ${body.slice(0, 200)}`)
  }
}

/** Create a new sheet tab with the given title. No-op (returns existing id) if it already exists. */
async function ensureSheetTab(options: {
  spreadsheetId: string
  accessToken: string
  sheetTitle: string
}): Promise<void> {
  const existing = await getSheetIdByTitle(options)
  if (existing !== null) {
    return
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(options.spreadsheetId)}:batchUpdate`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: options.sheetTitle } } }],
    }),
  })

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      'Could not create the sheet tab. Sign out and sign in again to grant edit access to Google Sheets.',
    )
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Sheets tab creation failed (${res.status}): ${body.slice(0, 200)}`)
  }
}

async function appendRow(options: {
  spreadsheetId: string
  accessToken: string
  sheetTitle: string
  row: string[]
  /** A cell value (e.g. the company) that must be in the written row; checked by reading it back. */
  verifyValue?: string
}): Promise<number> {
  const range = a1RangeForSheet(options.sheetTitle, 'A:Z')
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(options.spreadsheetId)}/values/${encodeURIComponent(range)}:append`,
  )
  url.searchParams.set('valueInputOption', 'USER_ENTERED')
  url.searchParams.set('insertDataOption', 'INSERT_ROWS')

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ majorDimension: 'ROWS', values: [options.row] }),
  })

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      'Could not update the sheet. Sign out and sign in again to grant edit access to Google Sheets.',
    )
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Sheets append failed (${res.status}): ${body.slice(0, 200)}`)
  }

  const payload = (await res.json()) as { updates?: { updatedRange?: string } }
  const updatedRange = payload.updates?.updatedRange ?? ''
  const rowMatch = updatedRange.match(/![A-Z]+(\d+)/i)
  const sheetRow = rowMatch ? Number(rowMatch[1]) : 0
  if (!sheetRow) {
    throw new Error('Added the row, but could not determine its sheet row number. Refresh and try again.')
  }

  if (options.verifyValue) {
    const written = await fetchSheetValues(
      options.spreadsheetId,
      options.accessToken,
      options.sheetTitle,
      `A${sheetRow}:Z${sheetRow}`,
    )
    const expected = options.verifyValue.trim().toLowerCase()
    const found = (written[0] ?? []).some((cell) => String(cell ?? '').trim().toLowerCase() === expected)
    if (!found) {
      throw new Error(
        `Google Sheets accepted the new row, but it isn't in "${options.sheetTitle}" row ${sheetRow}. Refresh and check the tab before adding it again.`,
      )
    }
  }
  return sheetRow
}

const ASSESSMENT_HEADER_ROW = [
  'Deadline',
  'Auto',
  'Company',
  'Date Offered',
  'Length (minutes)',
  'Site',
  'Complete',
  'App Row',
  'Scheduled For',
  'Calendar Event',
]
const INTERVIEW_HEADER_ROW = ['Company', 'Date & Time', 'End Time', 'Notes', 'Complete', 'App Row']
const SCREENING_HEADER_ROW = ['Company', 'Date & Time', 'End Time', 'Notes', 'App Row']
/** Columns added to an existing linked tab (after its last header) when it doesn't have them yet. */
const ADDED_LINKED_HEADERS = {
  endTime: 'End Time',
  appRow: 'App Row',
  scheduled: 'Scheduled For',
  calendarEvent: 'Calendar Event',
} as const

function headerMapFor(headers: string[]): Map<string, number> {
  const map = new Map<string, number>()
  headers.forEach((h, i) => {
    if (h) map.set(normalizeHeader(h), i)
  })
  return map
}

/**
 * Create a linked tab (with default headers) on first use, and add any of
 * `addHeaders` (App Row is always included) to tabs made before those columns
 * existed. Returns the header row.
 */
async function prepareLinkedTab(options: {
  spreadsheetId: string
  accessToken: string
  sheetTitle: string
  defaultHeader: string[]
  addHeaders?: (keyof typeof ADDED_LINKED_HEADERS)[]
}): Promise<string[]> {
  await ensureSheetTab(options)
  const existing = await fetchSheetValues(options.spreadsheetId, options.accessToken, options.sheetTitle)
  const headers = (existing[0] ?? []).map((h) => String(h ?? '').trim())
  if (!headers.some(Boolean)) {
    await putSheetValues({ ...options, startCell: 'A1', values: [options.defaultHeader] })
    return options.defaultHeader
  }
  const missing = [...(options.addHeaders ?? []), 'appRow' as const].filter(
    (key) => resolveColumnIndex(headerMapFor(headers), LINKED_HEADER_ALIASES[key]) === undefined,
  )
  if (!missing.length) {
    return headers
  }
  let lastUsed = headers.length - 1
  while (lastUsed >= 0 && !headers[lastUsed]) {
    lastUsed--
  }
  const added = missing.map((key) => ADDED_LINKED_HEADERS[key])
  await putSheetValues({
    ...options,
    startCell: `${columnLetter(lastUsed + 1)}1`,
    values: [added],
  })
  return [...headers.slice(0, lastUsed + 1), ...added]
}

/** Lay out cell values by 0-based column index (skipping columns the tab lacks). */
function rowFromCells(cells: [number | null, string][]): string[] {
  const row: string[] = []
  for (const [idx, value] of cells) {
    if (idx === null) continue
    while (row.length <= idx) row.push('')
    row[idx] = value
  }
  return row
}

/** An `<input type="time">` value (HH:MM) as the "h:mm AM/PM" text Sheets reads as a time. */
function formatEndTime(raw: string | undefined): string {
  const minutes = parseTimeOfDay(raw ?? '')
  return minutes === null ? (raw ?? '').trim() : formatTimeOfDay(minutes)
}

function missingHeadersError(sheetTitle: string, required: string): Error {
  return new Error(`The "${sheetTitle}" tab needs ${required} headers in row 1.`)
}

/** Append an OA or HireVue entry, creating the sibling tab (with headers) on first use. */
export async function appendAssessmentEntry(options: {
  spreadsheetId: string
  accessToken: string
  year: string
  kind: 'OA' | 'HireVue'
  input: NewAssessmentInput
}): Promise<AssessmentEntry> {
  const names = linkedTabNames(options.year)
  const sheetTitle = options.kind === 'OA' ? names.oa : names.hireVue

  const headers = await prepareLinkedTab({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle,
    defaultHeader: ASSESSMENT_HEADER_ROW,
    addHeaders: ['scheduled', 'calendarEvent'],
  })
  const { columns } = parseAssessmentSheet([headers], options.kind)
  if (!columns) {
    throw missingHeadersError(sheetTitle, 'Company and Deadline')
  }

  const deadline = formatSheetDateTime(options.input.deadline) || options.input.deadline
  const dateOffered = formatDisplayDate(options.input.dateOffered) || options.input.dateOffered
  const scheduled = formatSheetDateTime(options.input.scheduled) || (options.input.scheduled ?? '')
  const appRow = options.input.appRow ?? null
  const sheetRow = await appendRow({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle,
    row: rowFromCells([
      [columns.deadline, deadline],
      [columns.auto, formatYesNo(options.input.auto)],
      [columns.company, options.input.company],
      [columns.dateOffered, dateOffered],
      [columns.lengthMinutes, options.input.lengthMinutes],
      [columns.site, options.input.site],
      [columns.complete, 'No'],
      [columns.appRow, appRow === null ? '' : String(appRow)],
      [columns.scheduled, scheduled],
    ]),
    verifyValue: options.input.company,
  })

  return {
    kind: options.kind,
    company: options.input.company,
    deadline,
    auto: options.input.auto,
    dateOffered,
    lengthMinutes: options.input.lengthMinutes,
    site: options.input.site,
    scheduled,
    calendarEventId: '',
    complete: false,
    appRow,
    sheetRow,
  }
}

/** Append an interview entry, creating the `<year> Interviews` tab on first use. */
export async function appendInterviewEntry(options: {
  spreadsheetId: string
  accessToken: string
  year: string
  input: NewInterviewInput
}): Promise<InterviewEntry> {
  const sheetTitle = linkedTabNames(options.year).interviews

  const headers = await prepareLinkedTab({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle,
    defaultHeader: INTERVIEW_HEADER_ROW,
    addHeaders: ['endTime'],
  })
  const { columns } = parseInterviewSheet([headers])
  if (!columns) {
    throw missingHeadersError(sheetTitle, 'Company and Date & Time')
  }

  const appRow = options.input.appRow ?? null
  const dateTime = formatSheetDateTime(options.input.dateTime) || options.input.dateTime
  const endTime = formatEndTime(options.input.endTime)
  const sheetRow = await appendRow({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle,
    row: rowFromCells([
      [columns.company, options.input.company],
      [columns.dateTime, dateTime],
      [columns.endTime, endTime],
      [columns.notes, options.input.notes],
      [columns.complete, 'No'],
      [columns.appRow, appRow === null ? '' : String(appRow)],
    ]),
    verifyValue: options.input.company,
  })

  return {
    company: options.input.company,
    dateTime,
    endTime,
    notes: options.input.notes,
    complete: false,
    appRow,
    sheetRow,
  }
}

/** Append a recruiter screening entry, creating the `<year> Screening` tab on first use. */
export async function appendScreeningEntry(options: {
  spreadsheetId: string
  accessToken: string
  year: string
  input: NewScreeningInput
}): Promise<ScreeningEntry> {
  const sheetTitle = linkedTabNames(options.year).screening

  const headers = await prepareLinkedTab({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle,
    defaultHeader: SCREENING_HEADER_ROW,
    addHeaders: ['endTime'],
  })
  const { columns } = parseScreeningSheet([headers])
  if (!columns) {
    throw missingHeadersError(sheetTitle, 'Company and Date & Time')
  }

  const appRow = options.input.appRow ?? null
  const dateTime = formatSheetDateTime(options.input.dateTime) || options.input.dateTime
  const endTime = formatEndTime(options.input.endTime)
  const sheetRow = await appendRow({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle,
    row: rowFromCells([
      [columns.company, options.input.company],
      [columns.dateTime, dateTime],
      [columns.endTime, endTime],
      [columns.notes, options.input.notes],
      [columns.appRow, appRow === null ? '' : String(appRow)],
    ]),
    verifyValue: options.input.company,
  })

  return {
    company: options.input.company,
    dateTime,
    endTime,
    notes: options.input.notes,
    appRow,
    sheetRow,
  }
}

export type LinkedKind = 'OA' | 'HireVue' | 'Interview' | 'Screening'

function linkedTabTitle(year: string, kind: LinkedKind): string {
  const names = linkedTabNames(year)
  switch (kind) {
    case 'OA':
      return names.oa
    case 'HireVue':
      return names.hireVue
    case 'Interview':
      return names.interviews
    case 'Screening':
      return names.screening
  }
}

const DEFAULT_LINKED_HEADERS: Record<LinkedKind, string[]> = {
  OA: ASSESSMENT_HEADER_ROW,
  HireVue: ASSESSMENT_HEADER_ROW,
  Interview: INTERVIEW_HEADER_ROW,
  Screening: SCREENING_HEADER_ROW,
}

/** Set an existing linked entry's App Row (adding the column to the tab if needed). */
export async function updateLinkedAppRow(options: {
  spreadsheetId: string
  accessToken: string
  year: string
  kind: LinkedKind
  sheetRow: number
  appRow: number
}): Promise<void> {
  const sheetTitle = linkedTabTitle(options.year, options.kind)
  const headers = await prepareLinkedTab({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle,
    defaultHeader: DEFAULT_LINKED_HEADERS[options.kind],
  })
  const col = resolveColumnIndex(headerMapFor(headers), LINKED_HEADER_ALIASES.appRow)
  if (col === undefined) {
    throw missingHeadersError(sheetTitle, `an ${ADDED_LINKED_HEADERS.appRow}`)
  }
  await putSheetValues({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle,
    startCell: `${columnLetter(col)}${options.sheetRow}`,
    values: [[String(options.appRow)]],
  })
}

/**
 * After deleting year-tab row `deletedRow`, keep every linked tab's App Row
 * pointing at the same application: rows below shift up by one, and entries
 * that pointed at the deleted application are cleared.
 */
export async function shiftLinkedAppRows(options: {
  spreadsheetId: string
  accessToken: string
  year: string
  deletedRow: number
}): Promise<void> {
  const names = linkedTabNames(options.year)
  const tabs = [names.oa, names.hireVue, names.interviews, names.screening]
  const data: { range: string; values: string[][] }[] = []

  for (const sheetTitle of tabs) {
    const values = await fetchOptionalSheetValues(options.spreadsheetId, options.accessToken, sheetTitle)
    if (!values?.length) continue
    const col = resolveColumnIndex(
      headerMapFor(values[0].map((h) => String(h ?? '').trim())),
      LINKED_HEADER_ALIASES.appRow,
    )
    if (col === undefined) continue
    for (let i = 1; i < values.length; i++) {
      const appRow = parseAppRow(String(values[i][col] ?? ''))
      if (appRow === null || appRow < options.deletedRow) continue
      data.push({
        range: a1RangeForSheet(sheetTitle, `${columnLetter(col)}${i + 1}`),
        values: [[appRow === options.deletedRow ? '' : String(appRow - 1)]],
      })
    }
  }

  if (!data.length) return
  await batchPutValues(options.spreadsheetId, options.accessToken, data, 'Could not update App Row references')
}

/** Write several (possibly non-adjacent) ranges in one values:batchUpdate call. */
async function batchPutValues(
  spreadsheetId: string,
  accessToken: string,
  data: { range: string; values: string[][] }[],
  failureMessage: string,
): Promise<void> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
    },
  )
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      'Could not update the sheet. Sign out and sign in again to grant edit access to Google Sheets.',
    )
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${failureMessage} (${res.status}): ${body.slice(0, 200)}`)
  }
}

/** Write the given cells of one row (skipping columns the tab doesn't have). */
async function putRowCells(options: {
  spreadsheetId: string
  accessToken: string
  sheetTitle: string
  sheetRow: number
  cells: [number | null, string][]
}): Promise<void> {
  const data = options.cells
    .filter((cell): cell is [number, string] => cell[0] !== null)
    .map(([col, value]) => ({
      range: a1RangeForSheet(options.sheetTitle, `${columnLetter(col)}${options.sheetRow}`),
      values: [[value]],
    }))
  if (!data.length) return
  await batchPutValues(options.spreadsheetId, options.accessToken, data, 'Could not save your changes')
}

/** Overwrite an OA/HireVue entry's details (Complete, App Row and Calendar Event are left alone). */
export async function updateAssessmentEntry(options: {
  spreadsheetId: string
  accessToken: string
  year: string
  entry: AssessmentEntry
  input: NewAssessmentInput
}): Promise<AssessmentEntry> {
  const { kind } = options.entry
  const sheetTitle = linkedTabTitle(options.year, kind)
  const headers = await prepareLinkedTab({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle,
    defaultHeader: ASSESSMENT_HEADER_ROW,
    addHeaders: ['scheduled', 'calendarEvent'],
  })
  const { columns } = parseAssessmentSheet([headers], kind)
  if (!columns) {
    throw missingHeadersError(sheetTitle, 'Company and Deadline')
  }

  const deadline = formatSheetDateTime(options.input.deadline) || options.input.deadline
  const dateOffered = formatDisplayDate(options.input.dateOffered) || options.input.dateOffered
  const scheduled = formatSheetDateTime(options.input.scheduled) || (options.input.scheduled ?? '')
  await putRowCells({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle,
    sheetRow: options.entry.sheetRow,
    cells: [
      [columns.deadline, deadline],
      [columns.auto, formatYesNo(options.input.auto)],
      [columns.company, options.input.company],
      [columns.dateOffered, dateOffered],
      [columns.lengthMinutes, options.input.lengthMinutes],
      [columns.site, options.input.site],
      [columns.scheduled, scheduled],
    ],
  })

  return {
    ...options.entry,
    company: options.input.company,
    deadline,
    auto: options.input.auto,
    dateOffered,
    lengthMinutes: options.input.lengthMinutes,
    site: options.input.site,
    scheduled,
  }
}

/** Record (or clear, with '') the Google Calendar event ID for an OA/HireVue entry's scheduled time. */
export async function updateAssessmentCalendarEvent(options: {
  spreadsheetId: string
  accessToken: string
  year: string
  entry: AssessmentEntry
  eventId: string
}): Promise<void> {
  const sheetTitle = linkedTabTitle(options.year, options.entry.kind)
  const headers = await prepareLinkedTab({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle,
    defaultHeader: ASSESSMENT_HEADER_ROW,
    addHeaders: ['scheduled', 'calendarEvent'],
  })
  const { columns } = parseAssessmentSheet([headers], options.entry.kind)
  if (!columns || columns.calendarEvent === null) {
    throw missingHeadersError(sheetTitle, `a ${ADDED_LINKED_HEADERS.calendarEvent}`)
  }
  await putRowCells({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle,
    sheetRow: options.entry.sheetRow,
    // Leading apostrophe keeps Sheets from reading an all-digit ID as a number.
    cells: [[columns.calendarEvent, options.eventId ? `'${options.eventId}` : '']],
  })
}

/** Overwrite an interview/screening entry's details (Complete and App Row are left alone). */
export async function updateDateEntry<E extends InterviewEntry | ScreeningEntry>(options: {
  spreadsheetId: string
  accessToken: string
  year: string
  kind: 'Interview' | 'Screening'
  entry: E
  input: NewInterviewInput | NewScreeningInput
}): Promise<E> {
  const sheetTitle = linkedTabTitle(options.year, options.kind)
  const headers = await prepareLinkedTab({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle,
    defaultHeader: DEFAULT_LINKED_HEADERS[options.kind],
    addHeaders: ['endTime'],
  })
  const columns =
    options.kind === 'Interview' ? parseInterviewSheet([headers]).columns : parseScreeningSheet([headers]).columns
  if (!columns) {
    throw missingHeadersError(sheetTitle, 'Company and Date & Time')
  }

  const dateTime = formatSheetDateTime(options.input.dateTime) || options.input.dateTime
  const endTime = formatEndTime(options.input.endTime)
  await putRowCells({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle,
    sheetRow: options.entry.sheetRow,
    cells: [
      [columns.company, options.input.company],
      [columns.dateTime, dateTime],
      [columns.endTime, endTime],
      [columns.notes, options.input.notes],
    ],
  })

  return { ...options.entry, company: options.input.company, dateTime, endTime, notes: options.input.notes }
}

/** Local-state version of shiftLinkedAppRows. */
export function shiftAppRowAfterDelete<T extends { appRow: number | null }>(
  list: T[],
  deletedRow: number,
): T[] {
  return list.map((entry) => {
    if (entry.appRow === null || entry.appRow < deletedRow) return entry
    return { ...entry, appRow: entry.appRow === deletedRow ? null : entry.appRow - 1 }
  })
}

/** Toggle the Complete cell for an OA/HireVue or Interview entry. */
export async function updateLinkedComplete(options: {
  spreadsheetId: string
  accessToken: string
  sheetTitle: string
  sheetRow: number
  completeColumn: number
  complete: boolean
}): Promise<void> {
  await putSheetValues({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle: options.sheetTitle,
    startCell: `${columnLetter(options.completeColumn)}${options.sheetRow}`,
    values: [[formatYesNo(options.complete)]],
  })
}

/** Delete a linked-tab row (OA / HireVue / Interviews / Screening). Alias of deleteSheetRow. */
export const deleteLinkedRow = deleteSheetRow

/** True when the entry's Company matches an application's Company (case-insensitive). */
export function matchesCompany(entryCompany: string, appCompany: string): boolean {
  return entryCompany.trim().toLowerCase() === appCompany.trim().toLowerCase()
}

/**
 * The application a linked entry most likely belongs to. Entries only record a
 * company, so when there are several roles at that company, prefer the one whose
 * current status matches the stage that produces this kind of entry (Progressed
 * for an OA/HireVue, Interview for an interview), then the furthest-along one,
 * then the most recently updated.
 */
export function applicationForEntry(
  applications: Application[],
  company: string,
  preferredStatus?: ApplicationStatus,
): Application | undefined {
  const matches = applications.filter((app) => matchesCompany(app.company, company))
  if (matches.length <= 1) {
    return matches[0]
  }
  const updatedAt = (app: Application) =>
    parseSheetDate(app.lastUpdated ?? '')?.getTime() ?? parseSheetDate(app.dateApplied)?.getTime() ?? 0
  return matches.slice().sort((a, b) => {
    if (preferredStatus) {
      const aPreferred = a.status === preferredStatus ? 1 : 0
      const bPreferred = b.status === preferredStatus ? 1 : 0
      if (aPreferred !== bPreferred) {
        return bPreferred - aPreferred
      }
    }
    const rankDiff = statusRank(b.status) - statusRank(a.status)
    if (rankDiff !== 0) {
      return rankDiff
    }
    return updatedAt(b) - updatedAt(a)
  })[0]
}

/** The application an entry's App Row points at, if it's set and still the same company. */
function referencedApplication(
  entry: { company: string; appRow: number | null },
  applications: Application[],
): Application | undefined {
  if (entry.appRow === null) return undefined
  const app = applications.find((a) => a.sheetRow === entry.appRow)
  return app && matchesCompany(app.company, entry.company) ? app : undefined
}

/**
 * The application a linked entry belongs to: its App Row when that's set,
 * otherwise the best company match (see applicationForEntry).
 */
export function linkedApplicationFor(
  entry: { company: string; appRow: number | null },
  applications: Application[],
  preferredStatus?: ApplicationStatus,
): Application | undefined {
  return (
    referencedApplication(entry, applications) ??
    applicationForEntry(applications, entry.company, preferredStatus)
  )
}

/**
 * All linked OA/HireVue/Interview/Screening entries for one application. Entries
 * with an App Row show only on that application; entries without one (added
 * before the column existed) show on every application at that company.
 */
export function linkedEntriesForApplication(
  data: Pick<LinkedTrackerData, 'oaEntries' | 'hireVueEntries' | 'interviewEntries' | 'screeningEntries'>,
  app: Application,
  applications: Application[],
) {
  const belongs = (entry: { company: string; appRow: number | null }) => {
    if (!matchesCompany(entry.company, app.company)) return false
    const referenced = referencedApplication(entry, applications)
    return referenced ? referenced.sheetRow === app.sheetRow : true
  }
  return {
    oa: data.oaEntries.filter(belongs),
    hireVue: data.hireVueEntries.filter(belongs),
    interviews: data.interviewEntries.filter(belongs),
    screenings: data.screeningEntries.filter(belongs),
  }
}

export type { OaComplete }
