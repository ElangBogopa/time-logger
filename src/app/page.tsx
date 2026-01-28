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
import SessionCard from '@/components/SessionCard'
import OnboardingModal from '@/components/OnboardingModal'
import ErrorBoundary from '@/components/ErrorBoundary'
import MoodCheckIn from '@/components/MoodCheckIn'
import MorningCheckin from '@/components/MorningCheckin'
import FocusSession from '@/components/FocusSession'
import DayInReview from '@/components/DayInReview'
import InsightsTeaser from '@/components/insights/InsightsTeaser'
import GreetingHeader from '@/components/dashboard/GreetingHeader'
import MotivationalQuote from '@/components/dashboard/MotivationalQuote'
import { Moon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

function HomeContent() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const userId = session?.user?.id || session?.user?.email || ''
  const today = getUserToday()

  // Custom hooks
  const { showOnboarding, setShowOnboarding, currentHour } = useDashboardState({ session, status })
  const { greeting, quotes, currentPeriod } = useGreeting(session?.user?.preferredName, currentHour)
  const { entries, completions, isLoading, yesterdayEveningLogged } = useSessionData({ userId, today, currentHour })

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

  // Handle yesterday's evening
  const handleLogYesterdayEvening = () => {
    router.push('/log/evening?date=yesterday')
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
          <div className="mb-3 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 p-3">
            <Skeleton className="h-3.5 w-3/4 mb-1.5" />
            <Skeleton className="h-3 w-1/2" />
          </div>

          {/* Mood check-in skeleton */}
          <div className="mb-3 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
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
              <div key={i} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
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

          {/* Motivational quote for current period */}
          <MotivationalQuote quote={quotes[currentPeriod]} currentPeriod={currentPeriod} />

          {/* Mood Check-in for current session */}
          <MoodCheckIn period={currentPeriod} className="mb-3" />

          {/* Morning Check-in (sleep, energy, priority) */}
          <MorningCheckin className="mb-3" />

          {/* Yesterday's evening prompt (if not logged and it's morning) */}
          {!yesterdayEveningLogged && currentPeriod === 'morning' && (
            <button
              onClick={handleLogYesterdayEvening}
              className="w-full mb-3 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 p-3 text-left hover:border-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/10">
                  <Moon className="h-4 w-4 text-indigo-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Yesterday&apos;s evening not logged</p>
                  <p className="text-[11px] text-muted-foreground">
                    Tap to log what you did last night
                  </p>
                </div>
              </div>
            </button>
          )}

          {/* Focus Session */}
          <div className="mb-3">
            <FocusSession />
          </div>

          {/* Session Cards */}
          <div className="space-y-3">
            {sessionInfos.map(info => (
              <SessionCard
                key={info.period}
                period={info.period}
                state={info.state}
                entryCount={info.entryCount}
                totalMinutes={info.totalMinutes}
                quote={quotes[info.period]}
                onLogClick={() => handleLogClick(info.period)}
                onViewClick={() => handleViewClick(info.period)}
              />
            ))}
          </div>

          {/* Day in Review - shows after 9pm */}
          <DayInReview className="mt-4" />

          {/* Insights teaser — show top 1-2 insights */}
          <InsightsTeaser className="mt-4" />

          {/* Prompt text */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Log your activities when each session ends
          </p>
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
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
