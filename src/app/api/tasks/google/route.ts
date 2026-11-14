import { NextRequest, NextResponse } from 'next/server'
import { getAppSession } from '@/lib/session'
import { getGoogleAccessToken } from '@/lib/google-token'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'

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
    const session = await getAppSession()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get access token from JWT or calendar_connections
    const { accessToken, source } = await getGoogleAccessToken(request, session)
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