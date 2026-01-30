'use client'

import { Suspense, useMemo, useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getUserToday, TimePeriod } from '@/lib/types'
import { buildSessionInfos } from '@/lib/session-utils'
import { useSessionData } from '@/hooks/useSessionData'
import { useGreeting } from '@/hooks/useGreeting'
import { useDashboardState } from '@/hooks/useDashboardState'
import DashboardHero from '@/components/DashboardHero'
import type { TrendAPIResponse } from '@/lib/trend-types'
import OnboardingModal from '@/components/OnboardingModal'
import ErrorBoundary from '@/components/ErrorBoundary'
import GreetingHeader from '@/components/dashboard/GreetingHeader'
import { Sun, Cloud, Moon, CheckCircle2, ChevronRight, ClipboardList } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { MetricKey } from '@/lib/chart-colors'

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
  const { greeting, quotes, currentPeriod } = useGreeting(session?.user?.preferredName, currentHour)
  const { entries, completions, isLoading } = useSessionData({ userId, today: selectedDate, currentHour: isToday ? currentHour : 23 })

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

  // Build session infos (use 12 as fallback for server render)
  const sessionInfos = useMemo(() => {
    return buildSessionInfos(entries, completions, currentHour ?? 12)
  }, [entries, completions, currentHour])

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

          {/* 2. Brand wordmark */}
          <p className="text-center text-[13px] font-bold uppercase tracking-[0.3em] text-muted-foreground mb-3">
            Better
          </p>

          {/* 3. HERO SECTION: Tappable metric circles + sparklines */}
          <DashboardHero
            onMetricTap={handleMetricTap}
            activeMetric={activeMetric}
            onTrendDataLoaded={handleTrendDataLoaded}
            date={selectedDate}
          />

          {/* 3. MY DAY section */}
          <div className="mt-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              My Day
            </h3>

            {/* Your Day In Review — shows after evening logged or past 9pm */}
            {(() => {
              const eveningLogged = sessionInfos.find(s => s.period === 'evening')?.state === 'logged'
              const pastNine = (currentHour ?? 0) >= 21
              const showReview = !isToday || eveningLogged || pastNine
              if (!showReview) return null
              return (
                <button
                  onClick={() => router.push(isToday ? '/day-review' : `/day-review?date=${selectedDate}`)}
                  className="w-full flex items-center gap-3 rounded-xl bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/20 px-4 py-3.5 mb-3 transition-all hover:from-primary/30 hover:to-primary/10"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15">
                    <ClipboardList className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <span className="flex-1 text-left text-sm font-medium text-foreground">
                    Your Day In Review
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )
            })()}

            {/* Sessions card */}
            <div className="rounded-xl bg-card border border-border p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sessions
                </h3>
              </div>
              <div className="space-y-2">
                {sessionInfos.map(info => {
                  const isActive = isToday && info.period === currentPeriod
                  const isLogged = info.state === 'logged'
                  const Icon = info.period === 'morning' ? Sun : info.period === 'afternoon' ? Cloud : Moon
                  const periodLabel = info.period === 'morning' ? 'Morning' : info.period === 'afternoon' ? 'Afternoon' : 'Evening'

                  return (
                    <button
                      key={info.period}
                      onClick={() => isLogged ? handleViewClick(info.period) : handleLogClick(info.period)}
                      className={`w-full flex items-center gap-3 rounded-lg px-3 py-3 transition-all ${
                        isActive
                          ? 'bg-accent border border-primary/20'
                          : 'bg-secondary/50 border border-transparent hover:bg-accent/50'
                      }`}
                    >
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        isLogged ? 'bg-primary/15' : isActive ? 'bg-blue-500/15' : 'bg-secondary'
                      }`}>
                        <Icon className={`h-4 w-4 ${
                          isLogged ? 'text-primary' : isActive ? 'text-blue-500' : 'text-muted-foreground'
                        }`} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className={`text-sm font-medium ${
                          isActive ? 'text-foreground' : 'text-secondary-foreground'
                        }`}>
                          {periodLabel}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {isLogged
                            ? `${info.entryCount} entries · ${Math.round(info.totalMinutes)}m logged`
                            : isToday
                              ? (isActive ? 'Tap to log' : info.state === 'upcoming' ? 'Upcoming' : 'Not logged')
                              : 'Not logged'
                          }
                        </p>
                      </div>
                      {isLogged && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                          <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                      <ChevronRight className={`h-4 w-4 ${isActive ? 'text-muted-foreground' : 'text-muted-foreground/50'}`} />
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
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
          onComplete={() => setShowOnboarding(false)}
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
