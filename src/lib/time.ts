/** Elapsed time in whole days since `then`. */
export function formatElapsedDays(
  then: Date | string | null | undefined,
  now = new Date(),
): string {
  const date = then instanceof Date ? then : then ? new Date(then) : null
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

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Stamp written into the Last Updated column. */
export function statusUpdateStamp(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  )
}
