'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TimeEntry, getLocalDateString } from '@/lib/types'
import TimeEntryForm from '@/components/TimeEntryForm'
import TimelineView, { CalendarEvent } from '@/components/TimelineView'
import WeeklySummary from '@/components/WeeklySummary'
import StatsCard from '@/components/StatsCard'
import QuickLogModal from '@/components/QuickLogModal'
import Toast from '@/components/Toast'
import GhostEntryModal from '@/components/GhostEntryModal'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Menu, Calendar, BarChart3, Search, LogOut, ChevronLeft, ChevronRight, Plus, X, Zap, Loader2 } from 'lucide-react'

type View = 'day' | 'weekly'

function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (dateStr === getLocalDateString(today)) {
    return 'Today'
  } else if (dateStr === getLocalDateString(yesterday)) {
    return 'Yesterday'
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function getAdjacentDate(dateStr: string, direction: 'prev' | 'next'): string {
  const date = new Date(dateStr + 'T00:00:00')
  date.setDate(date.getDate() + (direction === 'next' ? 1 : -1))
  return getLocalDateString(date)
}

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(getLocalDateString())
  const [view, setView] = useState<View>('day')
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false)
  const [isFormExpanded, setIsFormExpanded] = useState(false)
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [selectedGhostEvent, setSelectedGhostEvent] = useState<CalendarEvent | null>(null)
  const [toast, setToast] = useState<{ message: string } | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  // Get user ID from session
  const userId = session?.user?.id || session?.user?.email || ''

  const today = getLocalDateString()
  const isToday = selectedDate === today
  const canGoNext = selectedDate < today

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // Get the last entry's end time for Quick Log auto-fill
  const lastEntryEndTime = entries.length > 0
    ? entries.reduce((latest, entry) => {
        if (!entry.end_time) return latest
        if (!latest) return entry.end_time
        return entry.end_time > latest ? entry.end_time : latest
      }, null as string | null)
    : null

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

  // Fetch calendar events for the selected date
  const fetchCalendarEvents = useCallback(async () => {
    if (!session?.accessToken) return

    try {
      const response = await fetch(`/api/calendar/events?date=${selectedDate}`)
      if (response.ok) {
        const data = await response.json()
        // Filter out all-day events and events without times
        const timedEvents = (data.events || []).filter(
          (e: CalendarEvent) => !e.isAllDay && e.startTime && e.endTime
        )
        setCalendarEvents(timedEvents)
      }
    } catch (err) {
      console.error('Failed to fetch calendar events:', err)
    }
  }, [selectedDate, session?.accessToken])

  useEffect(() => {
    if (view === 'day') {
      fetchEntries()
      fetchCalendarEvents()
    }
  }, [fetchEntries, fetchCalendarEvents, view])

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate)
    setView('day')
  }

  const handleRefresh = () => {
    fetchEntries()
    setIsFormExpanded(false)
  }

  const showToast = (message: string) => {
    setToast({ message })
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

  return (
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
                  <Button variant="ghost" size="icon-sm">
                    <Menu className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onClick={() => {
                    setSelectedDate(today)
                    setView('day')
                  }}>
                    <Calendar className="h-4 w-4" />
                    Today
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setView('weekly')}>
                    <BarChart3 className="h-4 w-4" />
                    Weekly Summary
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => dateInputRef.current?.showPicker()}>
                    <Search className="h-4 w-4" />
                    Go to date...
                  </DropdownMenuItem>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={selectedDate}
                    max={today}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="sr-only"
                  />
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

            {/* Quick Log button */}
            {view === 'day' && isToday && (
              <Button
                onClick={() => setIsQuickLogOpen(true)}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg"
              >
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">Quick Log</span>
              </Button>
            )}
          </div>
        </header>

        {view === 'day' ? (
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
                className="flex items-center gap-2 rounded-lg px-4 py-2 hover:bg-accent"
              >
                <span className="text-lg font-semibold text-foreground">
                  {formatDateDisplay(selectedDate)}
                </span>
                {!isToday && (
                  <span className="text-sm text-muted-foreground">
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => canGoNext && handleDateChange(getAdjacentDate(selectedDate, 'next'))}
                disabled={!canGoNext}
                aria-label="Next day"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Stats Card - only show for today */}
            {isToday && <StatsCard userId={userId} />}

            {/* Add Entry - Collapsible */}
            {isToday && (
              <div className="mb-6">
                {isFormExpanded ? (
                  <section className="rounded-xl border bg-card p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-foreground">
                        Add Entry
                      </h2>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setIsFormExpanded(false)}
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                    <TimeEntryForm onEntryAdded={handleRefresh} onShowToast={showToast} userId={userId} />
                  </section>
                ) : (
                  <button
                    onClick={() => setIsFormExpanded(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
                    Add detailed entry
                  </button>
                )}
              </div>
            )}

            {/* Timeline */}
            <section>
              <TimelineView
                entries={entries}
                calendarEvents={calendarEvents}
                isLoading={isLoading}
                onEntryDeleted={fetchEntries}
                onGhostEntryClick={setSelectedGhostEvent}
                selectedDate={selectedDate}
                isToday={isToday}
              />
            </section>
          </>
        ) : (
          /* Weekly Summary View */
          <section className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Weekly Summary</h2>
              <Button
                variant="link"
                onClick={() => setView('day')}
                className="text-sm"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to today
              </Button>
            </div>
            <WeeklySummary userId={userId} />
          </section>
        )}
      </div>

      <QuickLogModal
        isOpen={isQuickLogOpen}
        onClose={() => setIsQuickLogOpen(false)}
        onEntryAdded={fetchEntries}
        lastEntryEndTime={lastEntryEndTime}
        onShowToast={showToast}
        userId={userId}
        calendarEvents={calendarEvents}
        entries={entries}
      />

      <GhostEntryModal
        event={selectedGhostEvent}
        onClose={() => setSelectedGhostEvent(null)}
        onConfirm={() => {
          setSelectedGhostEvent(null)
          fetchEntries()
          fetchCalendarEvents()
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
    </div>
  )
}
