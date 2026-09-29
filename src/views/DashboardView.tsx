import { useMemo, useState } from 'react'
import type {
  Application,
  ApplicationStatus,
  LinkedActions,
  NewApplicationInput,
  TrackerData,
} from '../types'
import { KpiCard } from '../components/KpiCard'
import { StatusFunnel } from '../components/StatusFunnel'
import { RecentUpdates } from '../components/RecentUpdates'
import { ToDoCard } from '../components/ToDoCard'
import { DueSoonBanner } from '../components/DueSoonBanner'
import { AppsPerDayChart } from '../components/AppsPerDayChart'
import { ApplicationDetailModal } from '../components/ApplicationDetailModal'
import { NewApplicationModal } from '../components/NewApplicationModal'
import { computeStats, linkedEntriesForCompany, matchesCompany } from '../lib/sheet'
import type { ApplicationsStatusFilter, StatusEditChange } from './ApplicationsView'

interface DashboardViewProps {
  data: TrackerData
  saving?: boolean
  adding?: boolean
  onOpenApplications: (filter: ApplicationsStatusFilter) => void
  onOpenInProgress: () => void
  onSaveStatusChanges?: (changes: StatusEditChange[]) => Promise<void>
  onAddApplication?: (application: NewApplicationInput) => Promise<void>
  linkedActions?: LinkedActions
}

function formatRate(rate: number): string {
  return `${rate.toFixed(1)}%`
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function DashboardView({
  data,
  saving,
  adding,
  onOpenApplications,
  onOpenInProgress,
  onSaveStatusChanges,
  onAddApplication,
  linkedActions,
}: DashboardViewProps) {
  const stats = useMemo(() => computeStats(data.applications), [data.applications])
  const [detailApp, setDetailApp] = useState<Application | null>(null)
  const [newOpen, setNewOpen] = useState(false)

  const detailAppLive =
    detailApp === null
      ? null
      : (data.applications.find((a) => a.sheetRow === detailApp.sheetRow) ?? detailApp)

  const detailLinked = detailAppLive ? linkedEntriesForCompany(data, detailAppLive.company) : undefined

  function openCompany(company: string) {
    const app = data.applications.find((a) => matchesCompany(a.company, company))
    if (app) {
      setDetailApp(app)
    }
  }

  async function handleDetailStatusUpdate(app: Application, toStatus: ApplicationStatus) {
    if (!onSaveStatusChanges) {
      return
    }
    await onSaveStatusChanges([
      {
        app,
        fromStatus: app.status,
        toStatus,
      },
    ])
  }

  const kpiClass = 'w-[46%] shrink-0 snap-start sm:w-[30%] lg:w-auto lg:shrink'
  const busy = Boolean(saving || adding)

  return (
    <div className="flex flex-col gap-3 lg:h-full lg:min-h-0 lg:gap-2 lg:overflow-y-auto">
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
      <NewApplicationModal
        open={newOpen}
        submitting={adding}
        onClose={() => {
          if (!adding) {
            setNewOpen(false)
          }
        }}
        onSubmit={async (application) => {
          if (!onAddApplication) {
            return
          }
          await onAddApplication(application)
          setNewOpen(false)
        }}
      />

      <DueSoonBanner
        oaEntries={data.oaEntries}
        hireVueEntries={data.hireVueEntries}
        onSelectCompany={openCompany}
      />

      <div className="flex shrink-0 items-center justify-between gap-2">
        <button
          type="button"
          onClick={onOpenInProgress}
          className="inline-flex h-11 flex-1 items-center justify-between gap-2 rounded-lg border border-app-brand/40 bg-app-brand/10 px-3.5 text-left hover:bg-app-brand/15 lg:h-9 lg:rounded lg:px-2.5"
        >
          <span className="text-[13px] font-bold text-app-brand-dark lg:text-[12px] dark:text-app-brand">
            In Progress
          </span>
          <span className="text-[16px] font-bold tabular-nums text-app-brand-dark lg:text-[14px] dark:text-app-brand">
            {stats.inProgress}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          disabled={!onAddApplication || busy}
          title="Add new application"
          aria-label="Add new application"
          className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-app-brand px-3 text-[13px] font-bold text-white hover:bg-app-brand-dark disabled:cursor-not-allowed disabled:opacity-40 lg:h-9 lg:rounded lg:px-2.5 lg:text-[12px] dark:text-teal-950"
        >
          <PlusIcon />
          New
        </button>
      </div>

      <div className="-mx-3 flex shrink-0 gap-2 overflow-x-auto px-3 pb-0.5 snap-x snap-mandatory [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0 lg:pb-0 lg:snap-none [&::-webkit-scrollbar]:hidden">
        <KpiCard
          className={kpiClass}
          compact
          tone="applied"
          label="Applied"
          value={stats.totalApplications}
          onClick={() => onOpenApplications('All')}
        />
        <KpiCard
          className={kpiClass}
          compact
          tone="oa"
          label="Progressed"
          value={stats.progressed}
          rate={formatRate(stats.progressedRate)}
          onClick={() => onOpenApplications('Progressed')}
        />
        <KpiCard
          className={kpiClass}
          compact
          tone="interview"
          label="Interview"
          value={stats.interviews}
          rate={formatRate(stats.interviewRate)}
          onClick={() => onOpenApplications('Interview')}
        />
        <KpiCard
          className={kpiClass}
          compact
          tone="offer"
          label="Offer"
          value={stats.offers}
          rate={formatRate(stats.offerRate)}
          onClick={() => onOpenApplications('Offer')}
        />
        <KpiCard
          className={kpiClass}
          compact
          tone="reject"
          label="Rejected"
          value={stats.rejections}
          rate={formatRate(stats.rejectionRate)}
          onClick={() => onOpenApplications('Rejected')}
        />
      </div>

      <div className="flex shrink-0 flex-col gap-3 lg:grid lg:h-[min(280px,38vh)] lg:grid-cols-12 lg:gap-2">
        <div className="lg:col-span-4 lg:min-h-0">
          <ToDoCard
            oaEntries={data.oaEntries}
            hireVueEntries={data.hireVueEntries}
            applications={data.applications}
            onOpenAll={onOpenInProgress}
            onSelectCompany={openCompany}
            onApplyClick={() => setNewOpen(true)}
          />
        </div>
        <div className="lg:col-span-5 lg:min-h-0">
          <StatusFunnel
            applications={data.applications}
            fill
            onSelectStage={onOpenApplications}
          />
        </div>
        <div className="lg:col-span-3 lg:min-h-0">
          <RecentUpdates
            applications={data.applications}
            limit={8}
            onSelectApplication={setDetailApp}
          />
        </div>
      </div>

      <div className="shrink-0 pb-1">
        <AppsPerDayChart applications={data.applications} />
      </div>
    </div>
  )
}
