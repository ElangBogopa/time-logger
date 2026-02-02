import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'

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
    console.log('[Google Tasks] Using JWT token for Google OAuth user')
    return { accessToken: token.accessToken, source: 'session' }
  }

  // Email users - check calendar_connections
  if (session.user?.id) {
    console.log('[Google Tasks] Checking calendar_connections for user:', session.user.id)
    const { data: connection, error: connError } = await supabase
      .from('calendar_connections')
      .select('google_access_token, google_refresh_token, token_expires_at, google_email')
      .eq('user_id', session.user.id)
      .single()

    if (connError) {
      console.log('[Google Tasks] No calendar connection found:', connError.message)
    }

    if (connection) {
      console.log('[Google Tasks] Found connection for:', connection.google_email, 'Expires:', connection.token_expires_at)

      // Check if token is expired
      const isExpired = connection.token_expires_at &&
        new Date(connection.token_expires_at) < new Date()

      if (isExpired && connection.google_refresh_token) {
        console.log('[Google Tasks] Token expired, refreshing...')
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
          console.log('[Google Tasks] Refresh response:', refreshResponse.ok, 'Has token:', !!refreshedTokens.access_token)

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
            console.error('[Google Tasks] Token refresh failed:', refreshedTokens)
          }
        } catch (error) {
          console.error('[Google Tasks] Failed to refresh calendar token:', error)
        }
      }

      return { accessToken: connection.google_access_token, source: 'connection' }
    }
  }

  return { accessToken: null, source: null }
}

interface GoogleTaskList {
  id: string
  title: string
}

interface GoogleTask {
  id: string
  title: string
  notes?: string
  due?: string
}

interface GoogleTaskListsResponse {
  items: GoogleTaskList[]
}

interface GoogleTasksResponse {
  items: GoogleTask[]
}

interface TaskItem {
  id: string
  title: string
  notes?: string
  dueDate?: string
  listName: string
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
    console.log('[Google Tasks] User ID:', session.user.id, 'Auth provider:', session.authProvider)
    const token = await getToken({ req: request })
    const { accessToken, source } = await getCalendarAccessToken(token, session)
    console.log('[Google Tasks] Access token source:', source, 'Has token:', !!accessToken)

    if (!accessToken) {
      console.log('[Google Tasks] No access token found')
      return NextResponse.json(
        { error: 'No calendar connected', code: 'NO_CALENDAR' },
        { status: 401 }
      )
    }

    // Rate limit by user ID
    const userId = session.user?.id || session.user?.email || 'unknown'
    const rateLimitKey = `tasks:${userId}`
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.calendar)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }

    // First, get all task lists
    const taskListsResponse = await fetch(
      'https://www.googleapis.com/tasks/v1/users/@me/lists',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!taskListsResponse.ok) {
      const errorText = await taskListsResponse.text()
      console.error('[Google Tasks] Google Tasks API error (lists):', taskListsResponse.status, errorText)

      if (taskListsResponse.status === 401 || taskListsResponse.status === 403) {
        return NextResponse.json(
          {
            error: 'Calendar access token expired or revoked. Please sign in again.',
            code: 'TOKEN_EXPIRED'
          },
          { status: 401 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to fetch Google Tasks lists' },
        { status: 500 }
      )
    }

    const taskListsData: GoogleTaskListsResponse = await taskListsResponse.json()
    const taskLists = taskListsData.items || []

    // If no task lists, return empty array
    if (taskLists.length === 0) {
      return NextResponse.json({ tasks: [] })
    }

    // Fetch tasks from each list
    const allTasks: TaskItem[] = []
    
    for (const list of taskLists) {
      const tasksResponse = await fetch(
        `https://www.googleapis.com/tasks/v1/lists/${list.id}/tasks?showCompleted=false&showHidden=false`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (tasksResponse.ok) {
        const tasksData: GoogleTasksResponse = await tasksResponse.json()
        const tasks = tasksData.items || []
        
        // Add tasks to the result array
        tasks.forEach(task => {
          allTasks.push({
            id: task.id,
            title: task.title,
            notes: task.notes,
            dueDate: task.due,
            listName: list.title,
          })
        })
      } else {
        console.error(`[Google Tasks] Failed to fetch tasks for list ${list.title}:`, tasksResponse.status)
      }
    }

    return NextResponse.json({ tasks: allTasks })
  } catch (error) {
    console.error('Google Tasks fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Google Tasks' },
      { status: 500 }
    )
  }
}