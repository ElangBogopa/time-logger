'use client'

import { Suspense, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TimeEntry, getLocalDateString, isDateLoggable, VIEWING_PAST_MESSAGE } from '@/lib/types'
import TimelineView, { DragCreateData } from '@/components/TimelineView'
import { useCalendar, CalendarEvent } from '@/contexts/CalendarContext'
import StatsCard from '@/components/StatsCard'
import QuickLogModal from '@/components/QuickLogModal'
import Toast from '@/components/Toast'
import GhostEntryModal from '@/components/GhostEntryModal'
import OnboardingModal from '@/components/OnboardingModal'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import CalendarPicker from '@/components/CalendarPicker'
import ErrorBoundary from '@/components/ErrorBoundary'
import { Menu, Calendar, Search, LogOut, ChevronLeft, ChevronRight, Plus, Zap, Loader2, AlertTriangle, RefreshCw, Target, Sparkles, Settings2 } from 'lucide-react'

function formatDateDisplay(dateStr: string): { label: string; date: string; isFuture: boolean } {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const isFuture = date > today

  if (dateStr === getLocalDateString(today)) {
    return { label: 'Today', date: formattedDate, isFuture: false }
  } else if (dateStr === getLocalDateString(yesterday)) {
    return { label: 'Yesterday', date: formattedDate, isFuture: false }
  } else if (dateStr === getLocalDateString(tomorrow)) {
    return { label: 'Tomorrow', date: formattedDate, isFuture: true }
  }

  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' })
  return { label: weekday, date: formattedDate, isFuture }
}

function getAdjacentDate(dateStr: string, direction: 'prev' | 'next'): string {
  const date = new Date(dateStr + 'T00:00:00')
  date.setDate(date.getDate() + (direction === 'next' ? 1 : -1))
  return getLocalDateString(date)
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function getTimeOfDayGreeting(name?: string): { greeting: string; prompt: string } {
  const hour = new Date().getHours()
  const nameGreeting = name ? `, ${name}` : ''

  if (hour < 12) {
    return {
      greeting: `Good morning${nameGreeting}`,
      prompt: 'Log your morning when you\'re ready.',
    }
  } else if (hour < 18) {
    return {
      greeting: `Good afternoon${nameGreeting}`,
      prompt: 'How\'s the day going? Catch up on this afternoon.',
    }
  } else {
    return {
      greeting: `Good evening${nameGreeting}`,
      prompt: 'Wind down time. How was today?',
    }
  }
}

// Check if it's a good day to review the week (Sunday or Monday)
function isReviewDay(): boolean {
  const day = new Date().getDay()
  return day === 0 || day === 1 // Sunday or Monday
}

// Memoized greeting component to avoid duplicate function calls
function TimeOfDayGreeting({ name }: { name?: string }) {
  const greeting = useMemo(() => getTimeOfDayGreeting(name), [name])
  return (
    <div className="mb-4 text-center">
      <p className="text-sm text-muted-foreground">
        {greeting.greeting}! {greeting.prompt}
      </p>
    </div>
  )
}

function HomeContent() {
  const { data: session, status, update: updateSession } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(getLocalDateString())
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false)
  const [selectedGhostEvent, setSelectedGhostEvent] = useState<CalendarEvent | null>(null)
  const [toast, setToast] = useState<{ message: string } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0) // Force re-render key
  const [dragCreateData, setDragCreateData] = useState<DragCreateData | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [hasCheckedIntentions, setHasCheckedIntentions] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const lastVisibilityCheck = useRef<number>(Date.now())

  // Use cached calendar events from context
  const {
    getEventsForDate,
    fetchEventsForDate,
    refreshCalendar,
    isLoading: isCalendarLoading,
    lastSynced,
    isDateInCache,
    calendarStatus,
    checkCalendarStatus
  } = useCalendar()

  // Get calendar events for the selected date from cache (memoized)
  const calendarEvents = useMemo(() => {
    return getEventsForDate(selectedDate).filter(
      (e: CalendarEvent) => !e.isAllDay && e.startTime && e.endTime
    )
  }, [getEventsForDate, selectedDate])

  // Get user ID from session
  const userId = session?.user?.id || session?.user?.email || ''

  const today = getLocalDateString()
  const isToday = selectedDate === today

  // Memoize date display calculations
  const { dateDisplay, isFutureDay, isPastDay } = useMemo(() => {
    const display = formatDateDisplay(selectedDate)
    return {
      dateDisplay: display,
      isFutureDay: display.isFuture,
      isPastDay: !isToday && !display.isFuture
    }
  }, [selectedDate, isToday])

  // Check if logging is allowed for the selected date (today, yesterday, or 2 days ago)
  const canLog = isDateLoggable(selectedDate)

  // Handle calendar connection URL params - redirect to connections page
  useEffect(() => {
    const hasCalendarParams = searchParams.has('calendar_connected') ||
      searchParams.has('conflict_email') ||
      searchParams.has('pending_id') ||
      (searchParams.get('error')?.startsWith('calendar_'))

    if (hasCalendarParams) {
      // Redirect to connections page with the params
      const params = new URLSearchParams()
      searchParams.forEach((value, key) => {
        if (key === 'calendar_connected') {
          params.set('success', 'true')
        } else {
          params.set(key, value)
        }
      })
      router.replace(`/settings/connections?${params.toString()}`)
    }
  }, [searchParams, router])

  // Redirect to login if not authenticated or if there's a token error
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // Check if user needs onboarding (first-time user without intentions)
  useEffect(() => {
    async function checkIntentions() {
      if (status !== 'authenticated' || !session?.user?.id || hasCheckedIntentions) {
        return
      }

      try {
        const response = await fetch('/api/intentions')
        if (response.ok) {
          const data = await response.json()
          if (!data.intentions || data.intentions.length === 0) {
            setShowOnboarding(true)
          }
        }
      } catch (error) {
        console.error('Failed to check intentions:', error)
      } finally {
        setHasCheckedIntentions(true)
      }
    }

    checkIntentions()
  }, [status, session?.user?.id, hasCheckedIntentions])

  // Handle session errors (e.g., refresh token expired/revoked)
  const hasSessionError = session?.error === 'RefreshAccessTokenError'

  // Keyboard shortcut: Cmd+K (Mac) or Ctrl+K (Windows/Linux) to open Quick Log
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K - only if logging is allowed for this date
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (canLog) {
          setIsQuickLogOpen(true)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [canLog])

  // Handle visibility change - refresh data when user returns to app
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now()
        const timeSinceLastCheck = now - lastVisibilityCheck.current
        lastVisibilityCheck.current = now

        // Only refresh if the app has been hidden for more than 1 minute
        if (timeSinceLastCheck > 60 * 1000) {
          // Check if the day has changed while app was idle
          const currentToday = getLocalDateString()
          if (selectedDate !== currentToday && isToday) {
            // Update to new day if we were viewing "today"
            setSelectedDate(currentToday)
          }

          // Try to refresh the session
          try {
            await updateSession()
          } catch (err) {
            console.error('Failed to refresh session:', err)
          }

          // Force re-render of scroll containers
          setRefreshKey(prev => prev + 1)

          // Re-fetch data
          if (userId) {
            setIsLoading(true)
            // Small delay to ensure DOM is ready after visibility change
            setTimeout(() => {
              // These will be called via the useEffect dependencies
            }, 100)
          }
        }
      }
    }

    // Handle page focus (for desktop browsers)
    const handleFocus = () => {
      const now = Date.now()
      const timeSinceLastCheck = now - lastVisibilityCheck.current

      // Only trigger on significant idle time
      if (timeSinceLastCheck > 60 * 1000) {
        handleVisibilityChange()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [selectedDate, isToday, userId, updateSession])

  // Get the last entry's end time for Quick Log auto-fill (memoized)
  const lastEntryEndTime = useMemo(() => {
    if (entries.length === 0) return null
    return entries.reduce((latest, entry) => {
      if (!entry.end_time) return latest
      if (!latest) return entry.end_time
      return entry.end_time > latest ? entry.end_time : latest
    }, null as string | null)
  }, [entries])

  const fetchEntries = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('date', selectedDate)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setEntries(data as TimeEntry[])
    }
    setIsLoading(false)
  }, [selectedDate, userId])

  // Fetch entries and calendar events for the selected date
  useEffect(() => {
    fetchEntries()
    // Fetch calendar events if date is not in cache
    if (!isDateInCache(selectedDate)) {
      fetchEventsForDate(selectedDate)
    }
  }, [fetchEntries, refreshKey, selectedDate, isDateInCache, fetchEventsForDate])

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate)
  }

  const handleRefresh = () => {
    fetchEntries()
  }

  const showToast = (message: string) => {
    setToast({ message })
  }

  // Handle drag to create new entry
  const handleDragCreate = (data: DragCreateData) => {
    setDragCreateData(data)
    setIsQuickLogOpen(true)
  }

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Don't render if not authenticated (will redirect)
  if (status === 'unauthenticated') {
    return null
  }

  // Show session error state (token refresh failed)
  if (hasSessionError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Session Expired</h1>
          <p className="mt-2 text-muted-foreground">
            Your Google Calendar access has expired or been revoked. Please sign in again to continue.
          </p>
          <Button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="mt-6"
          >
            <LogOut className="h-4 w-4" />
            Sign in again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-foreground">Time Logger</h1>

              {/* Navigation dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Open navigation menu">
                    <Menu className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onClick={() => setSelectedDate(today)}>
                    <Calendar className="h-4 w-4" />
                    Today
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/weekly-review')}>
                    <Sparkles className="h-4 w-4" />
                    <span className="flex-1">Weekly Review</span>
                    {isReviewDay() && (
                      <span className="ml-2 h-2 w-2 rounded-full bg-primary animate-pulse" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/intentions')}>
                    <Target className="h-4 w-4" />
                    My Intentions
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Search className="h-4 w-4" />
                      Go to date
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="p-0">
                      <CalendarPicker
                        selectedDate={selectedDate}
                        onDateSelect={(date) => {
                          handleDateChange(date)
                        }}
                        datesWithEntries={entries.map(e => e.date)}
                      />
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  {calendarStatus?.connected && (
                    <DropdownMenuItem
                      onClick={() => refreshCalendar()}
                      disabled={isCalendarLoading}
                    >
                      <RefreshCw className={`h-4 w-4 ${isCalendarLoading ? 'animate-spin' : ''}`} />
                      {isCalendarLoading ? 'Syncing...' : 'Sync Calendar'}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => router.push('/settings')}>
                    <Settings2 className="h-4 w-4" />
                    <span className="flex-1">Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
                    {session?.user?.email}
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    variant="destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Quick Log / Plan / Add button - disabled for dates 3+ days in the past */}
            <Button
                onClick={() => setIsQuickLogOpen(true)}
                disabled={!canLog}
                title={!canLog ? 'Logging disabled for old dates' : isFutureDay ? 'Plan entry (⌘K)' : isPastDay ? 'Add entry (⌘K)' : 'Quick Log (⌘K)'}
                aria-label={!canLog ? 'Logging is disabled for dates more than 2 days ago' : isFutureDay ? 'Plan a future entry' : isPastDay ? 'Add a past entry' : 'Quick log a time entry'}
                className={`shadow-lg text-white ${
                  !canLog
                    ? 'opacity-50 cursor-not-allowed bg-zinc-400'
                    : isFutureDay
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600'
                      : isPastDay
                        ? 'bg-gradient-to-r from-zinc-500 to-zinc-600 hover:from-zinc-600 hover:to-zinc-700'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                }`}
              >
                {isFutureDay ? (
                  <>
                    <Calendar className="h-4 w-4" />
                    <span className="hidden sm:inline">Plan</span>
                  </>
                ) : isPastDay ? (
                  <>
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add Entry</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    <span className="hidden sm:inline">Quick Log</span>
                  </>
                )}
            </Button>
          </div>
        </header>

        {/* Day View Content */}
        <>
            {/* Date Navigation */}
            <div className="mb-6 flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDateChange(getAdjacentDate(selectedDate, 'prev'))}
                aria-label="Previous day"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              <button
                onClick={() => dateInputRef.current?.showPicker()}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 hover:bg-accent"
              >
                <span className="text-lg font-semibold text-foreground">
                  {dateDisplay.label}
                </span>
                <span className="text-sm text-muted-foreground">
                  {dateDisplay.date}
                </span>
              </button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDateChange(getAdjacentDate(selectedDate, 'next'))}
                aria-label="Next day"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Time-of-day greeting - only show for today */}
            {isToday && <TimeOfDayGreeting name={session?.user?.preferredName} />}

            {/* Viewing-only message for old dates */}
            {!canLog && isPastDay && (
              <div className="mb-4 rounded-lg bg-zinc-100 px-4 py-3 text-center dark:bg-zinc-800">
                <p className="text-sm text-muted-foreground">
                  {VIEWING_PAST_MESSAGE}
                </p>
              </div>
            )}

            {/* Stats Card - only show for today */}
            {isToday && <StatsCard userId={userId} />}

            {/* Timeline */}
            <section>
              <TimelineView
                key={refreshKey}
                entries={entries}
                calendarEvents={calendarEvents}
                isLoading={isLoading}
                onEntryDeleted={fetchEntries}
                onGhostEntryClick={setSelectedGhostEvent}
                onDragCreate={canLog ? handleDragCreate : undefined}
                onShowToast={showToast}
                selectedDate={selectedDate}
                isToday={isToday}
                isFutureDay={isFutureDay}
                isPastDay={isPastDay}
                canLog={canLog}
              />
            </section>
        </>
      </div>

      <QuickLogModal
        isOpen={isQuickLogOpen}
        onClose={() => {
          setIsQuickLogOpen(false)
          setDragCreateData(null)
        }}
        onEntryAdded={() => {
          fetchEntries()
          setDragCreateData(null)
        }}
        lastEntryEndTime={lastEntryEndTime}
        initialStartTime={dragCreateData?.startTime}
        initialEndTime={dragCreateData?.endTime}
        onShowToast={showToast}
        userId={userId}
        calendarEvents={calendarEvents}
        entries={entries}
        selectedDate={selectedDate}
        isFutureDay={isFutureDay}
        isPastDay={isPastDay}
      />

      <GhostEntryModal
        event={selectedGhostEvent}
        onClose={() => setSelectedGhostEvent(null)}
        onConfirm={() => {
          setSelectedGhostEvent(null)
          fetchEntries()
          // No need to refresh calendar - ghost events are filtered by entries
        }}
        onShowToast={showToast}
        userId={userId}
        selectedDate={selectedDate}
      />

      {toast && (
        <Toast
          title="Entry added"
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={() => setShowOnboarding(false)}
      />
    </div>
    </ErrorBoundary>
  )
}

// Wrap in Suspense for useSearchParams
export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
