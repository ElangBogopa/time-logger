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

interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  url?: string
  tag?: string
}

// POST /api/push/send - Send notification to a user (internal use)
export async function POST(request: NextRequest) {
  try {
    // Check if push is configured
    if (!vapidConfigured) {
      return NextResponse.json({
        error: 'Push notifications not configured. Set VAPID keys in environment.',
      }, { status: 503 })
    }

    // Verify this is an internal call (cron or admin)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, payload } = await request.json() as {
      userId: string
      payload: PushPayload
    }

    if (!userId || !payload?.title || !payload?.body) {
      return NextResponse.json(
        { error: 'userId and payload (title, body) required' },
        { status: 400 }
      )
    }

    // Get user's push subscriptions
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (error) {
      console.error('Failed to fetch subscriptions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions' },
        { status: 500 }
      )
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No subscriptions found for user',
      })
    }

    // Send to all user's devices
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        }

        try {
          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(payload)
          )
          return { id: sub.id, success: true }
        } catch (err: unknown) {
          const error = err as { statusCode?: number }
          // If subscription is invalid (410 Gone), remove it
          if (error.statusCode === 410) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('id', sub.id)
          }
          return { id: sub.id, success: false, error: error.statusCode }
        }
      })
    )

    const successful = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length

    return NextResponse.json({
      success: true,
      sent: successful,
      total: subscriptions.length,
    })
  } catch (error) {
    console.error('Push send error:', error)
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    )
  }
}
