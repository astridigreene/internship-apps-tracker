import { useMemo, useState } from 'react'
import type { Application } from '../types'
import { StatusPill } from '../components/StatusPill'

type SortKey = 'company' | 'location' | 'role' | 'dateApplied' | 'status'
type SortDir = 'asc' | 'desc'

const STATUS_OPTIONS = ['All', 'Applied', 'OA', 'Interview', 'Offer', 'Rejected'] as const

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'company', label: 'Company' },
  { key: 'location', label: 'Location' },
  { key: 'role', label: 'Role' },
  { key: 'dateApplied', label: 'Date Applied' },
  { key: 'status', label: 'Status' },
]

interface ApplicationsViewProps {
  applications: Application[]
}

function parseDate(value: string): number {
  const t = Date.parse(value)
  return Number.isNaN(t) ? 0 : t
}

function compareApps(a: Application, b: Application, key: SortKey, dir: SortDir): number {
  let cmp = 0
  if (key === 'dateApplied') {
    cmp = parseDate(a.dateApplied) - parseDate(b.dateApplied)
  } else {
    cmp = String(a[key] ?? '').localeCompare(String(b[key] ?? ''), undefined, {
      sensitivity: 'base',
    })
  }
  return dir === 'asc' ? cmp : -cmp
}

export function ApplicationsView({ applications }: ApplicationsViewProps) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>('All')
  const [sortKey, setSortKey] = useState<SortKey>('dateApplied')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return applications
      .filter((app) => {
        if (statusFilter !== 'All' && app.status !== statusFilter) {
          return false
        }
        if (!q) {
          return true
        }
        return (
          app.company.toLowerCase().includes(q) ||
          app.location.toLowerCase().includes(q) ||
          app.role.toLowerCase().includes(q) ||
          app.status.toLowerCase().includes(q)
        )
      })
      .slice()
      .sort((a, b) => compareApps(a, b, sortKey, sortDir))
  }, [applications, query, statusFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'dateApplied' ? 'desc' : 'asc')
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="text-[11px] font-bold tracking-wider text-slds-text-weak uppercase">
            Search
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Company, role, location…"
            className="h-8 rounded-[2px] border border-slds-border bg-slds-surface px-2 text-sm text-slds-text outline-none placeholder:text-slds-text-weak focus:border-slds-brand"
          />
        </label>
        <label className="flex w-40 flex-col gap-1">
          <span className="text-[11px] font-bold tracking-wider text-slds-text-weak uppercase">
            Status
          </span>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as (typeof STATUS_OPTIONS)[number])
            }
            className="h-8 rounded-[2px] border border-slds-border bg-slds-surface px-2 text-sm text-slds-text outline-none focus:border-slds-brand"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        <p className="pb-1.5 text-xs text-slds-text-weak tabular-nums">
          {filtered.length} of {applications.length}
        </p>
      </div>

      <div className="overflow-auto rounded-[2px] border border-slds-border bg-slds-surface">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slds-border bg-[#fafaf9]">
              {COLUMNS.map((col) => {
                const active = sortKey === col.key
                return (
                  <th key={col.key} className="px-3 py-0 font-semibold text-slds-text-weak">
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex h-9 w-full items-center gap-1 text-[11px] tracking-wider uppercase hover:text-slds-text"
                    >
                      {col.label}
                      <span
                        className={`text-[10px] ${active ? 'text-slds-brand' : 'text-slds-border-strong'}`}
                        aria-hidden
                      >
                        {active ? (sortDir === 'asc' ? '▲' : '▼') : '▾'}
                      </span>
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-3 py-6 text-center text-slds-text-weak"
                >
                  No applications match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((app, i) => (
                <tr
                  key={`${app.company}-${app.role}-${app.dateApplied}-${i}`}
                  className="h-9 border-b border-slds-border last:border-b-0 hover:bg-slds-hover"
                >
                  <td className="px-3 py-0 font-medium text-slds-text">{app.company}</td>
                  <td className="px-3 py-0 text-slds-text">{app.location}</td>
                  <td className="px-3 py-0 text-slds-text">{app.role}</td>
                  <td className="px-3 py-0 whitespace-nowrap text-slds-text tabular-nums">
                    {app.dateApplied}
                  </td>
                  <td className="px-3 py-0">
                    <StatusPill status={app.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
