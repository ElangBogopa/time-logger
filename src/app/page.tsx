'use client'

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  TimeEntry,
  getUserToday,
  getUserCurrentHour,
  TimePeriod,
  SessionCompletion,
  getCurrentPeriod,
} from '@/lib/types'
import {
  buildSessionInfos,
  canLogYesterdayEvening,
  getYesterdayDateString,
} from '@/lib/session-utils'
import { getRandomQuote } from '@/lib/quotes'
import IntentionsCarousel from '@/components/IntentionsCarousel'
import SessionCard from '@/components/SessionCard'
import OnboardingModal from '@/components/OnboardingModal'
import ErrorBoundary from '@/components/ErrorBoundary'
import MoodCheckIn from '@/components/MoodCheckIn'
import DayInReview from '@/components/DayInReview'
import { Loader2, Moon } from 'lucide-react'

function getTimeOfDayGreeting(name?: string, hour?: number | null): { text: string; emoji: string } {
  const h = hour ?? 12 // Default to noon for server render
  const nameGreeting = name ? `, ${name}` : ''

  // Handle late-night hours (24-27 = midnight to 3am, still evening)
  if (h >= 24) {
    return { text: `Good evening${nameGreeting}`, emoji: '🌙' }
  } else if (h < 12) {
    return { text: `Good morning${nameGreeting}`, emoji: '☀️' }
  } else if (h < 18) {
    return { text: `Good afternoon${nameGreeting}`, emoji: '🌤️' }
  } else {
    return { text: `Good evening${nameGreeting}`, emoji: '🌙' }
  }
}

function HomeContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [completions, setCompletions] = useState<SessionCompletion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [hasCheckedIntentions, setHasCheckedIntentions] = useState(false)
  const [yesterdayEveningLogged, setYesterdayEveningLogged] = useState(true)
  // Hydration-safe: initialize to null, set on client
  const [currentHour, setCurrentHour] = useState<number | null>(null)

  const userId = session?.user?.id || session?.user?.email || ''
  const today = getUserToday()
  const currentPeriod = currentHour !== null ? getCurrentPeriod(currentHour) : 'morning'

  // Set current hour on client to avoid hydration mismatch
  // Uses getUserCurrentHour which returns 24+ for late night (before 3am)
  useEffect(() => {
    setCurrentHour(getUserCurrentHour())
  }, [])

  // Handle calendar connection URL params - redirect to connections page
  useEffect(() => {
    const hasCalendarParams = searchParams.has('calendar_connected') ||
      searchParams.has('conflict_email') ||
      searchParams.has('pending_id') ||
      (searchParams.get('error')?.startsWith('calendar_'))

    if (hasCalendarParams) {
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

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // Check if user needs onboarding
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id || hasCheckedIntentions) {
      return
    }

    const controller = new AbortController()

    async function checkIntentions() {
      try {
        const response = await fetch('/api/intentions', {
          signal: controller.signal,
        })
        if (response.ok) {
          const data = await response.json()
          if (!data.intentions || data.intentions.length === 0) {
            setShowOnboarding(true)
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        console.error('Failed to check intentions:', error)
      } finally {
        if (!controller.signal.aborted) {
          setHasCheckedIntentions(true)
        }
      }
    }

    checkIntentions()
    return () => controller.abort()
  }, [status, session?.user?.id, hasCheckedIntentions])

  // Fetch today's entries and session completions
  const fetchData = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)

    try {
      const [entriesResult, completionsResult] = await Promise.all([
        supabase
          .from('time_entries')
          .select('*')
          .eq('user_id', userId)
          .eq('date', today)
          .eq('status', 'confirmed')
          .order('start_time'),
        supabase
          .from('session_completions')
          .select('*')
          .eq('user_id', userId)
          .eq('date', today),
      ])

      if (entriesResult.data) {
        setEntries(entriesResult.data as TimeEntry[])
      }
      if (completionsResult.data) {
        setCompletions(completionsResult.data as SessionCompletion[])
      }

      // Check if yesterday's evening was logged (for morning prompt)
      // Use 12 as fallback (won't show prompt) if currentHour not yet set
      if (currentHour !== null && canLogYesterdayEvening(currentHour)) {
        const yesterday = getYesterdayDateString()
        const { data: yesterdayCompletions } = await supabase
          .from('session_completions')
          .select('*')
          .eq('user_id', userId)
          .eq('date', yesterday)
          .eq('period', 'evening')
          .single()

        setYesterdayEveningLogged(!!yesterdayCompletions)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [userId, today, currentHour])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Build session infos (use 12 as fallback for server render)
  const sessionInfos = useMemo(() => {
    return buildSessionInfos(entries, completions, currentHour ?? 12)
  }, [entries, completions, currentHour])

  // Get quotes for each period (stable per day, generated on client to avoid hydration mismatch)
  const [quotes, setQuotes] = useState<Record<TimePeriod, string>>({
    morning: '',
    afternoon: '',
    evening: '',
  })

  useEffect(() => {
    setQuotes({
      morning: getRandomQuote('morning'),
      afternoon: getRandomQuote('afternoon'),
      evening: getRandomQuote('evening'),
    })
  }, [])

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

  // Show loading state
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  const greeting = getTimeOfDayGreeting(session?.user?.preferredName, currentHour)

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background pb-20">
        <div className="mx-auto max-w-2xl px-4 py-6">
          {/* Header */}
          <header className="mb-6">
            <div className="flex items-center gap-2">
              <span className="text-3xl" role="img" aria-label={currentPeriod}>
                {greeting.emoji}
              </span>
              <h1 className="text-2xl font-bold text-foreground">{greeting.text}</h1>
            </div>

            {/* Motivational quote for current period */}
            {quotes[currentPeriod] && (
              <div className="mt-4 rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-800/50 dark:to-zinc-900/50 p-4 border border-zinc-200/50 dark:border-zinc-700/50">
                <p className="text-sm text-muted-foreground italic leading-relaxed">
                  &ldquo;{quotes[currentPeriod].split(' — ')[0]}&rdquo;
                </p>
                {quotes[currentPeriod].includes(' — ') && (
                  <p className="text-xs text-muted-foreground/70 mt-2">
                    — {quotes[currentPeriod].split(' — ')[1]}
                  </p>
                )}
              </div>
            )}
          </header>

          {/* Mood Check-in for current session */}
          <MoodCheckIn period={currentPeriod} className="mb-6" />

          {/* Intentions Carousel */}
          <IntentionsCarousel userId={userId} />

          {/* Yesterday's evening prompt (if not logged and it's morning) */}
          {!yesterdayEveningLogged && currentPeriod === 'morning' && (
            <button
              onClick={handleLogYesterdayEvening}
              className="w-full mb-4 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 p-4 text-left hover:border-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/10">
                  <Moon className="h-5 w-5 text-indigo-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Yesterday&apos;s evening not logged</p>
                  <p className="text-xs text-muted-foreground">
                    Tap to log what you did last night
                  </p>
                </div>
              </div>
            </button>
          )}

          {/* Session Cards */}
          <div className="space-y-4">
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
