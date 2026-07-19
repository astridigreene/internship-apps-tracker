export type ApplicationStatus =
  | 'Applied'
  | 'OA'
  | 'Interview'
  | 'Offer'
  | 'Rejected'

export interface Application {
  company: string
  location: string
  role: string
  dateApplied: string
  status: ApplicationStatus | string
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
  lastSynced: string
  stats: Stats
  applications: Application[]
}

export type ViewId = 'dashboard' | 'applications'
