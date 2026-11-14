/**
 * Sending a push notification. Server-only.
 *
 * One place, because two things send them — the hourly reminders and the
 * "send a test" button — and they must agree on what a notification looks
 * like and on what a dead subscription is.
 */

import webpush from 'web-push'

let configured: boolean | null = null

/** Whether the server has the keys to send at all. Read once. */
export function pushConfigured(): boolean {
  if (configured !== null) return configured
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  configured = !!(publicKey && privateKey)
  if (configured) {
    webpush.setVapidDetails(process.env.VAPID_EMAIL || 'mailto:admin@example.com', publicKey!, privateKey!)
  }
  return configured
}

export interface StoredSubscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushPayload {
  title: string
  body: string
  url: string
  tag: string
}

const ICON = '/icons/icon-192x192.png'

/**
 * 'sent', 'gone' when the browser has dropped the subscription (the caller
 * should delete it), or 'failed' for anything that might work next time.
 */
export async function sendPush(subscription: StoredSubscription, payload: PushPayload): Promise<'sent' | 'gone' | 'failed'> {
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify({ ...payload, icon: ICON, badge: ICON })
    )
    return 'sent'
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    return status === 404 || status === 410 ? 'gone' : 'failed'
  }
}

/** For tests: forget whether the keys were there. */
export function resetPushConfigForTests(): void {
  configured = null
}
