'use client'

import { Suspense, useMemo, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getUserToday, getRealToday, shiftDateString, TimePeriod } from '@/lib/types'
import { buildSessionInfos } from '@/lib/session-utils'
import { useSessionData } from '@/hooks/useSessionData'
import { useGreeting } from '@/hooks/useGreeting'
import { useDashboardState } from '@/hooks/useDashboardState'
import DashboardHero from '@/components/DashboardHero'
import type { TrendAPIResponse } from '@/lib/trend-types'
import OnboardingModal from '@/components/OnboardingModal'
import ErrorBoundary from '@/components/ErrorBoundary'
import GreetingHeader from '@/components/dashboard/GreetingHeader'
import YourPlan from '@/components/YourPlan'
import NextUp from '@/components/NextUp'
import FirstRunCard from '@/components/FirstRunCard'
import { Sun, Cloud, Moon, Check, ChevronRight, ClipboardList, Lock } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { MetricKey } from '@/lib/chart-colors'
import { STATUS_CLASSES } from '@/lib/palette'

// Dynamic import MetricDetailSheet to keep Recharts out of initial bundle
const MetricDetailSheet = dynamic(
  () => import('@/components/MetricDetailSheet'),
  { ssr: false, loading: () => null }
)

function HomeContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const userId = session?.user?.id || session?.user?.email || ''
  const today = getUserToday()

  // Date navigation state — read initial value from URL param
  const dateFromUrl = searchParams.get('date')
  const [selectedDate, setSelectedDate] = useState(dateFromUrl && /^\d{4}-\d{2}-\d{2}$/.test(dateFromUrl) ? dateFromUrl : today)
  const isToday = selectedDate === today
  const isFutureDate = selectedDate > today
  const canWrapUp = isToday || selectedDate === shiftDateString(today, -1)

  // Update URL when date changes (without full navigation)
  const handleDateChange = useCallback((newDate: string) => {
    setSelectedDate(newDate)
    const newToday = getUserToday()
    if (newDate === newToday) {
      window.history.replaceState(null, '', '/')
    } else {
      window.history.replaceState(null, '', `/?date=${newDate}`)
    }
  }, [])

  // Custom hooks
  const { showOnboarding, setShowOnboarding, currentHour } = useDashboardState({ session, status })
  const [planRefreshKey, setPlanRefreshKey] = useState(0)
  const { greeting, quotes, currentPeriod } = useGreeting(session?.user?.preferredName, currentHour)
  const { entries, completions, isLoading, fetchData } = useSessionData({ userId, today: selectedDate, currentHour: isToday ? currentHour : 23 })
  // Bumped when something is logged from Next up, so the rings move at once.
  const [ringsKey, setRingsKey] = useState(0)
  const handleNextUpChanged = useCallback(() => {
    fetchData()
    setRingsKey((key) => key + 1)
  }, [fetchData])

  // Sprint 2: Metric detail sheet state
  const [activeMetric, setActiveMetric] = useState<MetricKey | null>(null)
  const [trendData, setTrendData] = useState<TrendAPIResponse | null>(null)

  const handleMetricTap = useCallback((metric: MetricKey) => {
    setActiveMetric(metric)
  }, [])

  const handleSheetClose = useCallback(() => {
    setActiveMetric(null)
  }, [])

  const handleTrendDataLoaded = useCallback((data: TrendAPIResponse) => {
    setTrendData(data)
  }, [])

  // Build session infos — for past dates, treat all sessions as past (hour=23)
  const effectiveHour = isToday ? (currentHour ?? 12) : 23
  const sessionInfos = useMemo(() => {
    return buildSessionInfos(entries, completions, effectiveHour)
  }, [entries, completions, effectiveHour])

  // Navigate to logging page — pass date for non-today
  const handleLogClick = (period: TimePeriod) => {
    const url = isToday ? `/log/${period}` : `/log/${period}?date=${selectedDate}`
    router.push(url)
  }

  // Navigate to view session
  const handleViewClick = (period: TimePeriod) => {
    const url = isToday ? `/log/${period}` : `/log/${period}?date=${selectedDate}`
    router.push(url)
  }

  // Show loading state with skeleton session cards
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="mx-auto max-w-2xl px-4 py-4">
          {/* Skeleton header */}
          <header className="mb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-6 w-44" />
            </div>
          </header>

          {/* Hero section skeleton - 3 compact circles */}
          <div className="flex justify-center gap-5 mb-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <Skeleton className={`rounded-full ${i === 1 ? 'h-[100px] w-[100px]' : 'h-[90px] w-[90px]'}`} />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>

          {/* Session cards skeleton */}
          <div className="mt-4">
            <div className="rounded-xl border border-border p-4 mb-3">
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-lg p-3 bg-secondary/50">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3.5 w-40" />
                      </div>
                      <Skeleton className="h-4 w-4 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background pb-20">
        <div className="mx-auto max-w-2xl px-4 py-4">
          {/* 1. Header - date nav + greeting */}
          <GreetingHeader
            greeting={greeting}
            currentPeriod={currentPeriod}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            isToday={isToday}
          />

          {/* Rollover indicator: show during 12-3AM when viewing yesterday */}
          {isToday && today !== getRealToday() && (
            <p className="text-center text-xs text-muted-foreground mb-1">
              Entries logged after midnight save to {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          )}

          {/* The letter-spaced BETTER that used to sit here read as a label
              for the three rings directly beneath it. The launcher icon, the
              login screen and the tab title all carry the name already. */}

          {/* 3. HERO SECTION: Tappable metric circles + sparklines */}
          <DashboardHero
            onMetricTap={handleMetricTap}
            activeMetric={activeMetric}
            onTrendDataLoaded={handleTrendDataLoaded}
            date={selectedDate}
            refreshKey={ringsKey}
          />

          {/* For someone on their first day: the loop, as three things to do. */}
          {isToday && <FirstRunCard key={`first-run-${planRefreshKey}`} hasLoggedToday={entries.length > 0} />}

          {/* What the day holds — the plan and the calendar, carried over
              from the Plan tab to the screen the day is lived from. A day
              that is over is the review's business, not this list's. */}
          {(isToday || isFutureDate) && (
            <NextUp date={selectedDate} entries={entries} onChanged={handleNextUpChanged} />
          )}

          {/* Your day: the three sessions and the review they add up to, as
              one list. This was a heading, a card for the review, and a
              titled card holding three more cards with an icon in a circle
              each — six bordered boxes to say four things. */}
          <div className="mt-6">
            <h3 className="eyebrow mb-3">Your day</h3>
            <div className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
              {sessionInfos.map(info => {
                const isActive = isToday && info.period === currentPeriod
                const Icon = info.period === 'morning' ? Sun : info.period === 'afternoon' ? Cloud : Moon
                const periodLabel = info.period === 'morning' ? 'Morning' : info.period === 'afternoon' ? 'Afternoon' : 'Evening'

                // Three states, each with a cue that is not colour:
                // done has a tick, partial says so, and nothing logged is plain.
                const isDone = info.hasCompletion
                const hasEntries = info.hasEntries
                // "Not wrapped up" is a prompt, so it only shows while it
                // can be acted on: today and yesterday. On older days it
                // was a permanent amber mark against every session.
                const isPartial = hasEntries && !isDone && canWrapUp

                const rowTint = isDone
                  ? STATUS_CLASSES.green.tintStrong
                  : isPartial
                    ? STATUS_CLASSES.yellow.tintStrong
                    : isActive
                      ? 'bg-accent/50'
                      : ''

                const iconColour = isDone
                  ? STATUS_CLASSES.green.icon
                  : isPartial
                    ? STATUS_CLASSES.yellow.icon
                    : isActive
                      ? 'text-foreground'
                      : 'text-muted-foreground'

                const subtitle = (isDone || hasEntries)
                  ? `${info.entryCount} ${info.entryCount === 1 ? 'entry' : 'entries'}`
                  : isToday
                    ? (isActive ? 'Tap to log' : info.state === 'upcoming' ? 'Upcoming' : 'Not logged')
                    : isFutureDate ? 'Upcoming' : 'Not logged'

                return (
                  <button
                    key={info.period}
                    onClick={() => (isDone || hasEntries) ? handleViewClick(info.period) : handleLogClick(info.period)}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-accent/40 active:bg-accent/60 ${rowTint}`}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${iconColour}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${isActive ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                        {periodLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">{subtitle}</p>
                    </div>
                    {isDone ? (
                      <Check className={`h-4 w-4 shrink-0 ${STATUS_CLASSES.green.icon}`} aria-label="Done" />
                    ) : isPartial ? (
                      <span className={`shrink-0 text-xs ${STATUS_CLASSES.yellow.text}`}>Not wrapped up</span>
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                )
              })}

              {(() => {
                const pastNine = (currentHour ?? 0) >= 21
                // A day that has not happened has nothing to review.
                const unlocked = isFutureDate ? false : !isToday || pastNine

                return (
                  <button
                    onClick={() => unlocked && router.push(`/day-review?date=${selectedDate}`)}
                    disabled={!unlocked}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 ${
                      unlocked ? 'hover:bg-accent/40 active:bg-accent/60' : 'cursor-default'
                    }`}
                  >
                    {unlocked ? (
                      <ClipboardList className="h-5 w-5 shrink-0 text-foreground" />
                    ) : (
                      <Lock className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
                        Day in review
                      </p>
                      {!unlocked && (
                        <p className="text-xs text-muted-foreground">
                          {isFutureDate ? 'Nothing to review yet' : 'Opens at 9:00 PM'}
                        </p>
                      )}
                    </div>
                    {unlocked && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  </button>
                )
              })()}
            </div>
          </div>

          {/* 5. YOUR PLAN section */}
          <YourPlan key={`goals-${planRefreshKey}`} date={selectedDate} isToday={isToday} />
        </div>

        {/* MetricDetailSheet — rendered at page level */}
        <MetricDetailSheet
          metric={activeMetric ?? 'focus'}
          isOpen={activeMetric !== null}
          onClose={handleSheetClose}
          initialData={trendData}
        />

        <OnboardingModal
          isOpen={showOnboarding}
          onComplete={(next) => {
            setShowOnboarding(false)
            // Onboarding has just created a goal. The plan section fetched
            // before it existed and nothing told it to look again, so the
            // first screen a new user saw said "No goals set yet".
            try { sessionStorage.removeItem('your-plan-cache') } catch { /* ignore */ }
            setPlanRefreshKey((key) => key + 1)
            // They picked what matters: go and find it a time, which is the
            // one thing this app does that the calendar does not.
            if (next) router.push(`/calendar?date=${next.planDate}&suggest=1`)
          }}
        />
      </div>
    </ErrorBoundary>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
