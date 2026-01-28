'use client'

import { Suspense, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { getUserToday, TimePeriod } from '@/lib/types'
import { buildSessionInfos } from '@/lib/session-utils'
import { useSessionData } from '@/hooks/useSessionData'
import { useGreeting } from '@/hooks/useGreeting'
import { useDashboardState } from '@/hooks/useDashboardState'
import DashboardHero from '@/components/DashboardHero'
import OnboardingModal from '@/components/OnboardingModal'
import ErrorBoundary from '@/components/ErrorBoundary'
import MoodCheckIn from '@/components/MoodCheckIn'
import FocusSession from '@/components/FocusSession'
import DayInReview from '@/components/DayInReview'
import InsightsTeaser from '@/components/insights/InsightsTeaser'
import GreetingHeader from '@/components/dashboard/GreetingHeader'
import MotivationalQuote from '@/components/dashboard/MotivationalQuote'
import { Sun, Cloud, Moon, CheckCircle2, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

function HomeContent() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const userId = session?.user?.id || session?.user?.email || ''
  const today = getUserToday()

  // Custom hooks
  const { showOnboarding, setShowOnboarding, currentHour } = useDashboardState({ session, status })
  const { greeting, quotes, currentPeriod } = useGreeting(session?.user?.preferredName, currentHour)
  const { entries, completions, isLoading } = useSessionData({ userId, today, currentHour })

  // Build session infos (use 12 as fallback for server render)
  const sessionInfos = useMemo(() => {
    return buildSessionInfos(entries, completions, currentHour ?? 12)
  }, [entries, completions, currentHour])

  // Navigate to logging page
  const handleLogClick = (period: TimePeriod) => {
    router.push(`/log/${period}`)
  }

  // Navigate to view session (same as log for now)
  const handleViewClick = (period: TimePeriod) => {
    router.push(`/log/${period}`)
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

          {/* Quote skeleton */}
          <div className="mb-3 rounded-xl border border-border p-3">
            <Skeleton className="h-3.5 w-3/4 mb-1.5" />
            <Skeleton className="h-3 w-1/2" />
          </div>

          {/* Mood check-in skeleton */}
          <div className="mb-3 rounded-xl border border-border p-3">
            <Skeleton className="h-4 w-32 mb-2" />
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-7 w-7 rounded-full" />
              ))}
            </div>
          </div>

          {/* Session cards skeleton */}
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border p-3">
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
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background pb-20">
        <div className="mx-auto max-w-2xl px-4 py-4">
          {/* Header - compact greeting */}
          <GreetingHeader greeting={greeting} currentPeriod={currentPeriod} />

          {/* === HERO SECTION: Compact metric circles === */}
          <DashboardHero />

          {/* ═══ MY DAY SECTION — Whoop style ═══ */}
          <div className="mt-2">
            {/* Section header */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-foreground">My Day</h2>
            </div>

            {/* Day in Review banner — shows after 9pm */}
            <DayInReview className="mb-3" />

            {/* MOOD CHECKER */}
            <MoodCheckIn period={currentPeriod} className="mb-3" />

            {/* SESSIONS card — Morning / Afternoon / Evening */}
            <div className="rounded-xl bg-[#152535] border border-[rgba(255,255,255,0.05)] p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#6b8299]">
                  Sessions
                </h3>
              </div>
              <div className="space-y-2">
                {sessionInfos.map(info => {
                  const isActive = info.period === currentPeriod
                  const isLogged = info.state === 'logged'
                  const Icon = info.period === 'morning' ? Sun : info.period === 'afternoon' ? Cloud : Moon
                  const periodLabel = info.period === 'morning' ? 'Morning' : info.period === 'afternoon' ? 'Afternoon' : 'Evening'

                  return (
                    <button
                      key={info.period}
                      onClick={() => isLogged ? handleViewClick(info.period) : handleLogClick(info.period)}
                      className={`w-full flex items-center gap-3 rounded-lg px-3 py-3 transition-all ${
                        isActive
                          ? 'bg-[#1e3a4f] border border-[rgba(0,220,130,0.2)]'
                          : 'bg-[#1b3044]/50 border border-transparent hover:bg-[#1e3a4f]/50'
                      }`}
                    >
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        isLogged ? 'bg-[#00dc82]/15' : isActive ? 'bg-[#3b82f6]/15' : 'bg-[#1b3044]'
                      }`}>
                        <Icon className={`h-4 w-4 ${
                          isLogged ? 'text-[#00dc82]' : isActive ? 'text-[#3b82f6]' : 'text-[#4a5f78]'
                        }`} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className={`text-sm font-medium ${
                          isActive ? 'text-foreground' : 'text-[#c8d6e0]'
                        }`}>
                          {periodLabel}
                        </p>
                        <p className="text-[11px] text-[#6b8299]">
                          {isLogged
                            ? `${info.entryCount} entries · ${Math.round(info.totalMinutes)}m logged`
                            : isActive ? 'Tap to log' : info.state === 'upcoming' ? 'Upcoming' : 'Not logged'
                          }
                        </p>
                      </div>
                      {isLogged && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00dc82]">
                          <CheckCircle2 className="h-3 w-3 text-[#0d1b2a]" />
                        </div>
                      )}
                      <ChevronRight className={`h-4 w-4 ${isActive ? 'text-[#6b8299]' : 'text-[#3a4f5f]'}`} />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Focus Session */}
            <div className="mb-3">
              <FocusSession />
            </div>

            {/* Motivational quote */}
            <MotivationalQuote quote={quotes[currentPeriod]} currentPeriod={currentPeriod} />

            {/* Insights teaser */}
            <InsightsTeaser className="mt-3" />
          </div>
        </div>

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
