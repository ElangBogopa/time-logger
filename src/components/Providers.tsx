'use client'

import { SessionProvider } from 'next-auth/react'
import { CalendarProvider } from '@/contexts/CalendarContext'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { ReactNode } from 'react'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <CalendarProvider>
        {children}
        <OfflineIndicator />
      </CalendarProvider>
    </SessionProvider>
  )
}
