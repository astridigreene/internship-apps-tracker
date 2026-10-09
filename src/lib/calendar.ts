const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
/** Email every guest on create/update/delete (Google's "send invitation emails"). */
const SEND_UPDATES = 'sendUpdates=all'

export interface CalendarEventInput {
  summary: string
  description: string
  /** The event's Location field; '' leaves it blank. */
  location: string
  start: Date
  durationMinutes: number
  /** Who gets the invite (Google emails it via sendUpdates=all). */
  attendeeEmail: string
}

export interface CalendarEventResult {
  id: string
  /**
   * True when the invitee is the signed-in account itself — Google puts the
   * event straight on that calendar and never emails you about your own event.
   */
  selfInvite: boolean
}

/** The token is missing the Calendar scope — fixable by re-granting access. */
export class CalendarScopeError extends Error {}

function eventBody(input: CalendarEventInput) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const end = new Date(input.start.getTime() + input.durationMinutes * 60_000)
  return {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: { dateTime: input.start.toISOString(), timeZone },
    end: { dateTime: end.toISOString(), timeZone },
    attendees: [{ email: input.attendeeEmail }],
    // Email + popup reminders on the organizer's copy (guests keep their own defaults)
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 60 },
        { method: 'popup', minutes: 15 },
      ],
    },
  }
}

/** Turn a Calendar API failure into something actionable. */
async function calendarError(res: Response, action: string): Promise<Error> {
  const body = await res.text()
  if (res.status === 401 || /insufficient.*(scope|permission)|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(body)) {
    return new CalendarScopeError(
      `Couldn't ${action}: this sign-in doesn't have Google Calendar access. Sign out, sign back in, and leave the calendar box checked.`,
    )
  }
  if (/accessNotConfigured|SERVICE_DISABLED|has not been used in project/i.test(body)) {
    return new Error(
      `Couldn't ${action}: the Google Calendar API isn't enabled for this app's Google Cloud project. Enable it in the Cloud console (APIs & Services → Library → Google Calendar API).`,
    )
  }
  return new Error(`Couldn't ${action} (${res.status}): ${body.slice(0, 200)}`)
}

/** Read the saved event and confirm the invitee actually made it onto the guest list. */
async function eventResult(res: Response, attendeeEmail: string): Promise<CalendarEventResult> {
  const data = (await res.json()) as {
    id?: string
    attendees?: { email?: string; self?: boolean }[]
  }
  if (!data.id) {
    throw new Error('Google Calendar did not return an event ID')
  }
  const invitee = data.attendees?.find((a) => a.email?.toLowerCase() === attendeeEmail.toLowerCase())
  if (!invitee) {
    throw new Error(`Google Calendar saved the event but ${attendeeEmail} isn't on its guest list`)
  }
  return { id: data.id, selfInvite: Boolean(invitee.self) }
}

/** Create an event on the signed-in user's primary calendar and email the invite. */
export async function createCalendarEvent(
  accessToken: string,
  input: CalendarEventInput,
): Promise<CalendarEventResult> {
  const res = await fetch(`${EVENTS_URL}?${SEND_UPDATES}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(eventBody(input)),
  })
  if (!res.ok) {
    throw await calendarError(res, 'send the calendar invite')
  }
  return eventResult(res, input.attendeeEmail)
}

/**
 * Update an existing event (re-sending the invite). If it was deleted from the
 * calendar in the meantime, a fresh one is created instead.
 */
export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  input: CalendarEventInput,
): Promise<CalendarEventResult> {
  const res = await fetch(`${EVENTS_URL}/${encodeURIComponent(eventId)}?${SEND_UPDATES}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...eventBody(input), status: 'confirmed' }),
  })
  if (res.status === 404 || res.status === 410) {
    return createCalendarEvent(accessToken, input)
  }
  if (!res.ok) {
    throw await calendarError(res, 'update the calendar invite')
  }
  return eventResult(res, input.attendeeEmail)
}

/** Delete an event (and email the cancellation). Already-gone events count as deleted. */
export async function deleteCalendarEvent(accessToken: string, eventId: string): Promise<void> {
  const res = await fetch(`${EVENTS_URL}/${encodeURIComponent(eventId)}?${SEND_UPDATES}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.ok || res.status === 404 || res.status === 410) {
    return
  }
  throw await calendarError(res, 'cancel the calendar invite')
}
