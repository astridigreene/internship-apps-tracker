const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

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
  }
}

/** Turn a Calendar API failure into something actionable. */
async function calendarError(res: Response, action: string): Promise<Error> {
  const body = await res.text()
  if (res.status === 401 || /insufficient.*(scope|permission)|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(body)) {
    return new Error(
      `Could not ${action}: Google Calendar access hasn't been granted. Sign out and sign back in, and allow calendar access.`,
    )
  }
  if (/accessNotConfigured|SERVICE_DISABLED|has not been used in project/i.test(body)) {
    return new Error(
      `Could not ${action}: the Google Calendar API isn't enabled for this app's Google Cloud project. Enable it in the Cloud console (APIs & Services → Library → Google Calendar API).`,
    )
  }
  return new Error(`Could not ${action} (${res.status}): ${body.slice(0, 200)}`)
}

/** Create an event on the signed-in user's primary calendar and send the invite. Returns the event ID. */
export async function createCalendarEvent(accessToken: string, input: CalendarEventInput): Promise<string> {
  const res = await fetch(`${EVENTS_URL}?sendUpdates=all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(eventBody(input)),
  })
  if (!res.ok) {
    throw await calendarError(res, 'create the calendar invite')
  }
  const data = (await res.json()) as { id?: string }
  if (!data.id) {
    throw new Error('Google Calendar did not return an event ID')
  }
  return data.id
}

/**
 * Update an existing event (re-sending the invite). If it was deleted from the
 * calendar in the meantime, a fresh one is created instead. Returns the event ID.
 */
export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  input: CalendarEventInput,
): Promise<string> {
  const res = await fetch(`${EVENTS_URL}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
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
  return eventId
}

/** Delete an event (and send the cancellation). Already-gone events count as deleted. */
export async function deleteCalendarEvent(accessToken: string, eventId: string): Promise<void> {
  const res = await fetch(`${EVENTS_URL}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.ok || res.status === 404 || res.status === 410) {
    return
  }
  throw await calendarError(res, 'remove the calendar invite')
}
