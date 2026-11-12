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
import { ReactNode, useEffect } from 'react'

function TimezoneSync() {
  useTimezoneSync()
  return null
}

/**
 * How much of the bottom of the screen the on-screen keyboard covers, as a
 * CSS variable. A sheet anchored to the bottom edge would otherwise sit
 * behind the keyboard the moment its text field is focused; with this it
 * rides on top of it.
 */
function useKeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      document.documentElement.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`)
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])
}

export default function Providers({ children }: { children: ReactNode }) {
  useKeyboardInset()
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
            {/* At the top. The bottom of this app is the tab bar, the add
                button and every sheet; a toast down there sat on whichever of
                them you needed next — or on the row you had just ticked. */}
            <Toaster position="top-center" offset={{ top: 12 }} mobileOffset={{ top: 12 }} />
          </div>
        </CalendarProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}
