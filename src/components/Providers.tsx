'use client'

import { SessionProvider } from 'next-auth/react'
import { CalendarProvider } from '@/contexts/CalendarContext'
import { ReactNode } from 'react'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <CalendarProvider>{children}</CalendarProvider>
    </SessionProvider>
  )
}
