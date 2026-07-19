import {
  isRejectedStatus,
  type Application,
  type NewApplicationInput,
  type SheetColumns,
  type Stats,
  type TrackerData,
} from '../types'

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
  const collapsed = value.replace(/\s*(?:→|->)\s*/g, '->')
  const known = [
    'Applied',
    'OA',
    'Interview',
    'Offer',
    'Rejected',
    'OA->Rejected',
    'Interview->Rejected',
  ]
  const match = known.find((s) => s.toLowerCase() === collapsed.toLowerCase())
  return match ?? value
}

function resolveColumnIndex(
  headerMap: Map<string, number>,
  field: keyof typeof HEADER_ALIASES,
): number | undefined {
  for (const alias of HEADER_ALIASES[field]) {
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

/** List spreadsheet tabs whose titles are years (e.g. "2027", "2026"). */
export async function listYearSheets(
  spreadsheetId: string,
  accessToken: string,
): Promise<string[]> {
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`,
  )
  url.searchParams.set('fields', 'sheets.properties.title')

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
    sheets?: { properties?: { title?: string } }[]
  }

  const years = (data.sheets ?? [])
    .map((s) => s.properties?.title?.trim() ?? '')
    .filter(isYearSheetTitle)
    .sort((a, b) => Number(b) - Number(a))

  if (!years.length) {
    throw new Error(
      'No year tabs found. Name spreadsheet tabs like "2027" or "2026" (exactly four digits).',
    )
  }

  return years
}

export function parseSheetValues(values: string[][]): {
  applications: Application[]
  columns: SheetColumns
} {
  if (!values.length) {
    throw new Error(
      'Sheet is empty. Add a header row: Company, Location, Role, Date Applied, Status, Last Updated',
    )
  }

  const headers = values[0].map((h) => String(h ?? '').trim())
  const headerMap = new Map<string, number>()
  headers.forEach((h, i) => {
    if (h) {
      headerMap.set(normalizeHeader(h), i)
    }
  })

  const resolved = {
    company: resolveColumnIndex(headerMap, 'company'),
    location: resolveColumnIndex(headerMap, 'location'),
    role: resolveColumnIndex(headerMap, 'role'),
    dateApplied: resolveColumnIndex(headerMap, 'dateApplied'),
    status: resolveColumnIndex(headerMap, 'status'),
    lastUpdated: resolveColumnIndex(headerMap, 'lastUpdated'),
  }

  const missingLabels: string[] = []
  if (resolved.company === undefined) missingLabels.push('Company')
  if (resolved.location === undefined) missingLabels.push('Location')
  if (resolved.role === undefined) missingLabels.push('Role')
  if (resolved.dateApplied === undefined) missingLabels.push('Date Applied')
  if (resolved.status === undefined) missingLabels.push('Status')

  if (
    missingLabels.length ||
    resolved.company === undefined ||
    resolved.location === undefined ||
    resolved.role === undefined ||
    resolved.dateApplied === undefined ||
    resolved.status === undefined
  ) {
    const found = headers.filter(Boolean).join(', ') || '(none)'
    throw new Error(
      `Sheet is missing required columns: ${missingLabels.join(', ')}. ` +
        `Found headers in row 1: ${found}.`,
    )
  }

  const columns: SheetColumns = {
    company: resolved.company,
    location: resolved.location,
    role: resolved.role,
    dateApplied: resolved.dateApplied,
    status: resolved.status,
    lastUpdated: resolved.lastUpdated ?? null,
  }

  const cellAt = (row: string[], idx: number | undefined) =>
    idx !== undefined && idx < row.length ? String(row[idx] ?? '').trim() : ''

  const apps: Application[] = []
  for (let i = 1; i < values.length; i++) {
    const row = values[i]
    const company = cellAt(row, columns.company)
    const location = cellAt(row, columns.location)
    const role = cellAt(row, columns.role)
    const dateApplied = cellAt(row, columns.dateApplied)
    const status = normalizeStatus(cellAt(row, columns.status))
    const lastUpdated = cellAt(row, columns.lastUpdated ?? undefined) || null

    if (!company && !role && !status) {
      continue
    }

    apps.push({
      company,
      location,
      role,
      dateApplied,
      status,
      lastUpdated,
      sheetRow: i + 1,
    })
  }

  return { applications: apps, columns }
}

export function computeStats(applications: Application[]): Stats {
  const total = applications.length
  const counts = {
    Applied: 0,
    OA: 0,
    Interview: 0,
    Offer: 0,
    Rejected: 0,
  }

  for (const app of applications) {
    if (isRejectedStatus(app.status)) {
      counts.Rejected += 1
      continue
    }
    if (app.status in counts) {
      counts[app.status as keyof typeof counts] += 1
    }
  }

  const rate = (count: number) =>
    total === 0 ? 0 : Math.round((count / total) * 1000) / 10

  return {
    totalApplications: total,
    rejections: counts.Rejected,
    oas: counts.OA,
    interviews: counts.Interview,
    offers: counts.Offer,
    rejectionRate: rate(counts.Rejected),
    oaRate: rate(counts.OA),
    interviewRate: rate(counts.Interview),
    offerRate: rate(counts.Offer),
  }
}

export function buildTrackerData(values: string[][]): TrackerData {
  const { applications, columns } = parseSheetValues(values)
  return {
    lastSynced: new Date().toISOString(),
    stats: computeStats(applications),
    applications,
    columns,
  }
}

export async function fetchSheetValues(
  spreadsheetId: string,
  accessToken: string,
  sheetTitle: string,
): Promise<string[][]> {
  const range = a1RangeForSheet(sheetTitle)
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
 * Ensure a "Last Updated" header exists on the year tab.
 * Returns the 0-based column index.
 */
export async function ensureLastUpdatedColumn(options: {
  spreadsheetId: string
  accessToken: string
  sheetTitle: string
  headerRow: string[]
}): Promise<number> {
  const headerMap = new Map<string, number>()
  options.headerRow.forEach((h, i) => {
    const key = normalizeHeader(String(h ?? ''))
    if (key) {
      headerMap.set(key, i)
    }
  })

  const existing = resolveColumnIndex(headerMap, 'lastUpdated')
  if (existing !== undefined) {
    return existing
  }

  let nextIndex = options.headerRow.length
  while (
    nextIndex > 0 &&
    !String(options.headerRow[nextIndex - 1] ?? '').trim()
  ) {
    nextIndex -= 1
  }

  await putSheetValues({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle: options.sheetTitle,
    startCell: `${columnLetter(nextIndex)}1`,
    values: [['Last Updated']],
  })

  return nextIndex
}

/** Update Status (+ Last Updated when a column exists or can be created). */
export async function updateSheetStatus(options: {
  spreadsheetId: string
  accessToken: string
  sheetTitle: string
  sheetRow: number
  columns: SheetColumns
  status: string
  lastUpdatedStamp: string
}): Promise<SheetColumns> {
  await putSheetValues({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle: options.sheetTitle,
    startCell: `${columnLetter(options.columns.status)}${options.sheetRow}`,
    values: [[options.status]],
  })

  let lastUpdatedCol = options.columns.lastUpdated
  if (lastUpdatedCol === null) {
    const headerValues = await fetchSheetValues(
      options.spreadsheetId,
      options.accessToken,
      options.sheetTitle,
    )
    lastUpdatedCol = await ensureLastUpdatedColumn({
      spreadsheetId: options.spreadsheetId,
      accessToken: options.accessToken,
      sheetTitle: options.sheetTitle,
      headerRow: headerValues[0] ?? [],
    })
  }

  await putSheetValues({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle: options.sheetTitle,
    startCell: `${columnLetter(lastUpdatedCol)}${options.sheetRow}`,
    values: [[options.lastUpdatedStamp]],
  })

  return { ...options.columns, lastUpdated: lastUpdatedCol }
}

function assertCompleteApplication(input: NewApplicationInput): NewApplicationInput {
  const company = input.company.trim()
  const location = input.location.trim()
  const role = input.role.trim()
  const dateApplied = input.dateApplied.trim()
  const status = input.status

  if (!company || !location || !role || !dateApplied || !status) {
    throw new Error(
      'All fields are required: Company, Location, Role, Date Applied, and Status.',
    )
  }

  return { company, location, role, dateApplied, status }
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
  if (columns.lastUpdated === null) {
    const headerValues = await fetchSheetValues(
      options.spreadsheetId,
      options.accessToken,
      options.sheetTitle,
    )
    const lastUpdated = await ensureLastUpdatedColumn({
      spreadsheetId: options.spreadsheetId,
      accessToken: options.accessToken,
      sheetTitle: options.sheetTitle,
      headerRow: headerValues[0] ?? [],
    })
    columns = { ...columns, lastUpdated }
  }

  const width = Math.max(
    columns.company,
    columns.location,
    columns.role,
    columns.dateApplied,
    columns.status,
    columns.lastUpdated ?? 0,
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
}): Promise<number> {
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(options.spreadsheetId)}`,
  )
  url.searchParams.set('fields', 'sheets.properties(sheetId,title)')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${options.accessToken}` },
  })

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      'Could not update the sheet. Sign out and sign in again to grant edit access to Google Sheets.',
    )
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Sheets API error (${res.status}): ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    sheets?: { properties?: { sheetId?: number; title?: string } }[]
  }

  const match = (data.sheets ?? []).find(
    (s) => (s.properties?.title ?? '').trim() === options.sheetTitle,
  )
  const sheetId = match?.properties?.sheetId
  if (sheetId === undefined || sheetId === null) {
    throw new Error(`Could not find sheet tab "${options.sheetTitle}".`)
  }
  return sheetId
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
