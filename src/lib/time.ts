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

/** Days until a future deadline (or overdue wording for a past one). */
export function formatDueInDays(deadline: Date | null, now = new Date()): string {
  if (!deadline || Number.isNaN(deadline.getTime())) {
    return 'no deadline'
  }
  const days = Math.round((startOfDay(deadline).getTime() - startOfDay(now).getTime()) / 86_400_000)
  if (days === 0) {
    return 'due today'
  }
  if (days < 0) {
    return `overdue ${Math.abs(days)}d`
  }
  if (days === 1) {
    return 'due tomorrow'
  }
  return `due in ${days}d`
}

/**
 * The actual due moment for a deadline. Deadlines carry a real time now — if one
 * was set, it's used exactly. A deadline that parsed to exactly midnight (no time
 * ever specified, e.g. typed in by hand as a bare date) is treated as due by the
 * end of that day instead.
 */
function dueMoment(deadline: Date): Date {
  const hasTime = deadline.getHours() !== 0 || deadline.getMinutes() !== 0 || deadline.getSeconds() !== 0
  return hasTime
    ? deadline
    : new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate(), 23, 59, 59, 999)
}

/** True when `deadline` falls within the next 24 hours and hasn't already passed. */
export function isDueSoon(deadline: Date | null, now = new Date()): boolean {
  if (!deadline || Number.isNaN(deadline.getTime())) {
    return false
  }
  const diffMs = dueMoment(deadline).getTime() - now.getTime()
  return diffMs >= 0 && diffMs <= 24 * 60 * 60 * 1000
}

/** True when `deadline` has already passed. */
export function isExpired(deadline: Date | null, now = new Date()): boolean {
  if (!deadline || Number.isNaN(deadline.getTime())) {
    return false
  }
  return dueMoment(deadline).getTime() < now.getTime()
}

/** True when two dates fall on the same local calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime()
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

  // HTML date / datetime-local inputs, ISO date(-time) (avoid UTC day-shift)
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (iso) {
    const hours = iso[4] !== undefined ? Number(iso[4]) : 0
    const minutes = iso[5] !== undefined ? Number(iso[5]) : 0
    const seconds = iso[6] !== undefined ? Number(iso[6]) : 0
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), hours, minutes, seconds)
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

/** Display a date, plus a time-of-day if one is actually set (e.g. "10/5/2026, 2:30 PM"). */
export function formatDisplayDateTime(value: string | Date | null | undefined): string {
  if (value == null || value === '') {
    return ''
  }
  const date = value instanceof Date ? value : parseSheetDate(String(value))
  if (!date) {
    return String(value).trim()
  }
  const datePart = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
  if (date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0) {
    return datePart
  }
  const hours24 = date.getHours()
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  const ampm = hours24 < 12 ? 'AM' : 'PM'
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${datePart}, ${hours12}:${minutes} ${ampm}`
}

/**
 * Deadline (or any date/time) formatted the way Google Sheets reliably recognizes
 * as a real date-time value on write (`M/D/YYYY h:mm AM/PM`), not literal text.
 * Falls back to the raw input when it doesn't parse, and to a date-only stamp
 * when there's no time-of-day set.
 */
export function formatSheetDateTime(value: string | Date | null | undefined): string {
  if (value == null || value === '') {
    return ''
  }
  const date = value instanceof Date ? value : parseSheetDate(String(value))
  if (!date) {
    return String(value).trim()
  }
  const datePart = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
  if (date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0) {
    return datePart
  }
  const hours24 = date.getHours()
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  const ampm = hours24 < 12 ? 'AM' : 'PM'
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${datePart} ${hours12}:${minutes} ${ampm}`
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
