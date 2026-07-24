/** Elapsed time in whole days since `then`. */
export function formatElapsedDays(
  then: Date | string | null | undefined,
  now = new Date(),
): string {
  const date = then instanceof Date ? then : then ? parseSheetDate(String(then)) : null
  if (!date || Number.isNaN(date.getTime())) {
    return 'no timestamp'
  }

  let ms = now.getTime() - date.getTime()
  if (ms < 0) {
    ms = 0
  }

  const days = Math.floor(ms / 86_400_000)
  if (days === 0) {
    return 'today'
  }
  if (days === 1) {
    return '1 day ago'
  }
  return `${days} days ago`
}

/** Parse a Google Sheets cell value into a Date (formatted strings or serials). */
export function parseSheetDate(value: string): Date | null {
  const raw = value.trim()
  if (!raw) {
    return null
  }

  const asNumber = Number(raw)
  if (!Number.isNaN(asNumber) && asNumber > 20_000 && asNumber < 100_000) {
    // Sheets serial date (days since 1899-12-30)
    const ms = Date.UTC(1899, 11, 30) + asNumber * 86_400_000
    return new Date(ms)
  }

  // Prefer M/D/YYYY (with optional time) over locale-ambiguous Date parsing
  const mdy = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i,
  )
  if (mdy) {
    const month = Number(mdy[1]) - 1
    const day = Number(mdy[2])
    const year = Number(mdy[3])
    let hours = mdy[4] !== undefined ? Number(mdy[4]) : 0
    const minutes = mdy[5] !== undefined ? Number(mdy[5]) : 0
    const seconds = mdy[6] !== undefined ? Number(mdy[6]) : 0
    const ampm = mdy[7]?.toUpperCase()
    if (ampm === 'PM' && hours < 12) {
      hours += 12
    }
    if (ampm === 'AM' && hours === 12) {
      hours = 0
    }
    const date = new Date(year, month, day, hours, minutes, seconds)
    return Number.isNaN(date.getTime()) ? null : date
  }

  // HTML date inputs / ISO date-only (avoid UTC day-shift)
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/)
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    return Number.isNaN(date.getTime()) ? null : date
  }

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Display / sheet dates as M/D/YYYY (e.g. 7/19/2026). */
export function formatDisplayDate(value: string | Date | null | undefined): string {
  if (value == null || value === '') {
    return ''
  }
  const date = value instanceof Date ? value : parseSheetDate(String(value))
  if (!date) {
    return String(value).trim()
  }
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

/** Stamp written into the Last Updated column (M/D/YYYY). */
export function statusUpdateStamp(now = new Date()): string {
  return formatDisplayDate(now)
}

/** Local calendar date as YYYY-MM-DD (for `<input type="date">`). */
export function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Midnight local time for a Date or YYYY-MM-DD string. */
export function startOfDay(value: Date | string): Date {
  if (typeof value === 'string') {
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (iso) {
      return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    }
    const parsed = parseSheetDate(value)
    if (parsed) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
    }
  }
  const date = value instanceof Date ? value : new Date()
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Inclusive start of the calendar month containing `date`. */
export function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/** Inclusive end of the calendar month containing `date` (midnight that day). */
export function endOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

/** Whole calendar days between two local midnights (can be negative). */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = startOfDay(from).getTime()
  const b = startOfDay(to).getTime()
  return Math.round((b - a) / 86_400_000)
}
