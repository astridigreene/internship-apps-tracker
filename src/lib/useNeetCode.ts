import { useCallback, useEffect, useRef, useState } from 'react'
import type { NeetCodeData, NeetCodeProblem } from '../types'
import {
  fetchNeetCodeData,
  getSavedNeetCodeSheetId,
  NeetCodeSetupError,
  saveNeetCodeSheetId,
  setNeetCodeDone,
} from './neetcode'

/**
 * NeetCode sheet state shared by the NeetCode tab and the dashboard To-Do card:
 * loading, optimistic ticks, and a write queue that refetches once it drains so the
 * sheet's formulas re-plan the dates.
 */
export function useNeetCode(accessToken: string, userEmail: string, defaultSheetId: string) {
  const [sheetId, setSheetId] = useState<string | null>(
    () => getSavedNeetCodeSheetId(userEmail) || defaultSheetId || null,
  )
  const [data, setData] = useState<NeetCodeData | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [setupError, setSetupError] = useState<NeetCodeSetupError | null>(null)
  const [writeError, setWriteError] = useState<string | null>(null)
  /** Sheet row → done value the UI shows while its write + refetch are in flight. */
  const [pending, setPending] = useState<Map<number, boolean>>(() => new Map())
  const writeQueue = useRef<Promise<void>>(Promise.resolve())
  const inFlight = useRef(0)

  const load = useCallback(
    async (opts?: { quiet?: boolean }): Promise<boolean> => {
      if (!sheetId) {
        return false
      }
      if (!opts?.quiet) {
        setLoading(true)
      }
      try {
        const next = await fetchNeetCodeData(sheetId, accessToken)
        setData(next)
        setLoadError(null)
        setSetupError(null)
        return true
      } catch (err) {
        if (err instanceof NeetCodeSetupError) {
          setSetupError(err)
        } else {
          setLoadError(err instanceof Error ? err.message : 'Could not load the NeetCode sheet.')
        }
        return false
      } finally {
        setLoading(false)
      }
    },
    [sheetId, accessToken],
  )

  useEffect(() => {
    void load()
  }, [load])

  const isChecked = useCallback(
    (problem: NeetCodeProblem) => pending.get(problem.sheetRow) ?? problem.done,
    [pending],
  )
  const isBusy = useCallback((problem: NeetCodeProblem) => pending.has(problem.sheetRow), [pending])

  function toggle(problem: NeetCodeProblem, done: boolean) {
    if (!sheetId || !data) {
      return
    }
    const { doneColumn } = data
    setWriteError(null)
    setPending((prev) => new Map(prev).set(problem.sheetRow, done))
    inFlight.current += 1
    // Writes run one at a time; the sheet is refetched once the queue drains so the
    // planned dates/status reflect every tick.
    writeQueue.current = writeQueue.current
      .then(() => setNeetCodeDone({ spreadsheetId: sheetId, accessToken, problem, doneColumn, done }))
      .catch((err: unknown) => {
        setWriteError(err instanceof Error ? err.message : 'Could not update the sheet.')
      })
      .then(async () => {
        inFlight.current -= 1
        if (inFlight.current > 0) {
          return
        }
        await load({ quiet: true })
        // Drop optimistic values either way: on success the refetch has them, on
        // failure the row snaps back to what the sheet says.
        setPending(new Map())
      })
  }

  function connect(id: string) {
    saveNeetCodeSheetId(userEmail, id)
    setData(null)
    setSheetId(id)
  }

  function disconnect() {
    saveNeetCodeSheetId(userEmail, null)
    setData(null)
    setLoadError(null)
    setSetupError(null)
    setSheetId(null)
  }

  return {
    sheetId,
    data,
    loading,
    loadError,
    setupError,
    writeError,
    load,
    isChecked,
    isBusy,
    toggle,
    connect,
    disconnect,
  }
}

export type NeetCodeState = ReturnType<typeof useNeetCode>
