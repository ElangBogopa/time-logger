import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

interface CalendarEvent {
  id: string
  summary: string
  start: {
    dateTime?: string
    date?: string
  }
  end: {
    dateTime?: string
    date?: string
  }
}

interface GoogleCalendarResponse {
  items: CalendarEvent[]
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

    // Get date from query params (default to today)
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')

    // Create date range for the requested date
    const targetDate = dateParam ? new Date(dateParam + 'T00:00:00') : new Date()
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    // Fetch events from Google Calendar
    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        new URLSearchParams({
          timeMin: startOfDay.toISOString(),
          timeMax: endOfDay.toISOString(),
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
          // Timed event
          const startDate = new Date(event.start.dateTime)
          const endDate = new Date(event.end.dateTime || event.start.dateTime)
          startTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
          endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
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
