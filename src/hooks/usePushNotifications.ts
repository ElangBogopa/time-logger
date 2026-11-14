'use client'

import { useState, useEffect, useCallback } from 'react'
import { csrfFetch } from '@/lib/api'

type PermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported'

const NOT_SET_UP = 'Notifications are not set up on the server yet.'
const NOT_READY = 'Better is still getting ready on this device. Close it, open it again, and try once more.'
const COULD_NOT = 'Reminders could not be turned on. Try again.'

async function saveSubscription(subscription: PushSubscription): Promise<boolean> {
  try {
    const response = await csrfFetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * The service worker, once it is running — or null if it is not there
 * after a few seconds. `navigator.serviceWorker.ready` on its own never
 * settles where no worker was registered, which left the button on this
 * screen spinning for good.
 */
function workerWhenReady(): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
  ])
}

async function currentState(supported: boolean): Promise<{ permission: PermissionState; subscribed: boolean }> {
  if (!supported) return { permission: 'unsupported', subscribed: false }
  const permission = Notification.permission as PermissionState
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = (await registration?.pushManager.getSubscription()) ?? null
    // The browser being subscribed is only half of it: the server has to
    // know the address too. Saying so again costs one request and repairs
    // an account whose row went missing.
    if (subscription) void saveSubscription(subscription)
    return { permission, subscribed: !!subscription }
  } catch {
    return { permission, subscribed: false }
  }
}

/**
 * Reminders on this device: whether it can receive them, whether it is
 * signed up to, and the switch. Being subscribed here *is* having
 * reminders on — the hourly job sends to every subscribed device.
 */
export function usePushNotifications() {
  const isSupported =
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

  const [permission, setPermission] = useState<PermissionState>('prompt')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    currentState(isSupported).then((state) => {
      if (cancelled) return
      setPermission(state.permission)
      setIsSubscribed(state.subscribed)
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [isSupported])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!key) {
      setError(NOT_SET_UP)
      return false
    }

    setIsLoading(true)
    setError(null)
    try {
      const result = (await Notification.requestPermission()) as PermissionState
      setPermission(result)
      if (result !== 'granted') return false

      const registration = await workerWhenReady()
      if (!registration) {
        setError(NOT_READY)
        return false
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      })

      if (!(await saveSubscription(subscription))) {
        // Subscribed in the browser but unknown to the server would show
        // "on" and deliver nothing. Undo it and say so.
        await subscription.unsubscribe().catch(() => {})
        setError(COULD_NOT)
        return false
      }

      setIsSubscribed(true)
      return true
    } catch (err) {
      console.error('Error subscribing to push:', err)
      setError(COULD_NOT)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isSupported])

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false

    setIsLoading(true)
    setError(null)
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = await registration?.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()
        await csrfFetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
      }

      setIsSubscribed(false)
      return true
    } catch (err) {
      console.error('Error unsubscribing from push:', err)
      setError('Reminders could not be turned off. Try again.')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isSupported])

  /** Send one notification to this account's devices now. Resolves with what went wrong, or null. */
  const sendTest = useCallback(async (): Promise<string | null> => {
    try {
      const response = await csrfFetch('/api/push/test', { method: 'POST' })
      if (response.ok) return null
      const body = await response.json().catch(() => null)
      return typeof body?.error === 'string' ? body.error : 'The test could not be sent.'
    } catch {
      return 'The test could not be sent.'
    }
  }, [])

  return { isSupported, permission, isSubscribed, isLoading, error, subscribe, unsubscribe, sendTest }
}

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const outputArray = new Uint8Array(buffer)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}
