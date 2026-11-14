import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { pushConfigured, sendPush, type StoredSubscription } from '@/lib/push-server'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'

/**
 * POST /api/push/test — send one notification to the caller's own devices, now.
 *
 * Reminders failed silently for months and there was no way to tell from
 * the app whether a notification could reach the phone in your hand. This
 * is that way: it goes through the same keys, the same subscription and the
 * same service worker as a real reminder, and only the scheduler is left
 * out.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limit = checkRateLimit(`push-test:${session.user.id}`, RATE_LIMITS.auth)
    if (!limit.success) {
      return NextResponse.json(
        { error: 'That is enough tests for a minute.' },
        { status: 429, headers: getRateLimitHeaders(limit) }
      )
    }

    if (!pushConfigured()) {
      return NextResponse.json({ error: 'Notifications are not set up on the server yet.' }, { status: 503 })
    }

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .eq('user_id', session.user.id)
    if (error) {
      console.error('[Push test] Could not read subscriptions:', error.message)
      return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 })
    }

    const devices = (data ?? []) as StoredSubscription[]
    if (devices.length === 0) {
      return NextResponse.json({ error: 'Reminders are not turned on for this account yet.' }, { status: 409 })
    }

    let sent = 0
    for (const device of devices) {
      const outcome = await sendPush(device, {
        title: 'Reminders are on',
        body: 'This is what a reminder from Better looks like.',
        url: '/settings/notifications',
        tag: 'reminder-test',
      })
      if (outcome === 'sent') sent++
      else if (outcome === 'gone') await supabase.from('push_subscriptions').delete().eq('id', device.id)
    }

    if (sent === 0) {
      return NextResponse.json(
        { error: 'The notification could not be delivered. Turn reminders off and on again, then retry.' },
        { status: 502 }
      )
    }
    return NextResponse.json({ sent })
  } catch (error) {
    console.error('[Push test] Failed:', error)
    return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 })
  }
}
