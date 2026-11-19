'use client'

/**
 * The day review.
 *
 * This is the only implementation. It used to exist twice — here and as a
 * leaner copy behind /review?tab=day — which is how the same bug kept needing
 * two fixes, and how one copy ended up rendering the wins block as blank rows
 * while the other did not. /day-review is now a thin page around this
 * component, and the review tab renders the same thing.
 */

import { csrfFetch } from '@/lib/api'
import CommentaryThread from '@/components/CommentaryThread'
import { readFingerprint, readCachedCommentary, writeCachedCommentary } from '@/lib/commentary-cache'
import { cacheGet, cacheSet, cacheDelete } from '@/lib/client-cache'
import { markFirstRun } from '@/lib/first-run'
import { useMyWindows } from '@/hooks/useMyWindows'
import WindowAlignmentCard from '@/components/WindowAlignmentCard'
import { useLogRange } from '@/hooks/useLogRange'
import { useReadAction } from '@/hooks/useReadAction'
import { calcBody, calcFocus, calcSocial } from '@/lib/metrics-calc'
import {
  alignmentOnDay,
  dayRead,
  plainReadText,
  ringComparisons,
  ringNotes,
  type ReviewRead,
} from '@/lib/review-read'
import { Button } from '@/components/ui/button'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAccount } from '@/hooks/useAccount'
import { ArrowLeft, Check, Circle, Sparkles, Lock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatTimeDisplay } from '@/lib/time-utils'
import {
  TimeCategory,
  CATEGORY_LABELS,
  MoodCheckin,
  MOOD_EMOJIS,
  SESSION_MOOD_CONFIG,
  TimeEntry,
  AggregatedCategory,
  getAggregatedCategory,
  getUserToday,
  getLocalDateString,
  isTaskCompletable,
  shiftDateString,
  getUserCurrentHour,
} from '@/lib/types'
import { AGGREGATED_CLASSES, STATUS_CLASSES } from '@/lib/palette'
import { MetricRingRow } from '@/components/MetricRings'
import type { PlanAdherence } from '@/lib/plan-adherence'
import type { MetricKey } from '@/lib/chart-colors'

/**
 * Colours come from the one palette, and the category → bucket mapping from
 * types.ts. Both were declared again here, and this copy put `other` in
 * escape where ENERGY_VIEW puts it in ops — so an uncategorised hour was
 * painted as leisure on the timeline strip and scored as work everywhere
 * else.
 */
const byBucket = (key: 'bg' | 'text') =>
  Object.fromEntries(
    Object.entries(AGGREGATED_CLASSES).map(([bucket, classes]) => [bucket, classes[key]])
  ) as Record<AggregatedCategory, string>

const CATEGORY_COLORS = Object.fromEntries(
  (Object.keys(CATEGORY_LABELS) as TimeCategory[]).map((cat) => [
    cat,
    AGGREGATED_CLASSES[getAggregatedCategory(cat)].bg,
  ])
) as Record<TimeCategory, string>

const AGGREGATED_COLORS = byBucket('bg')
const AGGREGATED_TEXT_COLORS = byBucket('text')

interface Win {
  id: string
  text: string
  type: 'goal_met' | 'streak' | 'focus' | 'improvement' | 'balance'
  value?: number
}

interface TimelineBlock {
  hour: number
  entries: {
    id: string
    activity: string
    category: TimeCategory | null
    startTime: string
    endTime: string
    durationMinutes: number
  }[]
  totalMinutes: number
}

interface CategoryBreakdown {
  category: TimeCategory
  label: string
  minutes: number
  percentage: number
}

interface AggregatedBreakdown {
  category: AggregatedCategory
  label: string
  minutes: number
  percentage: number
}

interface ProductivityTaskInfo {
  id: string
  title: string
  completed: boolean
  weight: number
  slot: number
}

interface ProductivityScore {
  date: string
  score: number
  maxPossible: number
  earnedPoints: number
  totalTasks: number
  completedTasks: number
  priorityCompleted: boolean
  tasks: ProductivityTaskInfo[]
  label: string
  hasPlans: boolean
}

interface DaySummary {
  planAdherence?: PlanAdherence | null
  /** Absent on reviews saved before the summary carried the three scores. */
  metrics?: { body: number; focus: number; social: number } | null
  score: number
  scoreColor: 'green' | 'orange' | 'red'
  sessionsLogged: number
  totalSessions: number
  totalMinutesLogged: number
  hasEveningPassed: boolean
  date: string
  wins: Win[]
  timeline: TimelineBlock[]
  longestFocusSession: { activity: string; minutes: number } | null
  categoryBreakdown: CategoryBreakdown[]
  aggregatedBreakdown: AggregatedBreakdown[]
  todayMood: MoodCheckin | null
  productivityScore: ProductivityScore | null
  entries: TimeEntry[]
}

function formatMinutes(minutes: number): string {
  if (minutes === 0) return '0m'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

// Productivity Plan Card — shows plan completion in Goal Progress
/**
 * What you set out to do, and what became of it.
 *
 * This was a "Productivity 67%" headline with a progress bar and a points
 * value per task, sitting directly under Body / Mind / Heart — a completion
 * rate drawn to look like a fifth metric on the same dial. It is a set of
 * facts instead: how many plans you kept, which ones moved, and what took
 * the hour when one did not happen. The weights still decide nothing here;
 * they belong to the scoring in productivity-score.ts.
 */
function PlanVsActualCard({
  score,
  adherence,
  onConfirm,
  confirmingId = null,
}: {
  score: ProductivityScore
  adherence: PlanAdherence | null
  /** Say that what was logged in a plan's hour was the plan. Absent once the day is locked. */
  onConfirm?: (taskId: string, committedStart: string) => void
  confirmingId?: string | null
}) {
  const byId = new Map((adherence?.comparisons ?? []).map((c) => [c.id, c]))

  const headline = (() => {
    if (adherence && adherence.settled > 0) {
      const parts = [`${adherence.kept} of ${adherence.settled} kept`]
      if (adherence.moved > 0) parts.push(`${adherence.moved} moved`)
      return parts.join(' · ')
    }
    return `${score.completedTasks} of ${score.totalTasks} done`
  })()

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="eyebrow">Your plan</h3>
        <p className="text-sm text-muted-foreground">{headline}</p>
      </div>

      <div className="space-y-2">
        {score.tasks.map((task) => {
          const comparison = byId.get(task.id)
          const outcome = comparison?.outcome
          const tone =
            outcome === 'kept'
              ? STATUS_CLASSES.green.icon
              : outcome === 'moved'
                ? STATUS_CLASSES.yellow.icon
                : 'text-muted-foreground'

          return (
            <div key={task.id} className="flex items-start gap-2 text-sm">
              <span className={`mt-0.5 ${tone}`}>
                {task.completed || comparison?.inferred ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={task.completed ? 'text-muted-foreground' : 'text-foreground'}>
                  {task.title}
                </p>
                {comparison && (
                  <p className="text-xs text-muted-foreground">
                    {comparison.outcome === 'kept' &&
                      (comparison.inferred && comparison.matchedActivity
                        ? `Planned ${formatTimeDisplay(comparison.committedStart)} — you logged ${comparison.matchedActivity} then`
                        : `Planned ${formatTimeDisplay(comparison.committedStart)} — and that is when it happened`)}
                    {comparison.outcome === 'moved' &&
                      (comparison.matchedActivity && comparison.matchedStart
                        ? `Planned ${formatTimeDisplay(comparison.committedStart)} — you logged ${comparison.matchedActivity} at ${formatTimeDisplay(comparison.matchedStart)}`
                        : `Planned ${formatTimeDisplay(comparison.committedStart)}, done at another time`)}
                    {comparison.outcome === 'missed' &&
                      (comparison.loggedActivity
                        ? `Planned ${formatTimeDisplay(comparison.committedStart)} — you logged ${comparison.loggedActivity}`
                        : `Planned ${formatTimeDisplay(comparison.committedStart)}, nothing logged then`)}
                    {comparison.outcome === 'upcoming' &&
                      `Coming up at ${formatTimeDisplay(comparison.committedStart)}`}
                  </p>
                )}
              </div>
              {/* The matcher reads words, and words differ: when something was
                  logged in the plan's hour and it did not recognise it, one
                  tap says it was the plan. */}
              {onConfirm && comparison?.outcome === 'missed' && comparison.loggedActivity && (
                <button
                  onClick={() => onConfirm(task.id, comparison.committedStart)}
                  disabled={confirmingId !== null}
                  className="shrink-0 min-h-9 rounded-lg border border-border px-2.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/25 transition-colors disabled:opacity-50"
                >
                  {confirmingId === task.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'That was it'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Aggregated Category Breakdown (6 energy categories)
function AggregatedBreakdownSection({ breakdown }: { breakdown: AggregatedBreakdown[] }) {
  // Filter to only show categories with time
  const visibleCategories = breakdown.filter(cat => cat.minutes > 0)

  if (visibleCategories.length === 0) return null

  const maxMinutes = Math.max(...breakdown.map(b => b.minutes), 1)

  return (
    <section className="space-y-4">
      <h2 className="font-semibold text-foreground">Energy Breakdown</h2>
      <div className="space-y-3">
        {visibleCategories.map(cat => (
          <div key={cat.category} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn('w-3 h-3 rounded-full', AGGREGATED_COLORS[cat.category])} />
                <span className="text-sm font-medium text-muted-foreground">
                  {cat.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {formatMinutes(cat.minutes)}
                </span>
                {cat.minutes > 0 && (
                  <span className="text-xs text-muted-foreground w-10 text-right">{cat.percentage}%</span>
                )}
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', AGGREGATED_COLORS[cat.category])}
                style={{ width: `${(cat.minutes / maxMinutes) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// Granular Category Breakdown (detailed view)
function CategoryBreakdownSection({ breakdown }: { breakdown: CategoryBreakdown[] }) {
  if (breakdown.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-foreground">Detailed Breakdown</h2>
      <div className="space-y-2">
        {breakdown.slice(0, 8).map(cat => (
          <div key={cat.category} className="flex items-center gap-3">
            <div className={cn('w-3 h-3 rounded-full', CATEGORY_COLORS[cat.category])} />
            <span className="flex-1 text-sm text-foreground">{cat.label}</span>
            <span className="text-sm font-medium text-foreground">{formatMinutes(cat.minutes)}</span>
            <span className="text-xs text-muted-foreground w-10 text-right">{cat.percentage}%</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// Mood Section
function MoodSection({ mood }: { mood: MoodCheckin | null }) {
  if (!mood) return null

  const config = SESSION_MOOD_CONFIG[mood.period]
  const label = config.labels[mood.mood]

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{MOOD_EMOJIS[mood.mood]}</span>
        <div>
          <p className="text-sm text-muted-foreground">Evening mood</p>
          <p className="font-medium text-foreground">{label}</p>
        </div>
      </div>
    </section>
  )
}

interface DayReviewContentProps {
  /**
   * Rendered inside the review page's Today tab, which already provides the
   * page heading, the padding and the navigation. The standalone /day-review
   * route provides none of those, so this component owns them — and drops
   * them when embedded, or the tab shows two headings, double padding and a
   * Back button that leaves the tab altogether.
   */
  embedded?: boolean
  /**
   * The day to review, chosen by the review tab's own navigator. Without
   * it the day comes from `?date=` in the URL, as /day-review supplies.
   */
  date?: string
}

export default function DayReviewContent({ embedded = false, date: dateProp }: DayReviewContentProps) {
  const { status } = useAccount()
  const router = useRouter()
  const searchParams = useSearchParams()
  const dateParam = dateProp ?? searchParams.get('date')
  const shellClass = embedded ? '' : 'min-h-screen bg-background pb-20'
  const innerClass = embedded ? '' : 'mx-auto max-w-2xl px-4 py-6'
  const spinnerClass = embedded
    ? 'flex items-center justify-center py-20'
    : 'min-h-screen bg-background flex items-center justify-center'
  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // A locked day seen for the first time is saved once its read has words.
  const [needsFinalization, setNeedsFinalization] = useState(false)

  // Check if reviewing today or future — block access before 9pm
  // Computed eagerly to avoid extra render cycle
  const [currentHour] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    return getUserCurrentHour(new Date())
  })
  const [clientToday] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return getUserToday(new Date())
  })

  // Lock if: reviewing today (or no date) and before 9pm, OR reviewing a future date
  const isTodayReview = clientToday !== null && (!dateParam || dateParam === clientToday)
  const isFutureReview = clientToday !== null && dateParam !== null && dateParam > clientToday
  const isLocked = (isTodayReview && currentHour !== null && currentHour < 21) || isFutureReview

  // The day and the four weeks before it, from one range of the log: a saved
  // review carries no entries, and the read is worked out from the log the
  // same way for a saved day and a live one.
  const reviewDate = dateParam || clientToday || getUserToday()
  const range = useLogRange(shiftDateString(reviewDate, -28), reviewDate, status === 'authenticated' && !isLocked)
  const { windows } = useMyWindows(status === 'authenticated')
  const dayRows = useMemo(() => range.rows.filter((row) => row.date === reviewDate), [range.rows, reviewDate])
  const history = useMemo(() => range.rows.filter((row) => row.date < reviewDate), [range.rows, reviewDate])

  // The day's Body / Mind / Heart, each against this person's last four weeks.
  const scores = useMemo<Record<MetricKey, number>>(
    () => ({ body: calcBody(dayRows), focus: calcFocus(dayRows), social: calcSocial(dayRows) }),
    [dayRows]
  )
  const ringLines = useMemo(() => ringNotes(ringComparisons(scores, history)), [scores, history])

  // The one read, chosen by fixed rules; the model only words it.
  const read = useMemo(
    () => (range.loaded ? dayRead({ date: reviewDate, rows: dayRows, history, windows }) : null),
    [range.loaded, reviewDate, dayRows, history, windows]
  )
  const alignment = useMemo(() => alignmentOnDay(dayRows, windows), [dayRows, windows])
  const fingerprint = read ? readFingerprint(read) : null

  // Words for the read: the stored line for these facts, else one model
  // call, else the facts themselves. A day with nothing logged is never
  // sent to the model.
  const [words, setWords] = useState<{ fingerprint: string; text: string } | null>(null)
  const latestFingerprint = useRef<string | null>(null)
  const askedFor = useRef<string | null>(null)
  useEffect(() => {
    latestFingerprint.current = fingerprint
    if (!read || !fingerprint) return
    const settle = (text: string) => {
      if (latestFingerprint.current !== fingerprint) return
      setWords((prev) => (prev && prev.fingerprint === fingerprint && prev.text === text ? prev : { fingerprint, text }))
    }
    if (dayRows.length === 0) {
      settle(plainReadText(read))
      return
    }
    const cached = readCachedCommentary(reviewDate, fingerprint)
    if (cached) {
      settle(cached)
      return
    }
    if (askedFor.current === fingerprint) return
    askedFor.current = fingerprint
    csrfFetch('/api/day-commentary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: { kind: read.kind, facts: read.facts } }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const text = typeof data?.commentary === 'string' ? data.commentary.trim() : ''
        if (text) writeCachedCommentary(reviewDate, fingerprint, text)
        settle(text || plainReadText(read))
      })
      .catch((err) => {
        console.error('Failed to fetch commentary:', err)
        settle(plainReadText(read))
      })
  }, [read, fingerprint, dayRows.length, reviewDate])
  const shownWords = words && words.fingerprint === fingerprint ? words.text : null

  const fallbackRead = useMemo<ReviewRead>(
    () => ({ scope: 'day', kind: 'nothing', rule: 'nothing-ordinary', facts: [], evidence: [], slot: null, timing: false }),
    []
  )
  const { action, run, isSaving } = useReadAction(read ?? fallbackRead, { reviewDate }, status === 'authenticated')

  // Save a finalized review to the database
  const saveReview = useCallback(async (summaryData: DaySummary, commentaryText: string | null) => {
    try {
      await fetch('/api/day-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: summaryData.date,
          score: summaryData.score,
          scoreColor: summaryData.scoreColor,
          sessionsLogged: summaryData.sessionsLogged,
          totalSessions: summaryData.totalSessions,
          totalMinutesLogged: summaryData.totalMinutesLogged,
          commentary: commentaryText,
          wins: summaryData.wins,
          categoryBreakdown: summaryData.categoryBreakdown,
          aggregatedBreakdown: summaryData.aggregatedBreakdown,
          timeline: summaryData.timeline,
          longestFocusSession: summaryData.longestFocusSession,
          mood: summaryData.todayMood,
        }),
      })
    } catch (err) {
      console.error('Failed to save day review:', err)
    }
  }, [])

  useEffect(() => {
    if (!needsFinalization || !summary || shownWords === null) return
    setNeedsFinalization(false)
    saveReview(summary, shownWords)
  }, [needsFinalization, summary, shownWords, saveReview])

  // Main fetch logic — checks persistence layer first (with cache)
  const fetchData = useCallback(async () => {
    const dateKey = dateParam || 'today'
    const reviewCacheKey = `day-review:${dateKey}`

    const cachedReview = cacheGet<{ summary: DaySummary }>(reviewCacheKey)
    if (cachedReview) {
      setSummary(cachedReview.summary)
      setIsLoading(false)
      return
    }

    try {
      // Step 1: Check persistence status
      const reviewUrl = `/api/day-review?date=${dateParam || getUserToday()}`
      const reviewRes = await fetch(reviewUrl)
      if (!reviewRes.ok) throw new Error('Failed to fetch review status')
      const reviewData = await reviewRes.json()

      if (reviewData.source === 'saved') {
        // Locked & finalized — its saved numbers stand; the read comes from the log.
        const saved = reviewData.review
        setSummary(saved)
        setIsLoading(false)
        cacheSet(reviewCacheKey, { summary: saved })
        return
      }

      // Either 'live' (editable) or 'needs_finalization' (locked but not saved yet)
      // In both cases, fetch fresh summary
      // The server cannot know the user's clock (it runs in UTC), so the
      // client says how far through the day it is. No `now` means a day
      // that is over, which includes "today" in the hours after midnight.
      const summaryDate = dateParam || getUserToday()
      const clock = new Date()
      const nowQuery =
        summaryDate === getLocalDateString() ? `&now=${clock.getHours() * 60 + clock.getMinutes()}` : ''
      const summaryRes = await fetch(`/api/day-summary?date=${summaryDate}${nowQuery}`)
      if (!summaryRes.ok) throw new Error('Failed to fetch summary')
      const summaryData: DaySummary = await summaryRes.json()
      setSummary(summaryData)
      setIsLoading(false)
      cacheSet(reviewCacheKey, { summary: summaryData })

      // A locked day seen for the first time is saved, with the read's words.
      if (reviewData.source === 'needs_finalization' && summaryData.totalMinutesLogged > 0) {
        setNeedsFinalization(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setIsLoading(false)
    }
  }, [dateParam])

  /** "That was it": what was logged in a plan's hour was the plan. */
  const [confirmingPlanId, setConfirmingPlanId] = useState<string | null>(null)
  const handleConfirmPlan = useCallback(
    async (taskId: string, committedStart: string) => {
      setConfirmingPlanId(taskId)
      try {
        const hour = parseInt(committedStart.split(':')[0], 10)
        const res = await csrfFetch('/api/plans', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: taskId,
            completed: true,
            completed_session: hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening',
          }),
        })
        if (!res.ok) throw new Error('Failed to confirm plan')
        cacheDelete(`day-review:${dateParam || 'today'}`)
        await fetchData()
      } catch (err) {
        console.error('Failed to confirm plan:', err)
      } finally {
        setConfirmingPlanId(null)
      }
    },
    [dateParam, fetchData]
  )

  // A review with something in it, on screen: the last step of a first run.
  const hasReviewOnScreen = !isLocked && !isLoading && (summary?.totalMinutesLogged ?? 0) > 0
  useEffect(() => {
    if (hasReviewOnScreen) markFirstRun('reviewed')
  }, [hasReviewOnScreen])

  useEffect(() => {
    if (status === 'authenticated' && !isLocked) {
      fetchData()
    } else if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, fetchData, router, isLocked])

  const planButton = action && (
    <Button
      className="mt-6 h-auto min-h-11 w-full whitespace-normal py-2.5"
      onClick={run}
      disabled={isSaving}
    >
      {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
      {action.label}
    </Button>
  )

  if (status === 'loading') {
    return (
      <div className={spinnerClass}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // Locked state — today before 9pm
  if (isLocked) {
    return (
      <div className={shellClass}>
        <div className={innerClass}>
          <header className="mb-6">
            {!embedded && (
              <>
                <button
                  onClick={() => router.back()}
                  className="flex items-center gap-2 text-muted-foreground mb-4 hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-5 w-5" />
                  Back
                </button>
                <h1 className="page-title text-foreground">Day in Review</h1>
              </>
            )}
          </header>

          <div className="flex flex-col items-center justify-center py-20">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary mb-6">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Not available yet</h2>
            <p className="text-sm text-muted-foreground text-center max-w-xs mb-1">
              Your daily review unlocks at 9:00 PM once your day is wrapping up.
            </p>
            <p className="text-xs text-muted-foreground">
              {currentHour !== null && currentHour < 21 && `${21 - currentHour} hour${21 - currentHour !== 1 ? 's' : ''} to go`}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={spinnerClass}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !summary) {
    return (
      <div className={embedded ? 'py-10' : 'min-h-screen bg-background p-4'}>
        {!embedded && (
          <button onClick={() => router.back()} className="flex items-center gap-2 text-muted-foreground mb-6">
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>
        )}
        <p className="text-center text-muted-foreground">Unable to load day review</p>
      </div>
    )
  }

  if (summary.totalMinutesLogged === 0) {
    return (
      <div className={shellClass}>
        <div className={innerClass}>
          {!embedded && (
            <header className="mb-6">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-muted-foreground mb-4 hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                Back
              </button>
              <h1 className="page-title text-foreground">Day in Review</h1>
              <p className="text-muted-foreground">{formatDate(summary.date)}</p>
            </header>
          )}
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
            <p className="text-sm text-foreground">Nothing was logged on this day</p>
            <p className="mt-1 text-xs text-muted-foreground">There is nothing to review until something is.</p>
          </div>
          {planButton}
        </div>
      </div>
    )
  }

  const showEvidence = !!read && (read.evidence.length > 0 || (read.timing && alignment.length > 0))

  return (
    <div className={shellClass}>
      <div className={innerClass}>
        {/* Header */}
        <header className="mb-6">
          {!embedded && (
            <>
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-muted-foreground mb-4 hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                Back
              </button>
              <h1 className="page-title text-foreground">Day in Review</h1>
            </>
          )}
          {/* The review tab's own navigator names the day; saying it again
              directly underneath was the same date twice. */}
          {!dateProp && <p className="text-muted-foreground">{formatDate(summary.date)}</p>}
        </header>

        {/* How the day went on the app's one scale, against this person's own usual */}
        <section className="py-6 mb-6">
          {range.loaded ? (
            <MetricRingRow
              values={scores}
              size={84}
              srLabel="Scores for this day"
              notes={ringLines.notes}
              caption={ringLines.caption}
            />
          ) : range.failed ? null : (
            <div className="mx-auto h-28 w-64 animate-pulse rounded-xl bg-secondary" />
          )}
        </section>

        {/* The read: one decision, worded from its facts */}
        <section className="mb-6">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                {range.failed ? (
                  <p className="text-sm text-foreground leading-relaxed">
                    Your log did not load, so there is nothing to read yet. Try again in a moment.
                  </p>
                ) : shownWords === null ? (
                  <div className="space-y-2 animate-pulse" aria-label="Loading the review">
                    <div className="h-4 bg-secondary rounded w-full" />
                    <div className="h-4 bg-secondary rounded w-3/4" />
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-foreground leading-relaxed">{shownWords}</p>
                    <CommentaryThread subjectType="day" subjectKey={summary.date} commentary={shownWords} />
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* What the read rests on */}
        {showEvidence && read && (
          <section className="mb-6">
            <h2 className="eyebrow mb-3">Behind this</h2>
            {read.evidence.length > 0 && (
              <div className="divide-y divide-border rounded-xl border border-border bg-card">
                {read.evidence.map((item) => (
                  <div key={`${item.label}-${item.value}`} className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="text-right text-foreground tabular-nums">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
            {read.timing && alignment.length > 0 && (
              <div className={read.evidence.length > 0 ? 'mt-3' : ''}>
                <WindowAlignmentCard facts={alignment} />
              </div>
            )}
          </section>
        )}

        {/* What you planned, against what happened */}
        {summary.productivityScore?.hasPlans && (
          <section className="mb-6">
            <PlanVsActualCard
              score={summary.productivityScore}
              adherence={summary.planAdherence ?? null}
              onConfirm={isTaskCompletable(summary.date) ? handleConfirmPlan : undefined}
              confirmingId={confirmingPlanId}
            />
          </section>
        )}

        {/* Energy Breakdown, Category Breakdown, and Mood — commented out until science-based measurement is ready
        {summary.aggregatedBreakdown && summary.aggregatedBreakdown.length > 0 && (
          <div className="mb-6">
            <AggregatedBreakdownSection breakdown={summary.aggregatedBreakdown} />
          </div>
        )}
        {summary.categoryBreakdown && summary.categoryBreakdown.length > 5 && (
          <div className="mb-6">
            <CategoryBreakdownSection breakdown={summary.categoryBreakdown} />
          </div>
        )}
        {summary.todayMood && (
          <div className="mb-6">
            <MoodSection mood={summary.todayMood} />
          </div>
        )}
        */}

        {/* Where a review leads: one button into the planner. */}
        {planButton}
      </div>
    </div>
  )
}
