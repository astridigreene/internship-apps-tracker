export const SIMPLIFY_JOBS_URL =
  'https://simplify.jobs/jobs?query=Software%20Engineering&state=United%20States&country=United%20States&category=Backend%20Engineering%3BFull-Stack%20Engineering%3BDevOps%20Engineering%3BSoftware%20Engineering&seasons=Summer%202027&mostRecent=true&excludeApplied=true&jobType=Internship&workArrangement=In%20Person%3BHybrid'

export type ApplicationStatus = 'Applied' | 'Progressed' | 'Interview' | 'Offer' | 'Rejected'

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'Applied',
  'Progressed',
  'Interview',
  'Offer',
  'Rejected',
]

export function isRejectedStatus(status: string): boolean {
  return status.trim().toLowerCase() === 'rejected'
}

/** Furthest pipeline point reached — set once, never moves backward for a rejection. */
export type HighestStage = 'Applied' | 'Progressed' | 'Interview' | 'Offer'

export const HIGHEST_STAGE_VALUES: HighestStage[] = ['Applied', 'Progressed', 'Interview', 'Offer']

export function highestStageRank(stage: string): number {
  switch (stage.trim().toLowerCase()) {
    case 'applied':
      return 1
    case 'progressed':
      return 2
    case 'interview':
      return 3
    case 'offer':
      return 4
    default:
      return 0
  }
}

/** Pipeline rank for progress comparisons (current status; Rejected ranks 0). */
export function statusRank(status: string): number {
  if (isRejectedStatus(status)) {
    return 0
  }
  return highestStageRank(status)
}

/** True when moving to a later pipeline stage (never for sideways/backward moves). */
export function isForwardProgress(fromStatus: string, toStatus: string): boolean {
  if (isRejectedStatus(toStatus)) {
    return false
  }
  return statusRank(toStatus) > statusRank(fromStatus)
}

/** Next pipeline stage, or null if already at Offer / rejected / unknown. */
export function nextPipelineStatus(status: string): ApplicationStatus | null {
  switch (status.trim().toLowerCase()) {
    case 'applied':
      return 'Progressed'
    case 'progressed':
      return 'Interview'
    case 'interview':
      return 'Offer'
    default:
      return null
  }
}

/**
 * Highest Stage after a status change. Only moves forward — rejecting keeps
 * whatever stage was already reached (this is what lets a rejected-after-OA
 * application still count as "Progressed" in stats).
 */
export function deriveHighestStageOnStatusChange(
  currentHighest: HighestStage | null,
  currentStatus: string,
  toStatus: ApplicationStatus,
): HighestStage {
  const baseline: HighestStage =
    currentHighest ?? (isRejectedStatus(currentStatus) ? 'Applied' : (currentStatus as HighestStage))
  if (isRejectedStatus(toStatus)) {
    return baseline
  }
  const toRank = highestStageRank(toStatus)
  return toRank > highestStageRank(baseline) ? (toStatus as HighestStage) : baseline
}

/**
 * Defensive fallback for a legacy 7-value status (from an un-migrated sheet).
 * Returns the new Status + the Highest Stage it implies.
 */
export function migrateLegacyStatus(raw: string): { status: ApplicationStatus; highestStage: HighestStage } {
  const collapsed = raw.trim().replace(/\s*(?:→|->|➜|⇒)\s*/g, '->')
  const normalized = collapsed.toLowerCase()
  switch (normalized) {
    case 'oa':
      return { status: 'Progressed', highestStage: 'Progressed' }
    case 'oa->rejected':
      return { status: 'Rejected', highestStage: 'Progressed' }
    case 'interview->rejected':
      return { status: 'Rejected', highestStage: 'Interview' }
    case 'rejected':
      return { status: 'Rejected', highestStage: 'Applied' }
    case 'interview':
      return { status: 'Interview', highestStage: 'Interview' }
    case 'offer':
      return { status: 'Offer', highestStage: 'Offer' }
    case 'progressed':
      return { status: 'Progressed', highestStage: 'Progressed' }
    default:
      return { status: 'Applied', highestStage: 'Applied' }
  }
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

/** Parse a sheet "Complete" cell (Yes/No, Y/N, TRUE/FALSE) into a boolean. */
export function normalizeYesNo(raw: string): boolean {
  const value = raw.trim().toLowerCase()
  return value === 'y' || value === 'yes' || value === 'true' || value === '1'
}

export function formatYesNo(value: boolean): 'Yes' | 'No' {
  return value ? 'Yes' : 'No'
}

export interface Application {
  company: string
  location: string
  role: string
  dateApplied: string
  status: ApplicationStatus | string
  /** Furthest stage ever reached; null when the sheet has no Highest Stage column. */
  highestStage: HighestStage | null
  /** When status last changed (from Last Updated column), if present. */
  lastUpdated: string | null
  /**
   * Legacy OA Complete column (N/A, N, Y). Kept for backward-compat reads only —
   * completion now lives per-entry on the OA/HireVue/Interviews tabs.
   * null when the sheet has no OA Complete column.
   */
  oaComplete: OaComplete | null
  /** 1-based row number in the Google Sheet tab (includes header offset). */
  sheetRow: number
}

/** Effective highest stage for an application, falling back when the column is absent. */
export function effectiveHighestStage(app: Application): HighestStage {
  if (app.highestStage) {
    return app.highestStage
  }
  return isRejectedStatus(app.status) ? 'Applied' : ((app.status as HighestStage) ?? 'Applied')
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
  highestStage: number | null
}

export interface Stats {
  totalApplications: number
  rejections: number
  /** Cumulative: reached Progressed or later, regardless of current status. */
  progressed: number
  /** Cumulative: reached Interview or later. */
  interviews: number
  /** Reached Offer. */
  offers: number
  rejectionRate: number
  progressedRate: number
  interviewRate: number
  offerRate: number
  /** Currently active: status is Progressed or Interview. */
  inProgress: number
}

/** A linked OA or HireVue entry (`<year> OA` / `<year> HireVue` tabs). */
export interface AssessmentEntry {
  kind: 'OA' | 'HireVue'
  company: string
  deadline: string
  auto: boolean
  dateOffered: string
  lengthMinutes: string
  site: string
  complete: boolean
  sheetRow: number
}

export interface NewAssessmentInput {
  company: string
  deadline: string
  auto: boolean
  dateOffered: string
  lengthMinutes: string
  site: string
}

/** A linked interview entry (`<year> Interviews` tab). */
export interface InterviewEntry {
  company: string
  dateTime: string
  notes: string
  complete: boolean
  sheetRow: number
}

export interface NewInterviewInput {
  company: string
  dateTime: string
  notes: string
}

/** A linked recruiter screening entry (`<year> Screening` tab). No Complete field. */
export interface ScreeningEntry {
  company: string
  dateTime: string
  notes: string
  sheetRow: number
}

export interface NewScreeningInput {
  company: string
  dateTime: string
  notes: string
}

/** Column layout for the OA/HireVue tabs (identical shape). */
export interface AssessmentSheetColumns {
  company: number
  deadline: number
  auto: number | null
  dateOffered: number | null
  lengthMinutes: number | null
  site: number | null
  complete: number | null
}

/** Column layout for the Interviews tab. */
export interface InterviewSheetColumns {
  company: number
  dateTime: number
  notes: number | null
  complete: number | null
}

/** Column layout for the Screening tab. */
export interface ScreeningSheetColumns {
  company: number
  dateTime: number
  notes: number | null
}

/** One of the four optional linked tabs for a year — present/absent tracked separately. */
export interface LinkedTabState<TColumns> {
  present: boolean
  columns: TColumns | null
}

export interface TrackerData {
  lastSynced: string | null
  stats: Stats
  applications: Application[]
  columns: SheetColumns
  oaEntries: AssessmentEntry[]
  hireVueEntries: AssessmentEntry[]
  interviewEntries: InterviewEntry[]
  screeningEntries: ScreeningEntry[]
  oaTab: LinkedTabState<AssessmentSheetColumns>
  hireVueTab: LinkedTabState<AssessmentSheetColumns>
  interviewsTab: LinkedTabState<InterviewSheetColumns>
  screeningTab: LinkedTabState<ScreeningSheetColumns>
}

export type ViewId = 'dashboard' | 'applications' | 'inProgress'

/** Bundled CRUD handlers for the OA/HireVue/Interviews/Screening linked tabs. */
export interface LinkedActions {
  addOa: (input: NewAssessmentInput) => Promise<void>
  addHireVue: (input: NewAssessmentInput) => Promise<void>
  addInterview: (input: NewInterviewInput) => Promise<void>
  addScreening: (input: NewScreeningInput) => Promise<void>
  toggleOaComplete: (entry: AssessmentEntry, complete: boolean) => Promise<void>
  toggleHireVueComplete: (entry: AssessmentEntry, complete: boolean) => Promise<void>
  toggleInterviewComplete: (entry: InterviewEntry, complete: boolean) => Promise<void>
  deleteOa: (entry: AssessmentEntry) => Promise<void>
  deleteHireVue: (entry: AssessmentEntry) => Promise<void>
  deleteInterview: (entry: InterviewEntry) => Promise<void>
  deleteScreening: (entry: ScreeningEntry) => Promise<void>
}
