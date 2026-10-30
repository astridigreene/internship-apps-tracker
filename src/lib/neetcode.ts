import type { NeetCodeData, NeetCodeProblem } from '../types'
import { putSheetValues } from './sheet'
import {
  buildNeetCodeData,
  CHECKLIST_TAB,
  NEXT_UP_TAB,
  NeetCodeSetupError,
  type CellValue,
} from './neetcodeParse'

export { NeetCodeSetupError } from './neetcodeParse'

const SHEET_PREFS_KEY = 'neetcode-sheet-prefs-v1'

export function neetcodeSheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/edit`
}

/**
 * Read Checklist + Next Up in one request. Unformatted values so dates come back as
 * serials and checkboxes as booleans — the schedule itself is whatever the sheet's
 * formulas computed.
 */
export async function fetchNeetCodeData(spreadsheetId: string, accessToken: string): Promise<NeetCodeData> {
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet`,
  )
  url.searchParams.append('ranges', `'${CHECKLIST_TAB}'!A1:Z`)
  url.searchParams.append('ranges', `'${NEXT_UP_TAB}'!A1:Z`)
  url.searchParams.set('majorDimension', 'ROWS')
  url.searchParams.set('valueRenderOption', 'UNFORMATTED_VALUE')
  url.searchParams.set('dateTimeRenderOption', 'SERIAL_NUMBER')

  let res: Response
  try {
    res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
  } catch {
    throw new Error('Could not reach Google Sheets. Check your connection and try again.')
  }

  if (res.status === 401) {
    throw new Error('Your Google session expired. Sign out and sign in again.')
  }
  if (res.status === 403 || res.status === 404) {
    throw new Error(
      'Could not open the NeetCode sheet. Check the sheet ID and that it is shared with your Google account.',
    )
  }
  if (res.status === 400) {
    // batchGet rejects the whole request when a named tab doesn't exist.
    throw new NeetCodeSetupError(
      `The sheet needs tabs named "${CHECKLIST_TAB}" and "${NEXT_UP_TAB}".`,
    )
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Sheets API error (${res.status}): ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as { valueRanges?: { values?: CellValue[][] }[] }
  const [checklist, nextUp] = data.valueRanges ?? []
  return buildNeetCodeData(checklist?.values ?? [], nextUp?.values ?? null)
}

/** Tick/untick a problem by writing its Checklist row's Done cell. */
export async function setNeetCodeDone(options: {
  spreadsheetId: string
  accessToken: string
  problem: NeetCodeProblem
  /** From NeetCodeData.doneColumn. */
  doneColumn: string
  done: boolean
}): Promise<void> {
  // A real checkbox needs FALSE to stay a checkbox; a typed "x" cell is just cleared.
  const value = options.done ? 'TRUE' : options.problem.doneIsCheckbox ? 'FALSE' : ''
  await putSheetValues({
    spreadsheetId: options.spreadsheetId,
    accessToken: options.accessToken,
    sheetTitle: CHECKLIST_TAB,
    startCell: `${options.doneColumn}${options.problem.sheetRow}`,
    values: [[value]],
  })
}

function loadPrefs(): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(SHEET_PREFS_KEY) ?? '{}') as Record<string, string>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function getSavedNeetCodeSheetId(email: string): string | null {
  return loadPrefs()[email.trim().toLowerCase()]?.trim() || null
}

export function saveNeetCodeSheetId(email: string, sheetId: string | null): void {
  try {
    const prefs = loadPrefs()
    const key = email.trim().toLowerCase()
    if (sheetId) {
      prefs[key] = sheetId.trim()
    } else {
      delete prefs[key]
    }
    localStorage.setItem(SHEET_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // ignore quota / private mode
  }
}
