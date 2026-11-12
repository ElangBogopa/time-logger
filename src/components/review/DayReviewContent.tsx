'use client'

/**
 * The day review.
 *
 * This is the only implementation. It used to exist twice — here and as a
 * leaner copy behind /review?tab=day — which is how the same bug kept needing
 * two fixes, and how one copy ended up rendering Today's Wins as blank rows
 * while the other did not. /day-review is now a thin page around this
 * component, and the review tab renders the same thing.
 */

import { csrfFetch } from '@/lib/api'
import CommentaryThread from '@/components/CommentaryThread'
import { commentaryFingerprint, readCachedCommentary, writeCachedCommentary } from '@/lib/commentary-cache'
import { cacheGet, cacheSet, cacheDelete } from '@/lib/client-cache'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronRight,
  Circle,
  Trophy,
  TrendingUp,
  Clock,
  Sparkles,
  Target,
  Zap,
  Calendar,
  Lock,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatTimeDisplay, formatDuration } from '@/lib/time-utils'
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

// Wins Section
/**
 * The step after a review: plan the next day that can still be planned.
 * Reviewing today (after 9pm) that is tomorrow. Reviewing an earlier day it
 * is the rest of today, until the evening, when it becomes tomorrow too.
 */
function PlanNextCard({ reviewDate }: { reviewDate: string }) {
  const router = useRouter()
  const today = getUserToday()
  const planToday = reviewDate < today && getUserCurrentHour() < 18
  const target = planToday ? today : shiftDateString(today, 1)

  return (
    <section className="mt-6">
      <button
        onClick={() => router.push(planToday ? '/calendar' : `/calendar?date=${target}`)}
        className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-all duration-150 hover:border-foreground/25 active:scale-[0.99]"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
          <CalendarClock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {planToday ? 'Plan the rest of today' : 'Plan tomorrow'}
          </p>
          <p className="text-xs text-muted-foreground">
            Give what matters a time, around your calendar
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    </section>
  )
}

function WinsSection({ wins, isToday }: { wins: Win[]; isToday: boolean }) {
  if (wins.length === 0) return null

  const winIcons: Record<Win['type'], React.ReactNode> = {
    // Five hues, all from the palette: body, recovery, focus, faith,
    // connection. They were green-500 through pink-500, which made the wins
    // list the brightest thing in the review.
    goal_met: <Target className={`h-4 w-4 ${AGGREGATED_CLASSES.body.text}`} />,
    streak: <Zap className={`h-4 w-4 ${AGGREGATED_CLASSES.recovery.text}`} />,
    focus: <Clock className={`h-4 w-4 ${AGGREGATED_CLASSES.focus.text}`} />,
    improvement: <TrendingUp className={`h-4 w-4 ${AGGREGATED_CLASSES.faith.text}`} />,
    balance: <Sparkles className={`h-4 w-4 ${AGGREGATED_CLASSES.connection.text}`} />,
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className={`h-5 w-5 ${AGGREGATED_CLASSES.recovery.text}`} />
        <h2 className="font-semibold text-foreground">{isToday ? "Today's Wins" : 'Wins'}</h2>
      </div>
      <div className="space-y-2">
        {wins.map(win => (
          <div
            key={win.id}
            className={`flex items-center gap-3 rounded-lg ${STATUS_CLASSES.green.tint} border ${STATUS_CLASSES.green.border} px-3 py-2`}
          >
            {winIcons[win.type]}
            <span className="text-sm text-foreground">{win.text}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// Timeline Strip
function TimelineStrip({ timeline, startHour = 6, endHour = 23 }: { timeline: TimelineBlock[]; startHour?: number; endHour?: number }) {
  const visibleHours = timeline.slice(startHour, endHour + 1)

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-muted-foreground" />
        <h2 className="font-semibold text-foreground">Your Day</h2>
      </div>
      <div className="flex gap-0.5 h-12 rounded-lg overflow-hidden bg-secondary">
        {visibleHours.map(block => {
          const hasEntries = block.entries.length > 0
          const primaryCategory = block.entries[0]?.category

          return (
            <div
              key={block.hour}
              className={cn(
                'flex-1 relative group',
                hasEntries && primaryCategory
                  ? CATEGORY_COLORS[primaryCategory]
                  : 'bg-zinc-200 dark:bg-zinc-700'
              )}
              title={
                hasEntries
                  ? `${block.hour}:00 - ${block.entries.map(e => e.activity).join(', ')}`
                  : `${block.hour}:00 - No activity`
              }
            >
              {/* Hour label on hover */}
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                {block.hour}
              </div>
            </div>
          )
        })}
      </div>
      {/* Hour labels */}
      <div className="flex justify-between text-xs text-muted-foreground px-1">
        <span>{startHour}:00</span>
        <span>12:00</span>
        <span>{endHour}:00</span>
      </div>
    </section>
  )
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
  const { status } = useSession()
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
  const [commentary, setCommentary] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<Record<MetricKey, number> | null>(null)
  const [isLoadingCommentary, setIsLoadingCommentary] = useState(false)

  // Generate AI commentary from summary data (with cache)
  const generateCommentary = useCallback(async (summaryData: DaySummary): Promise<string | null> => {
    // Keyed on the day's data, not just the date, and held in localStorage —
    // so reopening the app reuses the line and logging something new earns a
    // fresh one. The in-memory cache this replaced died on every page load.
    const fingerprint = commentaryFingerprint({
      ...summaryData,
      mood: summaryData.todayMood?.mood ?? null,
    })
    const cached = readCachedCommentary(summaryData.date, fingerprint)
    if (cached) return cached

    try {
      const response = await csrfFetch('/api/day-commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: summaryData.metrics ?? null,
          plan: summaryData.planAdherence
            ? {
                kept: summaryData.planAdherence.kept,
                moved: summaryData.planAdherence.moved,
                missed: summaryData.planAdherence.missed,
              }
            : null,
          totalMinutesLogged: summaryData.totalMinutesLogged,
          wins: summaryData.wins,
          mood: summaryData.todayMood?.mood || null,
          longestFocusSession: summaryData.longestFocusSession,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        const text = data.commentary || null
        if (text) writeCachedCommentary(summaryData.date, fingerprint, text)
        return text
      }
    } catch (err) {
      console.error('Failed to fetch commentary:', err)
    }
    return null
  }, [])

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

  // Main fetch logic — checks persistence layer first (with cache)
  const fetchData = useCallback(async () => {
    const dateKey = dateParam || 'today'
    const reviewCacheKey = `day-review:${dateKey}`

    // Check if we have a fully cached review (summary + commentary)
    const cachedReview = cacheGet<{ summary: DaySummary; commentary: string | null }>(reviewCacheKey)
    if (cachedReview) {
      setSummary(cachedReview.summary)
      setCommentary(cachedReview.commentary)
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
        // Locked & finalized — use saved data directly
        const saved = reviewData.review
        setSummary(saved)
        setCommentary(saved.commentary || null)
        setIsLoading(false)
        // Cache finalized reviews permanently (they don't change)
        cacheSet(reviewCacheKey, { summary: saved, commentary: saved.commentary || null })
        return
      }

      // Either 'live' (editable) or 'needs_finalization' (locked but not saved yet)
      // In both cases, fetch fresh summary
      // The server cannot know the user's clock (it runs in UTC), so the
      // client says how far through the day it is. No `now` means a day
      // that is over, which includes "today" in the hours after midnight.
      const reviewDate = dateParam || getUserToday()
      const clock = new Date()
      const nowQuery =
        reviewDate === getLocalDateString() ? `&now=${clock.getHours() * 60 + clock.getMinutes()}` : ''
      const summaryUrl = `/api/day-summary?date=${reviewDate}${nowQuery}`
      const summaryRes = await fetch(summaryUrl)
      if (!summaryRes.ok) throw new Error('Failed to fetch summary')
      const summaryData: DaySummary = await summaryRes.json()
      setSummary(summaryData)
      setIsLoading(false)

      // A day with nothing logged has nothing to say anything about. Now
      // that the review can be paged day by day, every blank day passed
      // through would otherwise cost a model call for a paragraph of filler
      // and save it as that day's review.
      if (summaryData.totalMinutesLogged === 0) {
        setCommentary(null)
        cacheSet(reviewCacheKey, { summary: summaryData, commentary: null })
        return
      }

      // Fetch AI commentary
      setIsLoadingCommentary(true)
      const commentaryText = await generateCommentary(summaryData)
      setCommentary(commentaryText)
      setIsLoadingCommentary(false)

      // Cache the complete review
      cacheSet(reviewCacheKey, { summary: summaryData, commentary: commentaryText })

      // If needs finalization (locked date, first view), save to DB
      if (reviewData.source === 'needs_finalization') {
        await saveReview(summaryData, commentaryText)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setIsLoading(false)
    }
  }, [dateParam, generateCommentary, saveReview])

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

  // The day's Body / Mind / Heart, which is what the review leads with now.
  // The old hero was sessionsLogged ÷ sessionsPassed × 100 — a measure of
  // how diligently the day was logged, shown on the same dial as the three
  // real scores, and at 100 whenever all three sessions had anything in them.
  useEffect(() => {
    if (status !== 'authenticated') return
    let cancelled = false
    const date = dateParam || getUserToday()
    fetch(`/api/metrics/trend?period=7d&date=${date}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setMetrics({ body: data.body.current, focus: data.focus.current, social: data.social.current })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [status, dateParam])

  // Check if reviewing today or future — block access before 9pm
  // Computed eagerly to avoid extra render cycle
  const [currentHour, setCurrentHour] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    return getUserCurrentHour(new Date())
  })
  const [clientToday, setClientToday] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return getUserToday(new Date())
  })

  // Lock if: reviewing today (or no date) and before 9pm, OR reviewing a future date
  const isTodayReview = clientToday !== null && (!dateParam || dateParam === clientToday)
  const isFutureReview = clientToday !== null && dateParam !== null && dateParam > clientToday
  const isLocked = (isTodayReview && currentHour !== null && currentHour < 21) || isFutureReview

  useEffect(() => {
    if (status === 'authenticated' && !isLocked) {
      fetchData()
    } else if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, fetchData, router, isLocked])

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
          <PlanNextCard reviewDate={summary.date} />
        </div>
      </div>
    )
  }

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

        {/* How the day actually went, on the app's one scale */}
        <section className="py-6 mb-6">
          {metrics ? (
            <MetricRingRow
              values={metrics}
              size={84}
              srLabel="Scores for this day"
              caption={`${summary.sessionsLogged}/${summary.totalSessions} sessions · ${formatMinutes(summary.totalMinutesLogged)} tracked`}
            />
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              {summary.sessionsLogged}/{summary.totalSessions} sessions ·{' '}
              {formatMinutes(summary.totalMinutesLogged)} tracked
            </p>
          )}
        </section>

        {/* AI Commentary */}
        {(commentary || isLoadingCommentary) && (
          <section className="mb-6">
            {/* Was an indigo→purple gradient with an indigo-500 icon, which
                made the one piece of writing on the page shout. The muted
                violet is the same hue, from the palette. */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  {isLoadingCommentary ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-4 bg-secondary rounded w-full" />
                      <div className="h-4 bg-secondary rounded w-3/4" />
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-foreground leading-relaxed">{commentary}</p>
                      <CommentaryThread
                        subjectType="day"
                        subjectKey={summary.date}
                        commentary={commentary}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Wins */}
        {summary.wins.length > 0 && (
          <div className="mb-6">
            <WinsSection wins={summary.wins} isToday={isTodayReview} />
          </div>
        )}

        {/* Timeline */}
        <div className="mb-6">
          <TimelineStrip timeline={summary.timeline} />
        </div>

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

        {/* The day is reviewed; the next move is tomorrow. This is the
            moment the planner is for. */}
        {summary.date >= getUserToday() && (
          <button
            onClick={() => router.push(`/calendar?date=${shiftDateString(summary.date, 1)}`)}
            className="w-full flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 mb-6 text-left transition-all duration-150 hover:border-foreground/25 active:scale-[0.99]"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${AGGREGATED_CLASSES.focus.tint}`}>
              <CalendarClock className={`h-4 w-4 ${AGGREGATED_CLASSES.focus.text}`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Plan tomorrow</p>
              <p className="text-xs text-muted-foreground">Give tomorrow&apos;s tasks a time</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        )}

        {/* Longest Focus */}
        {summary.longestFocusSession && summary.longestFocusSession.minutes >= 30 && (
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${AGGREGATED_CLASSES.focus.tint}`}>
                <Clock className={`h-5 w-5 ${AGGREGATED_CLASSES.focus.text}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Longest focus session</p>
                <p className="font-medium text-foreground">
                  {formatDuration(summary.longestFocusSession.minutes)} on &quot;{summary.longestFocusSession.activity}&quot;
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Where a review leads. It used to simply end: the one moment you
            are looking at how a day went, and nothing pointed at the next
            one. */}
        <PlanNextCard reviewDate={summary.date} />
      </div>
    </div>
  )
}
