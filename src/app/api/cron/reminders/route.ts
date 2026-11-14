import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { DEFAULT_REMINDER_TIMES, type ReminderTime } from '@/lib/types'
import { pushConfigured, sendPush, type StoredSubscription } from '@/lib/push-server'
import { REMINDER_KINDS, alreadyLogged, dueReminder, localClock, notificationFor } from '@/lib/reminders'

/**
 * GET /api/cron/reminders — send whichever reminders are due this hour.
 *
 * Called once an hour by .github/workflows/reminders.yml. For each person
 * with a device subscribed it works out the hour where they are, and sends
 * the reminder set for that hour unless that part of their day is already
 * logged.
 *
 * Who gets reminders is decided by the subscription alone. There is a
 * `reminder_enabled` column, and this used to require it — but nothing in
 * the app ever set it, so the job ran for months with nobody to send to.
 * Turning reminders on subscribes the device; turning them off removes the
 * subscription. That is the switch.
 *
 * It answers with counts and never with who: the caller's log is public.
 */
export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!pushConfigured()) {
      return NextResponse.json(
        { error: 'Push notifications not configured. Set VAPID keys in environment.' },
        { status: 503 }
      )
    }

    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
    if (subsError) {
      console.error('[Reminders] Could not read subscriptions:', subsError.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const devicesByUser = new Map<string, StoredSubscription[]>()
    for (const subscription of (subscriptions ?? []) as StoredSubscription[]) {
      devicesByUser.set(subscription.user_id, [...(devicesByUser.get(subscription.user_id) ?? []), subscription])
    }

    const counts = { subscribers: devicesByUser.size, due: 0, alreadyLogged: 0, sent: 0, failed: 0, removed: 0 }
    if (devicesByUser.size === 0) return done(counts)

    const { data: preferences, error: prefsError } = await supabase
      .from('user_preferences')
      .select('user_id, reminder_times, timezone')
      .in('user_id', [...devicesByUser.keys()])
    if (prefsError) {
      console.error('[Reminders] Could not read preferences:', prefsError.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    const prefsByUser = new Map(
      ((preferences ?? []) as { user_id: string; reminder_times: ReminderTime[] | null; timezone: string | null }[]).map(
        (row) => [row.user_id, row]
      )
    )

    const now = new Date()

    for (const [userId, devices] of devicesByUser) {
      const prefs = prefsByUser.get(userId)
      const clock = localClock(now, prefs?.timezone)
      const reminder = dueReminder(prefs?.reminder_times ?? DEFAULT_REMINDER_TIMES, clock.hour)
      if (!reminder) continue
      counts.due++

      const kind = REMINDER_KINDS[reminder.id]
      if (kind && (await isLogged(userId, clock.date, kind.period))) {
        counts.alreadyLogged++
        continue
      }

      const payload = notificationFor(reminder.id)
      for (const device of devices) {
        const outcome = await sendPush(device, payload)
        if (outcome === 'sent') counts.sent++
        else if (outcome === 'failed') counts.failed++
        else {
          // The browser has dropped this subscription; it will never deliver again.
          counts.removed++
          await supabase.from('push_subscriptions').delete().eq('id', device.id)
        }
      }
    }

    return done(counts)
  } catch (error) {
    console.error('[Reminders] Failed:', error)
    return NextResponse.json({ error: 'Failed to process reminders' }, { status: 500 })
  }
}

function done(counts: Record<string, number>) {
  // The trace this job never left: one line an hour, in the server's own log.
  console.log('[Reminders]', JSON.stringify(counts))
  return NextResponse.json({ success: true, ...counts })
}

/** If either lookup fails the reminder is sent: a spare nudge is the smaller mistake. */
async function isLogged(userId: string, date: string, period: (typeof REMINDER_KINDS)[string]['period']): Promise<boolean> {
  const [entries, completions] = await Promise.all([
    supabase.from('time_entries').select('start_time').eq('user_id', userId).eq('date', date).eq('status', 'confirmed'),
    supabase.from('session_completions').select('period').eq('user_id', userId).eq('date', date),
  ])
  return alreadyLogged(
    period,
    (entries.data ?? []) as { start_time: string | null }[],
    (completions.data ?? []) as { period: string }[]
  )
}
