'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { csrfFetch } from '@/lib/api'

/**
 * Auto-detects the user's IANA timezone and syncs it to user_preferences.
 * Runs once per session — stores last-synced tz in sessionStorage to avoid
 * duplicate PUTs on every page navigation.
 */
export function useTimezoneSync() {
  const { data: session } = useSession()

  useEffect(() => {
    if (!session?.user?.id) return

    const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!detectedTz) return

    // Only sync once per browser session
    const key = `tz-synced-${session.user.id}`
    if (typeof window !== 'undefined' && sessionStorage.getItem(key) === detectedTz) return

    const syncTimezone = async () => {
      try {
        await csrfFetch('/api/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timezone: detectedTz }),
        })
        sessionStorage.setItem(key, detectedTz)
      } catch {
        // Silent fail — timezone sync is best-effort
      }
    }

    syncTimezone()
  }, [session?.user?.id])
}
