import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabase } from '@/lib/supabase-server'

// Configure web-push
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

interface PushSub {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * Calculate streak: count consecutive days (backwards from yesterday) with at least one entry.
 * Returns 0 if no entries yesterday.
 */
function calculateStreak(entryDates: string[]): number {
  if (!entryDates.length) return 0

  // Get unique dates as YYYY-MM-DD strings
  const uniqueDates = new Set(entryDates)

  const today = new Date()
  let streak = 0

  // Check if today has entries (counts toward streak)
  const todayStr = today.toISOString().slice(0, 10)
  if (uniqueDates.has(todayStr)) {
    streak++
  }

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

/**
 * Send push notification to all of a user's devices.
 * Returns { sent, failed } counts. Cleans up expired subscriptions.
 */
async function sendToUser(
  subscriptions: PushSub[],
  payload: { title: string; body: string; tag: string }
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: '/icon-192.png',
          url: '/',
          tag: payload.tag,
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

  return { sent, failed }
}

// GET /api/cron/engagement — Smart engagement notifications (daily at 9pm UTC)
export async function GET(request: NextRequest) {
  try {
    if (!vapidConfigured) {
      return NextResponse.json(
        { error: 'Push notifications not configured.' },
        { status: 503 }
      )
    }

    // Auth
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get users with reminders enabled
    const { data: preferences, error: prefsError } = await supabase
      .from('user_preferences')
      .select('user_id')
      .eq('reminder_enabled', true)

    if (prefsError || !preferences?.length) {
      return NextResponse.json({ message: 'No users with reminders enabled' })
    }

    const userIds = preferences.map(p => p.user_id)

    // Get all push subscriptions for these users
    const { data: allSubs } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .in('user_id', userIds)

    if (!allSubs?.length) {
      return NextResponse.json({ message: 'No push subscriptions found' })
    }

    // Group subscriptions by user
    const subsByUser = new Map<string, PushSub[]>()
    for (const sub of allSubs) {
      const list = subsByUser.get(sub.user_id) || []
      list.push(sub)
      subsByUser.set(sub.user_id, list)
    }

    // Date helpers
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    const dayOfWeek = today.getUTCDay() // 0 = Sunday

    // Get start of current week (Monday)
    const weekStart = new Date(today)
    weekStart.setDate(weekStart.getDate() - ((dayOfWeek + 6) % 7))
    const weekStartStr = weekStart.toISOString().slice(0, 10)

    // Look back 60 days for streak calculation
    const lookbackDate = new Date(today)
    lookbackDate.setDate(lookbackDate.getDate() - 60)
    const lookbackStr = lookbackDate.toISOString().slice(0, 10)

    let totalSent = 0
    let totalFailed = 0
    const notifications: string[] = []

    for (const userId of userIds) {
      const subs = subsByUser.get(userId)
      if (!subs?.length) continue

      // Fetch user's entries for streak + activity analysis
      const { data: recentEntries } = await supabase
        .from('time_entries')
        .select('date, category, duration_minutes')
        .eq('user_id', userId)
        .gte('date', lookbackStr)
        .order('date', { ascending: false })

      if (!recentEntries) continue

      const entryDates = recentEntries.map(e => e.date)
      const streak = calculateStreak(entryDates)
      const hasEntriesToday = entryDates.includes(todayStr)

      // --- Notification type 1: Streak at risk ---
      if (streak >= 2 && !hasEntriesToday) {
        const result = await sendToUser(subs, {
          title: 'Don\'t break your streak! 🔥',
          body: `You're on a ${streak}-day streak! Log something today to keep it alive.`,
          tag: 'streak-risk',
        })
        totalSent += result.sent
        totalFailed += result.failed
        notifications.push(`streak-risk:${userId}`)
        continue // Don't spam, one notification per user
      }

      // --- Notification type 2: Inactivity nudge ---
      if (!hasEntriesToday && entryDates.length > 0) {
        const lastEntryDate = entryDates[0] // Already sorted desc
        const daysSinceLastEntry = Math.floor(
          (today.getTime() - new Date(lastEntryDate).getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysSinceLastEntry >= 2) {
          const result = await sendToUser(subs, {
            title: 'We miss you! 👋',
            body: `It's been ${daysSinceLastEntry} days since your last log. Pick up where you left off!`,
            tag: 'inactivity',
          })
          totalSent += result.sent
          totalFailed += result.failed
          notifications.push(`inactivity:${userId}`)
          continue
        }
      }

      // --- Notification type 3: Goal progress ---
      const { data: targets } = await supabase
        .from('weekly_targets')
        .select('category, target_minutes')
        .eq('user_id', userId)

      if (targets?.length) {
        // Get this week's entries
        const weekEntries = recentEntries.filter(e => e.date >= weekStartStr)

        for (const target of targets) {
          const logged = weekEntries
            .filter(e => e.category === target.category)
            .reduce((sum, e) => sum + (e.duration_minutes || 0), 0)

          const pct = Math.round((logged / target.target_minutes) * 100)

          if (pct >= 70 && pct < 100) {
            const result = await sendToUser(subs, {
              title: 'Almost there! 💪',
              body: `You're ${pct}% to your ${target.category.replace('_', ' ')} goal this week. Keep pushing!`,
              tag: 'goal-progress',
            })
            totalSent += result.sent
            totalFailed += result.failed
            notifications.push(`goal:${userId}:${target.category}`)
            break // One goal notification per user
          }
        }
      }

      // --- Notification type 4: Weekly milestone (Sunday) ---
      if (dayOfWeek === 0) {
        const weekDates = new Set(
          recentEntries
            .filter(e => e.date >= weekStartStr)
            .map(e => e.date)
        )

        if (weekDates.size >= 5) {
          const result = await sendToUser(subs, {
            title: 'Amazing week! 🏆',
            body: `You logged ${weekDates.size} out of 7 days this week. Incredible consistency!`,
            tag: 'weekly-milestone',
          })
          totalSent += result.sent
          totalFailed += result.failed
          notifications.push(`milestone:${userId}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent: totalSent,
      failed: totalFailed,
      notifications,
    })
  } catch (error) {
    console.error('Engagement cron error:', error)
    return NextResponse.json(
      { error: 'Failed to process engagement notifications' },
      { status: 500 }
    )
  }
}
