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
    title: 'Good morning!',
    body: 'Ready to plan your day? Log what you have ahead.',
  },
  midday: {
    title: 'Midday check-in',
    body: 'How\'s your day going? Take a moment to log your morning.',
  },
  evening: {
    title: 'Evening reflection',
    body: 'Wind down your day by logging your afternoon activities.',
  },
  night: {
    title: 'Time to wrap up',
    body: 'Before you rest, capture how you spent your evening.',
  },
}

function getTimeOfDay(hour: number): string {
  if (hour < 10) return 'morning'
  if (hour < 14) return 'midday'
  if (hour < 19) return 'evening'
  return 'night'
}

// GET /api/cron/reminders - Triggered by Vercel Cron
export async function GET(request: NextRequest) {
  try {
    // Check if push is configured
    if (!vapidConfigured) {
      return NextResponse.json({
        error: 'Push notifications not configured. Set VAPID keys in environment.',
      }, { status: 503 })
    }

    // Verify cron secret (Vercel adds this automatically)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current time in common timezones to match user reminder times
    const now = new Date()
    const currentHour = now.getUTCHours()

    // Common timezone offsets to check (UTC-8 to UTC+12)
    const timezoneOffsets = [-8, -7, -6, -5, -4, -3, 0, 1, 2, 3, 5.5, 8, 9, 10, 12]

    // Build list of HH:MM times that match current UTC time across timezones
    const matchingTimes: string[] = []
    for (const offset of timezoneOffsets) {
      const localHour = (currentHour + offset + 24) % 24
      matchingTimes.push(`${String(localHour).padStart(2, '0')}:00`)
    }

    // Get users with matching reminder times
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

    // Find users whose reminder times match current time
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
          break // Only notify once per user per cron run
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

    // Determine message based on time of day
    const timeOfDay = getTimeOfDay(currentHour)
    const message = REMINDER_MESSAGES[timeOfDay]

    // Send notifications
    let sent = 0
    let failed = 0

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: message.title,
            body: message.body,
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
        // Clean up invalid subscriptions
        if (error.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
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
