export const SIMPLIFY_JOBS_URL =
  'https://simplify.jobs/jobs?query=Software%20Engineering&state=United%20States&country=United%20States&category=Backend%20Engineering%3BFull-Stack%20Engineering%3BDevOps%20Engineering%3BSoftware%20Engineering&seasons=Summer%202027&mostRecent=true&excludeApplied=true&jobType=Internship&workArrangement=In%20Person%3BHybrid'

export type ApplicationStatus =
  | 'Applied'
  | 'OA'
  | 'Interview'
  | 'Offer'
  | 'Rejected'
  | 'OA->Rejected'
  | 'Interview->Rejected'

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'Applied',
  'OA',
  'Interview',
  'Offer',
  'Rejected',
  'OA->Rejected',
  'Interview->Rejected',
]

/** Any status that means the application ended in rejection. */
export const REJECTION_STATUSES: readonly ApplicationStatus[] = [
  'Rejected',
  'OA->Rejected',
  'Interview->Rejected',
]

export function isRejectedStatus(status: string): boolean {
  const normalized = status
    .trim()
    .toLowerCase()
    .replace(/\s*(?:→|->|➜|⇒)\s*/g, '->')
  return (
    normalized === 'rejected' ||
    normalized.endsWith('->rejected') ||
    /\breject/.test(normalized)
  )
}

/** Pipeline rank for progress comparisons. Higher = further along. */
export function statusRank(status: string): number {
  const normalized = status
    .trim()
    .toLowerCase()
    .replace(/\s*(?:→|->)\s*/g, '->')

  switch (normalized) {
    case 'applied':
      return 1
    case 'oa':
      return 2
    case 'interview':
      return 3
    case 'offer':
      return 4
    default:
      // Rejections / unknown statuses don't count as forward stages
      return 0
  }
}

/** True when moving to a later pipeline stage (never for sideways or backward moves). */
export function isForwardProgress(fromStatus: string, toStatus: string): boolean {
  if (isRejectedStatus(toStatus)) {
    return false
  }
  return statusRank(toStatus) > statusRank(fromStatus)
}

function normalizeStatusKey(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .replace(/\s*(?:→|->|➜|⇒)\s*/g, '->')
}

/** Next pipeline stage, or null if already at Offer / rejected / unknown. */
export function nextPipelineStatus(status: string): ApplicationStatus | null {
  switch (normalizeStatusKey(status)) {
    case 'applied':
      return 'OA'
    case 'oa':
      return 'Interview'
    case 'interview':
      return 'Offer'
    default:
      return null
  }
}

/**
 * Rejection status that matches the current stage
 * (OA → OA->Rejected, Interview → Interview->Rejected, else Rejected).
 */
export function rejectionStatusFor(status: string): ApplicationStatus {
  const normalized = normalizeStatusKey(status)
  if (normalized === 'oa') {
    return 'OA->Rejected'
  }
  if (normalized === 'interview') {
    return 'Interview->Rejected'
  }
  if (isRejectedStatus(status)) {
    if (normalized === 'oa->rejected') {
      return 'OA->Rejected'
    }
    if (normalized === 'interview->rejected') {
      return 'Interview->Rejected'
    }
    return 'Rejected'
  }
  return 'Rejected'
}

export type OaComplete = 'N/A' | 'N' | 'Y'

export const OA_COMPLETE_VALUES: OaComplete[] = ['N/A', 'N', 'Y']

export function normalizeOaComplete(raw: string): OaComplete {
  const value = raw.trim().toUpperCase().replace(/\s+/g, '')
  if (value === 'Y' || value === 'YES') {
    return 'Y'
  }
  if (value === 'N' || value === 'NO') {
    return 'N'
  }
  return 'N/A'
}

/** True when this OA still needs to be completed (OA Complete === N). */
export function isOaIncomplete(oaComplete: OaComplete | null): boolean {
  return oaComplete === 'N'
}

export interface Application {
  company: string
  location: string
  role: string
  dateApplied: string
  status: ApplicationStatus | string
  /** When status last changed (from Last Updated column), if present. */
  lastUpdated: string | null
  /**
   * OA Complete column (N/A, N, Y).
   * null when the sheet has no OA Complete column.
   */
  oaComplete: OaComplete | null
  /** 1-based row number in the Google Sheet tab (includes header offset). */
  sheetRow: number
}

/** Required fields when creating a new application. */
export interface NewApplicationInput {
  company: string
  location: string
  role: string
  dateApplied: string
  status: ApplicationStatus
}

export interface SheetColumns {
  company: number
  location: number
  role: number
  dateApplied: number
  status: number
  lastUpdated: number | null
  oaComplete: number | null
}

export interface Stats {
  totalApplications: number
  rejections: number
  oas: number
  interviews: number
  offers: number
  rejectionRate: number
  oaRate: number
  interviewRate: number
  offerRate: number
}

export interface TrackerData {
  lastSynced: string | null
  stats: Stats
  applications: Application[]
  columns: SheetColumns
}

export type ViewId = 'dashboard' | 'applications'
