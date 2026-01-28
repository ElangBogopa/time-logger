'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from 'next-themes'
import { CalendarProvider } from '@/contexts/CalendarContext'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import GoogleReauthBanner from '@/components/GoogleReauthBanner'
import BottomTabBar from '@/components/BottomTabBar'
import FocusSessionBar from '@/components/FocusSessionBar'
import { Toaster } from '@/components/ui/sonner'
import { ReactNode } from 'react'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
      <SessionProvider>
        <CalendarProvider>
          <GoogleReauthBanner />
          <FocusSessionBar />
          {children}
          <BottomTabBar />
          <OfflineIndicator />
          <Toaster position="bottom-center" />
        </CalendarProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}
