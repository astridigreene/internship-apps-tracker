import type { AssessmentEntry, NewAssessmentInput } from '../types'
import { parseSheetDate, toDateInputValue, toDateTimeInputValue } from './time'

/** An entry's sheet values in the shapes the form inputs expect. */
export function assessmentFormFromEntry(entry: AssessmentEntry): NewAssessmentInput {
  const deadline = parseSheetDate(entry.deadline)
  const offered = parseSheetDate(entry.dateOffered)
  const scheduled = parseSheetDate(entry.scheduled)
  return {
    company: entry.company,
    deadline: deadline ? toDateTimeInputValue(deadline) : entry.deadline,
    auto: entry.auto,
    dateOffered: offered ? toDateInputValue(offered) : entry.dateOffered,
    lengthMinutes: entry.lengthMinutes,
    site: entry.site,
    scheduled: scheduled ? toDateTimeInputValue(scheduled) : entry.scheduled,
  }
}
