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
  /** Offer pay in $/hr as written in the Pay column; '' when blank or the column is absent. */
  pay: string
  /** When the offer came in (Date Offered column); '' when blank or the column is absent. */
  offerDate: string
  /** 1-based row number in the Google Sheet tab (includes header offset). */
  sheetRow: number
}

/**
 * Parse a pay cell ("45", "$45.50", "45/hr") into dollars per hour.
 * Returns null when it isn't a number.
 */
export function parsePay(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/[$,\s]/g, '')
    .replace(/\/(?:hr|hour|h)$/i, '')
  if (!cleaned) {
    return null
  }
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** "$45/hr" for display; the raw text when it isn't a number; '' when blank. */
export function formatPay(raw: string): string {
  const n = parsePay(raw)
  if (n === null) {
    return raw.trim()
  }
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}/hr`
}

/** The one return offer logged for a year (`<year> Return Offer` tab). Counts as an offer in stats. */
export interface ReturnOffer {
  company: string
  location: string
  role: string
  /** $/hr, same format as Application.pay. */
  pay: string
  /** When the return offer came in; '' when not set. */
  dateOffered: string
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
  pay: number | null
  offerDate: number | null
}

export interface Stats {
  totalApplications: number
  rejections: number
  /** Cumulative: reached Progressed or later, regardless of current status. */
  progressed: number
  /** Cumulative: reached Interview or later. */
  interviews: number
  /** Reached Offer, plus the return offer when one is logged. */
  offers: number
  rejectionRate: number
  progressedRate: number
  interviewRate: number
  /** Application offers ÷ applications (the return offer isn't from an application, so it's left out). */
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
  /** When you've planned to sit down and do it (Scheduled For column); '' when not set. */
  scheduled: string
  /** Google Calendar event ID for the scheduled time (Calendar Event column); '' when none. */
  calendarEventId: string
  complete: boolean
  /** Row of the application this belongs to on the year tab (App Row column), if recorded. */
  appRow: number | null
  sheetRow: number
}

export interface NewAssessmentInput {
  company: string
  deadline: string
  auto: boolean
  dateOffered: string
  lengthMinutes: string
  site: string
  /** Planned time to complete it, as YYYY-MM-DDTHH:MM (from `<input type="datetime-local">`); optional. */
  scheduled?: string
  /** Year-tab row of the application this belongs to. */
  appRow?: number
}

/** A linked interview entry (`<year> Interviews` tab). */
export interface InterviewEntry {
  company: string
  dateTime: string
  /** Time of day it ends (End Time column), e.g. "11:45 AM"; '' when not set. */
  endTime: string
  /** When the invite came in (Date Offered column); '' when not set. */
  dateOffered: string
  notes: string
  complete: boolean
  /** Row of the application this belongs to on the year tab (App Row column), if recorded. */
  appRow: number | null
  sheetRow: number
}

export interface NewInterviewInput {
  company: string
  dateTime: string
  /** Time of day it ends, as HH:MM (from `<input type="time">`); optional. */
  endTime?: string
  /** When the invite came in, as YYYY-MM-DD (from `<input type="date">`); optional. */
  dateOffered?: string
  notes: string
  /** Year-tab row of the application this belongs to. */
  appRow?: number
}

/** A linked recruiter screening entry (`<year> Screening` tab). No Complete field. */
export interface ScreeningEntry {
  company: string
  dateTime: string
  /** Time of day it ends (End Time column), e.g. "11:45 AM"; '' when not set. */
  endTime: string
  /** When the invite came in (Date Offered column); '' when not set. */
  dateOffered: string
  notes: string
  /** Row of the application this belongs to on the year tab (App Row column), if recorded. */
  appRow: number | null
  sheetRow: number
}

export interface NewScreeningInput {
  company: string
  dateTime: string
  /** Time of day it ends, as HH:MM (from `<input type="time">`); optional. */
  endTime?: string
  /** When the invite came in, as YYYY-MM-DD (from `<input type="date">`); optional. */
  dateOffered?: string
  notes: string
  /** Year-tab row of the application this belongs to. */
  appRow?: number
}

/** Column layout for the OA/HireVue tabs (identical shape). */
export interface AssessmentSheetColumns {
  company: number
  deadline: number
  auto: number | null
  dateOffered: number | null
  lengthMinutes: number | null
  site: number | null
  scheduled: number | null
  calendarEvent: number | null
  complete: number | null
  appRow: number | null
}

/** Column layout for the Interviews tab. */
export interface InterviewSheetColumns {
  company: number
  dateTime: number
  endTime: number | null
  dateOffered: number | null
  notes: number | null
  complete: number | null
  appRow: number | null
}

/** Column layout for the Screening tab. */
export interface ScreeningSheetColumns {
  company: number
  dateTime: number
  endTime: number | null
  dateOffered: number | null
  notes: number | null
  appRow: number | null
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
  /** This year's return offer, or null when none is logged. */
  returnOffer: ReturnOffer | null
}

/**
 * The save itself went through, but a follow-up (e.g. the calendar invite)
 * didn't. Forms should close — re-submitting an add would duplicate the row —
 * and show the message.
 */
export class SavedWithWarningError extends Error {}

export type ViewId = 'dashboard' | 'applications' | 'inProgress' | 'calendar' | 'neetcode'

export type NeetCodeDifficulty = 'E' | 'M' | 'H'

/** Bucketed from the Checklist's Status formula (Done / On track / Ahead N d / Behind +N d / Needs more time). */
export type NeetCodeStatusKind = 'done' | 'onTrack' | 'ahead' | 'behind' | 'needsTime' | 'noSlot' | 'other'

export interface NeetCodeProblem {
  /** 1-based row on the Checklist tab — what write-back targets. */
  sheetRow: number
  number: number | null
  name: string
  category: string
  difficulty: NeetCodeDifficulty | ''
  minutes: number | null
  done: boolean
  /** The Done cell held a real checkbox (boolean), so un-ticking writes FALSE rather than clearing it. */
  doneIsCheckbox: boolean
  /** ISO dates (YYYY-MM-DD), null when the sheet left them blank (e.g. no capacity slot). */
  originalDeadline: string | null
  plannedDate: string | null
  /** Status text exactly as the sheet computed it. */
  status: string
  statusKind: NeetCodeStatusKind
}

export interface NeetCodeStudyDay {
  /** ISO date, or null when the sheet has no upcoming study day. */
  date: string | null
  /** Raw cell text when it isn't a date (e.g. a message to add days). */
  label: string
  /** Problems listed for that day, matched back to Checklist rows when possible. */
  problems: { label: string; problem: NeetCodeProblem | null }[]
}

export interface NeetCodeProgress {
  done: number
  total: number
  remaining: number | null
  remainingMinutes: number | null
  originalFinish: string | null
  projectedFinish: string | null
  /** Raw text for projected finish when it isn't a date. */
  projectedFinishLabel: string
  problemsBehind: number | null
  extraMinutesNeeded: number | null
  extraMinutesPerStudyDay: number | null
}

export interface NeetCodeData {
  lastSynced: string
  problems: NeetCodeProblem[]
  /** Column letter of the Checklist's Done column (F in the template). */
  doneColumn: string
  nextDays: NeetCodeStudyDay[]
  progress: NeetCodeProgress
}

/** Bundled write handlers for the application detail popup (linked tabs + offer pay). */
export interface LinkedActions {
  /** Write an application's Pay ($/hr) cell; '' clears it. */
  updatePay: (app: Application, pay: string) => Promise<void>
  /** Write an application's offer Date Offered cell (YYYY-MM-DD from a date input); '' clears it. */
  updateOfferDate: (app: Application, date: string) => Promise<void>
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
  editAssessment: (entry: AssessmentEntry, input: NewAssessmentInput) => Promise<void>
  editInterview: (entry: InterviewEntry, input: NewInterviewInput) => Promise<void>
  editScreening: (entry: ScreeningEntry, input: NewScreeningInput) => Promise<void>
  /** Point an existing entry's App Row at an application's year-tab row. */
  linkEntry: (
    kind: 'OA' | 'HireVue' | 'Interview' | 'Screening',
    entry: AssessmentEntry | InterviewEntry | ScreeningEntry,
    appRow: number,
  ) => Promise<void>
}
