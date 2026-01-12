import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

interface CalendarEvent {
  id: string
  summary: string
  start: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  end: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
}

interface GoogleCalendarResponse {
  items: CalendarEvent[]
}

// Format a date to HH:MM in the specified timezone
function formatTimeInTimezone(isoString: string, timezone: string): string {
  try {
    const date = new Date(isoString)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const parts = formatter.formatToParts(date)
    const hour = parts.find(p => p.type === 'hour')?.value || '00'
    const minute = parts.find(p => p.type === 'minute')?.value || '00'
    return `${hour}:${minute}`
  } catch {
    // Fallback if timezone is invalid
    const date = new Date(isoString)
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }
}

// Get ISO timestamp for start/end of day in a specific timezone
function getTimestampForTimezone(dateStr: string, time: 'start' | 'end', timezone: string): string {
  // Parse the date string (YYYY-MM-DD)
  const [year, month, day] = dateStr.split('-').map(Number)

  // Create a date object for the given date at midnight or end of day
  // We need to find what UTC time corresponds to midnight in the target timezone

  // Use a reference date to calculate the offset
  const hour = time === 'start' ? 0 : 23
  const minute = time === 'start' ? 0 : 59
  const second = time === 'start' ? 0 : 59

  // Create formatter to get the offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'shortOffset',
  })

  // Start with a rough estimate - create a date at the target local time
  // assuming UTC, then we'll adjust
  const roughDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second))

  // Get what date/time this is in the target timezone
  const parts = formatter.formatToParts(roughDate)
  const tzHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10)
  const tzDay = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10)

  // Calculate the offset in hours (rough approximation)
  // The difference tells us how far off we are
  let hourDiff = tzHour - hour
  const dayDiff = tzDay - day

  // Adjust for day boundary crossing
  if (dayDiff !== 0) {
    hourDiff += dayDiff * 24
  }

  // Apply the correction
  const correctedDate = new Date(roughDate.getTime() - hourDiff * 60 * 60 * 1000)

  return correctedDate.toISOString()
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated or missing calendar access' },
        { status: 401 }
      )
    }

    // Get date and timezone from query params
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const timezone = searchParams.get('timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone

    // Use the date parameter directly
    const targetDate = dateParam || new Date().toISOString().split('T')[0]

    // Calculate the UTC timestamps for the start and end of the day in the user's timezone
    const timeMin = getTimestampForTimezone(targetDate, 'start', timezone)
    const timeMax = getTimestampForTimezone(targetDate, 'end', timezone)

    // Fetch events from Google Calendar with timezone parameter
    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        new URLSearchParams({
          timeMin,
          timeMax,
          timeZone: timezone,
          singleEvents: 'true',
          orderBy: 'startTime',
        }),
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    )

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text()
      console.error('Google Calendar API error:', errorText)

      if (calendarResponse.status === 401) {
        return NextResponse.json(
          { error: 'Calendar access token expired. Please sign out and sign in again.' },
          { status: 401 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to fetch calendar events' },
        { status: 500 }
      )
    }

    const data: GoogleCalendarResponse = await calendarResponse.json()

    // Transform events to a simpler format
    const events = (data.items || [])
      .filter((event) => event.summary && (event.start.dateTime || event.start.date))
      .map((event) => {
        // Handle both timed events and all-day events
        let startTime = ''
        let endTime = ''

        if (event.start.dateTime) {
          // Timed event - convert to user's timezone
          startTime = formatTimeInTimezone(event.start.dateTime, timezone)
          endTime = formatTimeInTimezone(event.end.dateTime || event.start.dateTime, timezone)
        }

        return {
          id: event.id,
          title: event.summary,
          startTime,
          endTime,
          isAllDay: !event.start.dateTime,
        }
      })

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Calendar fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { status: 500 }
    )
  }
}
