import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabase } from '@/lib/supabase-server'

// Configure web-push (only if keys are set)
const vapidConfigured = !!(
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY
)

if (vapidConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
}

// Reminder messages by time of day
const REMINDER_MESSAGES: Record<string, { title: string; body: string }> = {
  morning: {
    title: 'Good morning! ☀️',
    body: 'Ready to plan your day? Log what you have ahead.',
  },
  midday: {
    title: 'Midday check-in 📋',
    body: "How's your day going? Take a moment to log your morning.",
  },
  evening: {
    title: 'Evening reflection 🌅',
    body: 'Wind down your day by logging your afternoon activities.',
  },
  night: {
    title: 'Time to wrap up 🌙',
    body: 'Before you rest, capture how you spent your evening.',
  },
}

function getTimeOfDay(hour: number): string {
  if (hour < 10) return 'morning'
  if (hour < 14) return 'midday'
  if (hour < 19) return 'evening'
  return 'night'
}

/**
 * Calculate streak: consecutive days with entries, walking back from today/yesterday.
 */
function calculateStreak(entryDates: string[]): number {
  if (!entryDates.length) return 0
  const uniqueDates = new Set(entryDates)
  const today = new Date()
  let streak = 0

  // Check today first
  const todayStr = today.toISOString().slice(0, 10)
  if (uniqueDates.has(todayStr)) streak++

  // Walk backwards from yesterday
  for (let i = 1; i <= 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    if (uniqueDates.has(dateStr)) {
      streak++
    } else {
      break
    }
  }

  return streak
}

// GET /api/cron/reminders - Triggered by Vercel Cron (hourly)
export async function GET(request: NextRequest) {
  try {
    // Check if push is configured
    if (!vapidConfigured) {
      return NextResponse.json({
        error: 'Push notifications not configured. Set VAPID keys in environment.',
      }, { status: 503 })
    }

    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const currentHour = now.getUTCHours()
    const todayStr = now.toISOString().slice(0, 10)

    // Common timezone offsets to check
    const timezoneOffsets = [-8, -7, -6, -5, -4, -3, 0, 1, 2, 3, 5.5, 8, 9, 10, 12]

    const matchingTimes: string[] = []
    for (const offset of timezoneOffsets) {
      const localHour = (currentHour + offset + 24) % 24
      matchingTimes.push(`${String(Math.floor(localHour)).padStart(2, '0')}:00`)
    }

    // Get users with reminders enabled
    const { data: preferences, error: prefsError } = await supabase
      .from('user_preferences')
      .select('user_id, reminder_times')
      .eq('reminder_enabled', true)

    if (prefsError) {
      console.error('Failed to fetch preferences:', prefsError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!preferences || preferences.length === 0) {
      return NextResponse.json({ message: 'No users with reminders enabled' })
    }

    // Find users whose reminder times match
    const usersToNotify: string[] = []

    for (const pref of preferences) {
      const reminderTimes = pref.reminder_times as Array<{
        time: string
        enabled: boolean
      }> | null

      if (!reminderTimes) continue

      for (const reminder of reminderTimes) {
        if (reminder.enabled && matchingTimes.includes(reminder.time)) {
          usersToNotify.push(pref.user_id)
          break
        }
      }
    }

    if (usersToNotify.length === 0) {
      return NextResponse.json({
        message: 'No matching reminder times',
        checkedTimes: matchingTimes,
      })
    }

    // Get push subscriptions for these users
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .in('user_id', usersToNotify)

    if (subsError) {
      console.error('Failed to fetch subscriptions:', subsError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        message: 'No push subscriptions for users',
        usersToNotify: usersToNotify.length,
      })
    }

    // Determine base message from time of day
    const timeOfDay = getTimeOfDay(currentHour)
    const baseMessage = REMINDER_MESSAGES[timeOfDay]

    // Look back 60 days for streak calculation
    const lookbackDate = new Date(now)
    lookbackDate.setDate(lookbackDate.getDate() - 60)
    const lookbackStr = lookbackDate.toISOString().slice(0, 10)

    // Send notifications with personalized messages
    let sent = 0
    let failed = 0

    // Group subs by user for efficient querying
    const subsByUser = new Map<string, typeof subscriptions>()
    for (const sub of subscriptions) {
      const list = subsByUser.get(sub.user_id) || []
      list.push(sub)
      subsByUser.set(sub.user_id, list)
    }

    for (const [userId, userSubs] of subsByUser) {
      // Fetch user's recent entries for personalization
      const { data: recentEntries } = await supabase
        .from('time_entries')
        .select('date')
        .eq('user_id', userId)
        .gte('date', lookbackStr)

      const entryDates = recentEntries?.map(e => e.date) || []
      const todayEntries = entryDates.filter(d => d === todayStr)
      const streak = calculateStreak(entryDates)

      // Build personalized message
      let title = baseMessage.title
      let body: string

      if (todayEntries.length > 0) {
        // Already logged today — encourage more
        title = 'Keep it going! 🎯'
        body = `Nice work! You've logged ${todayEntries.length} ${todayEntries.length === 1 ? 'entry' : 'entries'} today.`
      } else {
        body = baseMessage.body
      }

      // Add streak info if notable
      if (streak >= 3) {
        body += ` You're on a ${streak}-day streak! 🔥`
      }

      // Send to all user devices
      for (const sub of userSubs) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify({
              title,
              body,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              url: '/',
              tag: 'reminder',
            })
          )
          sent++
        } catch (err: unknown) {
          failed++
          const error = err as { statusCode?: number }
          if (error.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: subscriptions.length,
      timeOfDay,
    })
  } catch (error) {
    console.error('Cron reminders error:', error)
    return NextResponse.json(
      { error: 'Failed to process reminders' },
      { status: 500 }
    )
  }
}
