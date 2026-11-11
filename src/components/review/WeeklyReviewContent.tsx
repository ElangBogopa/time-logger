'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { csrfFetch } from '@/lib/api'
import { ChevronLeft, ChevronRight, Loader2, TrendingUp, TrendingDown, Minus, Sparkles, BarChart3, Grid3X3, ArrowRight, Trophy, CalendarClock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getLocalDateString, getWeekStartForDate, shiftDateString, getUserToday } from '@/lib/types'
import { MetricRingRow } from '@/components/MetricRings'
import type { MetricKey } from '@/lib/chart-colors'
import { cacheGet, cacheSet } from '@/lib/client-cache'
import { readCachedText, writeCachedText, storedFingerprint } from '@/lib/ai-text-cache'
import { STATUS_CLASSES } from '@/lib/palette'
import { METRIC_THRESHOLDS } from '@/lib/metrics-calc'

// ─── Types matching API route response ────────────────

interface WeekHighlight {
  type: string
  text: string
  subtext?: string
}

interface TargetProgressItem {
  target: { id: string; target_type: string; weekly_target_minutes: number }
  label: string
  currentMinutes: number
  targetMinutes: number
  percentage: number | null
  trend: 'up' | 'down' | 'same' | null
  previousMinutes: number | null
  isLimitTarget: boolean
  changeMinutes: number | null
  feedbackMessage: string | null
  feedbackTone: 'success' | 'warning' | 'neutral' | 'danger' | null
}

interface TargetDayScore {
  date: string
  day: string
  rating: 'good' | 'neutral' | 'rough' | 'no_data'
  targetMinutes: number
}

interface TargetScorecard {
  targetId: string
  targetLabel: string
  isLimitTarget: boolean
  days: TargetDayScore[]
  goodDays: number
  roughDays: number
}

interface CategoryBreakdownItem {
  category: string
  label: string
  minutes: number
  percentage: number
  entryCount: number
}

interface WeeklyReviewData {
  weekStart: string
  weekEnd: string
  /** The week's own averages; absent on responses cached before it existed. */
  averages?: { body: number; focus: number; social: number } | null
  activeDays: number
  evaluatedDays?: number
  highlights: WeekHighlight[]
  totalMinutes: number
  entryCount: number
  previousWeekMinutes: number | null
  previousWeekEntryCount: number
  hasEnoughData: boolean
  hasPreviousWeekData: boolean
  targetProgress: TargetProgressItem[]
  targetScorecards: TargetScorecard[]
  categoryBreakdown: CategoryBreakdownItem[]
  bestDays: string[]
  bestHours: string[]
  insights: string[]
  coachSummary: string | null
}

const CACHE_NAMESPACE = 'week'

// ─── Helpers ────────────────

function getWeekStart(d: Date) {
  return getWeekStartForDate(getLocalDateString(d), 1)
}

function formatWeekRange(start: string, end: string) {
  const s = new Date(start + 'T12:00:00')
  const e = new Date(end + 'T12:00:00')
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`
}

function formatMinutes(m: number) {
  const h = Math.floor(m / 60)
  const mins = m % 60
  return h > 0 ? `${h}h ${mins}m` : `${mins}m`
}

const RATING_STYLES = {
  good: 'bg-[#7D9B8A] text-[#7D9B8A] dark:bg-[#7D9B8A]/30 dark:text-[#9BB5A6]',
  neutral: 'bg-[#B5A07A] text-[#B5A07A] dark:bg-[#B5A07A]/30 dark:text-[#CBB894]',
  rough: 'bg-[#A8706A] text-[#A8706A] dark:bg-[#A8706A]/30 dark:text-[#C79089]',
  no_data: 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500',
}

const RATING_ICONS = { good: '✓', neutral: '~', rough: '✗', no_data: '—' }

// ─── Component ────────────────

export default function WeeklyReviewContent() {
  const { status } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()))
  const [metrics, setMetrics] = useState<Record<MetricKey, number> | null>(null)
  const [reviewData, setReviewData] = useState<WeeklyReviewData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchReview = useCallback(async () => {
    setError(null)
    const cacheKey = `weekly-review:${weekStart}`
    const cached = cacheGet<WeeklyReviewData>(cacheKey)
    if (cached) {
      setReviewData(cached)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      // Tell the server which coach summary we already hold. If the week's
      // numbers still hash to the same thing it skips the model entirely —
      // this used to generate a fresh summary on every view of this tab.
      const knownCoachFingerprint = storedFingerprint(CACHE_NAMESPACE, weekStart) ?? undefined
      const response = await csrfFetch('/api/weekly-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, timezone, knownCoachFingerprint }),
      })
      if (!response.ok) {
        const errBody = await response.text().catch(() => '')
        console.error('Weekly review API error:', response.status, errBody)
        throw new Error(`Failed to fetch review (${response.status})`)
      }
      const data = await response.json()

      if (data.coachSummary && data.coachFingerprint) {
        writeCachedText(CACHE_NAMESPACE, weekStart, data.coachFingerprint, data.coachSummary)
      } else if (data.coachSummaryUnchanged && data.coachFingerprint) {
        // The server skipped generation because our fingerprint matched.
        data.coachSummary = readCachedText(CACHE_NAMESPACE, weekStart, data.coachFingerprint)
      }

      cacheSet(cacheKey, data)
      setReviewData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }, [weekStart])

  useEffect(() => {
    if (status === 'authenticated') fetchReview()
  }, [status, fetchReview])

  // The week's Body / Mind / Heart, averaged over its seven days. The ring
  // here used to be a weekScore: 50 points for active days ÷ evaluated days,
  // plus 50 for averaging three entries a day. Log three things daily and it
  // read 100, whatever those things were.
  useEffect(() => {
    if (status !== 'authenticated') return
    let cancelled = false
    const weekEnd = shiftDateString(weekStart, 6)
    const today = getUserToday()
    fetch(`/api/metrics/trend?period=7d&date=${weekEnd > today ? today : weekEnd}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setMetrics({ body: data.body.average, focus: data.focus.average, social: data.social.average })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [status, weekStart])

  const goToPreviousWeek = () => {
    setWeekStart(shiftDateString(weekStart, -7))
  }

  const goToNextWeek = () => {
    const newWeekStart = shiftDateString(weekStart, 7)
    if (newWeekStart <= getWeekStart(new Date())) setWeekStart(newWeekStart)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[#A8706A] dark:border-[#A8706A] p-6 text-center">
        <p className="text-[#A8706A] mb-3">{error}</p>
        <button onClick={fetchReview} className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm">
          Try again
        </button>
      </div>
    )
  }

  if (!reviewData) return null

  const isCurrentWeek = weekStart === getWeekStart(new Date())

  if (!reviewData.hasEnoughData) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-semibold mb-2">Not enough data yet</h2>
        <p className="text-sm text-muted-foreground">
          Log at least 7 entries this week to unlock your weekly review.
          <br />You have {reviewData.entryCount} so far.
        </p>
      </div>
    )
  }

  // The line under the rings, read off the rings. It was a label for a
  // retired score built from active days and entries per day, which said
  // "Exceptional week" with none of the three on target.
  // The rings show this week, from the same per-day scores the summary is
  // written from. They were fed by a separate request for the trailing
  // seven days ending today — a different window — so the rings could read
  // Body 57 while the paragraph beneath them praised a Body of 92.
  const ringValues: Record<MetricKey, number> | null = reviewData.averages ?? metrics

  const weekLabel = (() => {
    if (!ringValues) return ''
    const onTarget = (Object.values(ringValues) as number[]).filter((v) => v >= METRIC_THRESHOLDS.green).length
    const phrase =
      onTarget === 3
        ? 'all three on target'
        : onTarget === 2
          ? 'two of three on target'
          : onTarget === 1
            ? 'one of three on target'
            : 'none on target yet'
    if (isCurrentWeek) return `So far: ${phrase}`
    const finished = onTarget === 0 ? 'none on target' : phrase
    return finished.charAt(0).toUpperCase() + finished.slice(1)
  })()

  const isRecentWeek = isCurrentWeek || weekStart === shiftDateString(getWeekStart(new Date()), -7)

  const weekChange = reviewData.previousWeekMinutes !== null
    ? Math.round(((reviewData.totalMinutes - reviewData.previousWeekMinutes) / reviewData.previousWeekMinutes) * 100)
    : null

  return (
    <div>
      {/* Week Navigation */}
      <div className="flex items-center justify-between rounded-xl bg-secondary p-3 mb-5">
        <button onClick={goToPreviousWeek} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-sm font-medium">
          {isCurrentWeek ? 'This week' : formatWeekRange(reviewData.weekStart, reviewData.weekEnd)}
        </p>
        <button onClick={goToNextWeek} disabled={isCurrentWeek}
          className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg disabled:opacity-30">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* The week on the app's one scale, averaged across its days */}
      <div className="mb-5">
        {ringValues ? (
          <MetricRingRow
            values={ringValues}
            size={76}
            srLabel="Average scores for this week"
            caption={weekLabel}
          />
        ) : null}
        {weekChange !== null && (
          <div className="flex items-center justify-center gap-1 mt-2 text-xs">
            {weekChange > 0 ? (
              <><TrendingUp className={`h-3.5 w-3.5 ${STATUS_CLASSES.green.icon}`} /><span className={STATUS_CLASSES.green.icon}>+{weekChange}%</span></>
            ) : weekChange < 0 ? (
              <><TrendingDown className={`h-3.5 w-3.5 ${STATUS_CLASSES.red.icon}`} /><span className={STATUS_CLASSES.red.icon}>{weekChange}%</span></>
            ) : (
              <><Minus className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Same</span></>
            )}
            <span className="text-muted-foreground">
              time logged vs {isCurrentWeek ? 'the same days last week' : 'last week'}
            </span>
          </div>
        )}
      </div>

      {/* Highlights */}
      {reviewData.highlights.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-5">
          {reviewData.highlights.map((h, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3">
              <Trophy className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium mt-1">{h.text}</p>
              {h.subtext && <p className="text-[11px] text-muted-foreground">{h.subtext}</p>}
            </div>
          ))}
        </div>
      )}

      {/* AI Coach Summary */}
      {reviewData.coachSummary && (
        <section className="mb-5">
          <div className="rounded-xl bg-gradient-to-br from-[#8A7CA8] to-[#8A7CA8] dark:from-[#8A7CA8]/30 dark:to-[#8A7CA8]/30 border border-[#8A7CA8]/50 dark:border-[#8A7CA8]/50 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-[#8A7CA8] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground leading-relaxed">{reviewData.coachSummary}</p>
            </div>
          </div>
          {/* The summary ends on a suggestion for the days ahead. This is the
              way to act on it: it used to be advice with nowhere to go. Only
              on a recent week — a suggestion from a month ago is history. */}
          {isRecentWeek && (
            <button
              onClick={() => router.push(`/calendar?date=${shiftDateString(getUserToday(), 1)}`)}
              className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm text-foreground transition-all duration-150 hover:border-foreground/25 active:scale-[0.99]"
            >
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              Plan tomorrow
            </button>
          )}
        </section>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Logged</p>
          <p className="text-lg font-bold">{formatMinutes(reviewData.totalMinutes)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Active Days</p>
          <p className="text-lg font-bold">{reviewData.activeDays}/{reviewData.evaluatedDays || 7}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Entries</p>
          <p className="text-lg font-bold">{reviewData.entryCount}</p>
        </div>
      </div>

      {/* Target Scorecards, Goal Progress, Category Breakdown — removed (old weekly targets, not meaningful) */}

      {/* Insights */}
      {reviewData.insights.length > 0 && (
        <section className="mb-5">
          <h2 className="font-semibold text-foreground text-sm mb-3">Insights</h2>
          <div className="space-y-2">
            {reviewData.insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-primary mt-0.5">•</span>
                <span>{insight}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Year in Pixels */}
      <button
        onClick={() => router.push('/pixels')}
        className="w-full rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors text-left"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7D9B8A]/10">
          <Grid3X3 className="h-5 w-5 text-[#7D9B8A]" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-foreground">Year in Pixels</p>
          <p className="text-sm text-muted-foreground">See your entire year at a glance</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  )
}
