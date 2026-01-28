'use client'

import { useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { X } from 'lucide-react'
import { useCalendar } from '@/contexts/CalendarContext'

export default function GoogleReauthBanner() {
  const { data: session } = useSession()
  const { googleTokenExpired } = useCalendar()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const sessionExpired = session?.authProvider === 'google' && session?.error === 'RefreshAccessTokenError'
  const shouldShow = sessionExpired || googleTokenExpired

  if (!shouldShow) return null

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
      <p className="text-sm text-amber-200">
        Your Google session has expired.
      </p>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => signIn('google')}
          className="text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
        >
          Sign in again
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-amber-400/60 hover:text-amber-300 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
