'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from 'next-themes'
import { CalendarProvider } from '@/contexts/CalendarContext'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import GoogleReauthBanner from '@/components/GoogleReauthBanner'
import BottomTabBar from '@/components/BottomTabBar'
import FocusSessionBar from '@/components/FocusSessionBar'
import { Toaster } from '@/components/ui/sonner'
import { useTimezoneSync } from '@/hooks/useTimezoneSync'
import { ReactNode } from 'react'

function TimezoneSync() {
  useTimezoneSync()
  return null
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
      <SessionProvider>
        <TimezoneSync />
        <CalendarProvider>
          {/* The phone column. Everything lives inside it, including the
              fixed nav, the floating button and the modals — see .app-frame
              in globals.css for why that works. */}
          <div className="app-frame">
            <GoogleReauthBanner />
            <FocusSessionBar />
            <div className="app-scroll">{children}</div>
            <BottomTabBar />
            <OfflineIndicator />
            {/* Lifted clear of the tab bar, which toasts used to cover, and of
                the floating add button above it — a toast sitting on that
                button blocks logging the next thing for as long as it shows. */}
            <Toaster position="bottom-center" offset={{ bottom: 160 }} mobileOffset={{ bottom: 160 }} />
          </div>
        </CalendarProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}
