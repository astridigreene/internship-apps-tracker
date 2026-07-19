import type { Application, Stats, TrackerData } from '../types'

/** Canonical field → accepted header aliases (normalized). */
const HEADER_ALIASES: Record<string, string[]> = {
  company: ['company', 'employer', 'org', 'organization'],
  location: ['location', 'loc', 'city', 'office'],
  role: ['role', 'position', 'title', 'job', 'job title'],
  dateApplied: ['date applied', 'dateapplied', 'applied', 'applied on', 'application date'],
  status: ['status', 'stage', 'result', 'outcome', 'application status'],
}

const VALID_STATUSES = new Set(['Applied', 'OA', 'Interview', 'Offer', 'Rejected', 'N/A'])

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
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

export function parseSheetValues(values: string[][]): Application[] {
  if (!values.length) {
    throw new Error('Sheet is empty. Add a header row: Company, Location, Role, Date Applied, Status')
  }

  const headers = values[0].map((h) => String(h ?? '').trim())
  const headerMap = new Map<string, number>()
  headers.forEach((h, i) => {
    if (h) {
      headerMap.set(normalizeHeader(h), i)
    }
  })

  const columns = {
    company: resolveColumnIndex(headerMap, 'company'),
    location: resolveColumnIndex(headerMap, 'location'),
    role: resolveColumnIndex(headerMap, 'role'),
    dateApplied: resolveColumnIndex(headerMap, 'dateApplied'),
    status: resolveColumnIndex(headerMap, 'status'),
  }

  const missingLabels: string[] = []
  if (columns.company === undefined) missingLabels.push('Company')
  if (columns.location === undefined) missingLabels.push('Location')
  if (columns.role === undefined) missingLabels.push('Role')
  if (columns.dateApplied === undefined) missingLabels.push('Date Applied')
  if (columns.status === undefined) missingLabels.push('Status')

  if (missingLabels.length) {
    const found = headers.filter(Boolean).join(', ') || '(none)'
    throw new Error(
      `Sheet is missing required columns: ${missingLabels.join(', ')}. ` +
        `Found headers in row 1: ${found}. ` +
        `Make sure row 1 includes a cell literally named "Status" (dropdown values go in the rows below).`,
    )
  }

  const cellAt = (row: string[], idx: number | undefined) =>
    idx !== undefined && idx < row.length ? String(row[idx] ?? '').trim() : ''

  const apps: Application[] = []
  for (const row of values.slice(1)) {
    const company = cellAt(row, columns.company)
    const location = cellAt(row, columns.location)
    const role = cellAt(row, columns.role)
    const dateApplied = cellAt(row, columns.dateApplied)
    const status = cellAt(row, columns.status)

    if (!company && !role && !status) {
      continue
    }

    apps.push({ company, location, role, dateApplied, status })
  }

  return apps
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
  const applications = parseSheetValues(values)
  return {
    lastSynced: new Date().toISOString(),
    stats: computeStats(applications),
    applications,
  }
}

export async function fetchSheetValues(
  sheetId: string,
  accessToken: string,
): Promise<string[][]> {
  // Read a wider range in case Status isn't in column E
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/A1:Z`,
  )
  url.searchParams.set('majorDimension', 'ROWS')

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (res.status === 403 || res.status === 404) {
    throw new Error(
      'Could not read the sheet. Confirm it is shared with your Google account and the Sheet ID is correct.',
    )
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Sheets API error (${res.status}): ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as { values?: string[][] }
  return data.values ?? []
}
