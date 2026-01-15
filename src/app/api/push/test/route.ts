import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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

// GET /api/push/test - Send a test notification to the current user
export async function GET() {
  try {
    if (!vapidConfigured) {
      return NextResponse.json({
        error: 'VAPID keys not configured. Add them to .env.local',
      }, { status: 503 })
    }

    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }

    // Get user's subscription
    const { data: subscription, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', session.user.id)
      .limit(1)
      .single()

    if (error || !subscription) {
      return NextResponse.json({
        error: 'No push subscription found. Enable notifications in Settings first.',
      }, { status: 404 })
    }

    // Send test notification
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify({
        title: 'Test Notification',
        body: 'Push notifications are working!',
        icon: '/icon-192.png',
        url: '/',
      })
    )

    return NextResponse.json({ success: true, message: 'Test notification sent!' })
  } catch (error) {
    console.error('Test push error:', error)
    return NextResponse.json({
      error: 'Failed to send test notification',
      details: String(error),
    }, { status: 500 })
  }
}
