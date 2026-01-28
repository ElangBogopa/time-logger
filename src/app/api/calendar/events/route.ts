import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'

// Helper to verify token has required scopes
async function verifyTokenScopes(accessToken: string): Promise<{ valid: boolean; scopes: string[]; tokenInvalid: boolean }> {
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`)
    if (!response.ok) {
      // 400 = token expired/revoked/invalid (not a scope issue)
      console.error('[Calendar Events] Token verification failed:', response.status)
      return { valid: false, scopes: [], tokenInvalid: true }
    }
    const data = await response.json()
    const scopes = (data.scope || '').split(' ')
    const hasCalendarScope = scopes.some((s: string) =>
      s.includes('calendar.readonly') || s.includes('calendar')
    )
    console.log('[Calendar Events] Token scopes:', scopes, 'Has calendar:', hasCalendarScope)
    return { valid: hasCalendarScope, scopes, tokenInvalid: false }
  } catch (error) {
    console.error('[Calendar Events] Token verification error:', error)
    return { valid: false, scopes: [], tokenInvalid: true }
  }
}

// Helper to get access token - either from JWT token (Google OAuth) or calendar_connections (email users)
async function getCalendarAccessToken(
  token: { accessToken?: string } | null,
  session: {
    user?: { id?: string }
    authProvider?: string
  }
): Promise<{ accessToken: string | null; source: 'session' | 'connection' | null }> {
  // Google OAuth users have token in JWT
  if (session.authProvider === 'google' && token?.accessToken) {
    console.log('[Calendar Events] Using JWT token for Google OAuth user')
    return { accessToken: token.accessToken, source: 'session' }
  }

  // Email users - check calendar_connections
  if (session.user?.id) {
    console.log('[Calendar Events] Checking calendar_connections for user:', session.user.id)
    const { data: connection, error: connError } = await supabase
      .from('calendar_connections')
      .select('google_access_token, google_refresh_token, token_expires_at, google_email')
      .eq('user_id', session.user.id)
      .single()

    if (connError) {
      console.log('[Calendar Events] No calendar connection found:', connError.message)
    }

    if (connection) {
      console.log('[Calendar Events] Found connection for:', connection.google_email, 'Expires:', connection.token_expires_at)

      // Check if token is expired
      const isExpired = connection.token_expires_at &&
        new Date(connection.token_expires_at) < new Date()

      if (isExpired && connection.google_refresh_token) {
        console.log('[Calendar Events] Token expired, refreshing...')
        // Refresh the token
        try {
          const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              grant_type: 'refresh_token',
              refresh_token: connection.google_refresh_token,
            }),
          })

          const refreshedTokens = await refreshResponse.json()
          console.log('[Calendar Events] Refresh response:', refreshResponse.ok, 'Has token:', !!refreshedTokens.access_token)

          if (refreshResponse.ok && refreshedTokens.access_token) {
            // Update the stored token
            const expiresAt = refreshedTokens.expires_in
              ? new Date(Date.now() + refreshedTokens.expires_in * 1000).toISOString()
              : null

            await supabase
              .from('calendar_connections')
              .update({
                google_access_token: refreshedTokens.access_token,
                token_expires_at: expiresAt,
              })
              .eq('user_id', session.user.id)

            return { accessToken: refreshedTokens.access_token, source: 'connection' }
          } else {
            console.error('[Calendar Events] Token refresh failed:', refreshedTokens)
          }
        } catch (error) {
          console.error('[Calendar Events] Failed to refresh calendar token:', error)
        }
      }

      return { accessToken: connection.google_access_token, source: 'connection' }
    }
  }

  return { accessToken: null, source: null }
}

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

// Format a date to YYYY-MM-DD in the specified timezone
function formatDateInTimezone(isoString: string, timezone: string): string {
  try {
    const date = new Date(isoString)
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return formatter.format(date) // en-CA locale gives YYYY-MM-DD format
  } catch {
    // Fallback if timezone is invalid
    const date = new Date(isoString)
    return date.toISOString().split('T')[0]
  }
}

// Valid IANA timezone validation
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

// Get ISO timestamp for start/end of day in a specific timezone
// This handles DST transitions correctly by using binary search for precise offset calculation
function getTimestampForTimezone(dateStr: string, time: 'start' | 'end', timezone: string): string {
  // Parse the date string (YYYY-MM-DD)
  const [year, month, day] = dateStr.split('-').map(Number)

  // Target local time
  const targetHour = time === 'start' ? 0 : 23
  const targetMinute = time === 'start' ? 0 : 59
  const targetSecond = time === 'start' ? 0 : 59

  // Helper to get local time parts in target timezone
  const getLocalParts = (utcDate: Date) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const parts = formatter.formatToParts(utcDate)
    return {
      year: parseInt(parts.find(p => p.type === 'year')?.value || '0', 10),
      month: parseInt(parts.find(p => p.type === 'month')?.value || '0', 10),
      day: parseInt(parts.find(p => p.type === 'day')?.value || '0', 10),
      hour: parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10),
      minute: parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10),
      second: parseInt(parts.find(p => p.type === 'second')?.value || '0', 10),
    }
  }

  // Calculate value for comparison (allows comparing dates and times)
  const toValue = (y: number, m: number, d: number, h: number, min: number, s: number) =>
    y * 10000000000 + m * 100000000 + d * 1000000 + h * 10000 + min * 100 + s

  const targetValue = toValue(year, month, day, targetHour, targetMinute, targetSecond)

  // Binary search to find the UTC time that corresponds to target local time
  // Search within a 48-hour window centered around a rough estimate
  let low = Date.UTC(year, month - 1, day - 1, targetHour, targetMinute, targetSecond)
  let high = Date.UTC(year, month - 1, day + 1, targetHour, targetMinute, targetSecond)

  // Binary search with 1-second precision
  while (high - low > 1000) {
    const mid = Math.floor((low + high) / 2)
    const midDate = new Date(mid)
    const localParts = getLocalParts(midDate)
    const localValue = toValue(
      localParts.year, localParts.month, localParts.day,
      localParts.hour, localParts.minute, localParts.second
    )

    if (localValue < targetValue) {
      low = mid
    } else {
      high = mid
    }
  }

  // Return the result (use high as it's the closest match at or after target)
  return new Date(high).toISOString()
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get access token from JWT or calendar_connections
    console.log('[Calendar Events] User ID:', session.user.id, 'Auth provider:', session.authProvider)
    const token = await getToken({ req: request })
    const { accessToken, source } = await getCalendarAccessToken(token, session)
    console.log('[Calendar Events] Access token source:', source, 'Has token:', !!accessToken)

    if (!accessToken) {
      console.log('[Calendar Events] No access token found')
      return NextResponse.json(
        { error: 'No calendar connected', code: 'NO_CALENDAR' },
        { status: 401 }
      )
    }

    // Verify token has calendar scope (helps diagnose issues)
    const scopeCheck = await verifyTokenScopes(accessToken)
    if (!scopeCheck.valid) {
      if (scopeCheck.tokenInvalid) {
        // Token is expired/revoked — client should trigger re-auth
        console.error('[Calendar Events] Token expired or invalid')
        return NextResponse.json(
          {
            error: 'Calendar access token expired. Please sign out and sign in again.',
            code: 'TOKEN_EXPIRED',
          },
          { status: 401 }
        )
      }
      // Token is valid but lacks calendar scope
      console.error('[Calendar Events] Token missing calendar scope! Scopes:', scopeCheck.scopes)
      return NextResponse.json(
        {
          error: 'Calendar permission not granted. Please disconnect and reconnect your calendar.',
          code: 'SCOPE_INSUFFICIENT',
          scopes: scopeCheck.scopes
        },
        { status: 403 }
      )
    }

    // Rate limit by user ID
    const userId = session.user?.id || session.user?.email || 'unknown'
    const rateLimitKey = `calendar:${userId}`
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.calendar)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }

    // Get date range and timezone from query params
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')
    const timezoneParam = searchParams.get('timezone')

    // Require timezone from client - no defaults
    if (!timezoneParam) {
      return NextResponse.json(
        { error: 'Timezone parameter is required', code: 'MISSING_TIMEZONE' },
        { status: 400 }
      )
    }

    if (!isValidTimezone(timezoneParam)) {
      return NextResponse.json(
        { error: `Invalid timezone: ${timezoneParam}`, code: 'INVALID_TIMEZONE' },
        { status: 400 }
      )
    }

    const timezone = timezoneParam

    // Use provided date range or default to today (in user's timezone)
    const today = formatDateInTimezone(new Date().toISOString(), timezone)
    const rangeStart = startDate || today
    const rangeEnd = endDate || today

    // Calculate the UTC timestamps for the start of first day and end of last day
    const timeMin = getTimestampForTimezone(rangeStart, 'start', timezone)
    const timeMax = getTimestampForTimezone(rangeEnd, 'end', timezone)

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
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text()
      console.error('[Calendar Events] Google Calendar API error:', calendarResponse.status, errorText)

      // Parse error to check for specific issues
      let errorData: { error?: { message?: string; status?: string } } = {}
      try {
        errorData = JSON.parse(errorText)
      } catch {
        // Not JSON, ignore
      }

      const isInsufficientScope = errorData.error?.message?.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') ||
        errorData.error?.status === 'PERMISSION_DENIED'

      if (isInsufficientScope) {
        // Token doesn't have calendar.readonly scope - user needs to re-authenticate
        console.error('[Calendar Events] Token missing calendar scope. Source:', source)
        return NextResponse.json(
          {
            error: 'Calendar permission not granted. Please disconnect and reconnect your calendar, or sign out and sign back in with Google.',
            code: 'SCOPE_INSUFFICIENT'
          },
          { status: 403 }
        )
      }

      if (calendarResponse.status === 401 || calendarResponse.status === 403) {
        // Token is invalid or revoked - client should trigger re-auth
        return NextResponse.json(
          {
            error: 'Calendar access token expired or revoked. Please sign in again.',
            code: 'TOKEN_EXPIRED'
          },
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
        let eventDate = ''

        if (event.start.dateTime) {
          // Timed event - convert to user's timezone
          startTime = formatTimeInTimezone(event.start.dateTime, timezone)
          endTime = formatTimeInTimezone(event.end.dateTime || event.start.dateTime, timezone)
          // Extract date in user's timezone
          eventDate = formatDateInTimezone(event.start.dateTime, timezone)
        } else if (event.start.date) {
          // All-day event - date is already in YYYY-MM-DD format
          eventDate = event.start.date
        }

        return {
          id: event.id,
          title: event.summary,
          startTime,
          endTime,
          date: eventDate,
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
