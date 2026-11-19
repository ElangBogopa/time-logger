'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAccount } from '@/hooks/useAccount'
import { csrfFetch } from '@/lib/api'
import { ChevronLeft, ChevronRight, Loader2, Sparkles, BarChart3, Grid3X3, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getLocalDateString, getWeekStartForDate, shiftDateString } from '@/lib/types'
import { MetricRingRow } from '@/components/MetricRings'
import { cacheGet, cacheSet } from '@/lib/client-cache'
import { readCachedText, writeCachedText, storedFingerprint } from '@/lib/ai-text-cache'
import { useMyWindows } from '@/hooks/useMyWindows'
import { useWeekEntries } from '@/hooks/useWeekEntries'
import { useReadAction } from '@/hooks/useReadAction'
import WindowAlignmentCard from '@/components/WindowAlignmentCard'
import CommentaryThread from '@/components/CommentaryThread'
import { Button } from '@/components/ui/button'
import {
  alignmentOnDay,
  plainReadText,
  ringNotes,
  type ReviewRead,
  type RingComparisons,
  type Row,
} from '@/lib/review-read'
import type { LogFinding } from '@/lib/log-findings'

// ─── Types matching API route response ────────────────

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
  averages: { body: number; focus: number; social: number } | null
  activeDays: number
  evaluatedDays?: number
  totalMinutes: number
  entryCount: number
  previousWeekMinutes: number | null
  previousWeekEntryCount: number
  hasEnoughData: boolean
  hasPreviousWeekData: boolean
  categoryBreakdown: CategoryBreakdownItem[]
  read: ReviewRead
  comparisons: RingComparisons
  finding: LogFinding | null
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

// ─── Component ────────────────

export default function WeeklyReviewContent() {
  const { status } = useAccount()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()))

  // The week against the person's own windows. The week's entries are asked
  // for by themselves: the habit history stops at yesterday and at four
  // weeks back, and a week is neither.
  const { windows: myWindows, wakeMinutes } = useMyWindows(status === 'authenticated')
  const weekEntries = useWeekEntries(weekStart, status === 'authenticated')
  const alignment = useMemo(
    () => alignmentOnDay(weekEntries.filter((e) => e.category) as unknown as Row[], myWindows),
    [weekEntries, myWindows]
  )
  const [reviewData, setReviewData] = useState<WeeklyReviewData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchReview = useCallback(async () => {
    setError(null)
    // The read is worked out against the person's windows, so a new wake
    // time is a different review.
    const cacheKey = `weekly-review:${weekStart}:${wakeMinutes ?? 'ref'}`
    const cached = cacheGet<WeeklyReviewData>(cacheKey)
    if (cached) {
      setReviewData(cached)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      // Tell the server which summary we already hold. If the week's read
      // still hashes to the same thing it skips the model entirely.
      const knownCoachFingerprint = storedFingerprint(CACHE_NAMESPACE, weekStart) ?? undefined
      const response = await csrfFetch('/api/weekly-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, timezone, knownCoachFingerprint, wakeMinutes }),
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
  }, [weekStart, wakeMinutes])

  useEffect(() => {
    if (status === 'authenticated') fetchReview()
  }, [status, fetchReview])

  const fallbackRead = useMemo<ReviewRead>(
    () => ({ scope: 'week', kind: 'nothing', rule: 'week-nothing-ordinary', facts: [], evidence: [], slot: null, timing: false }),
    []
  )
  const { action, run, isSaving } = useReadAction(
    reviewData?.read ?? fallbackRead,
    { weekStart },
    status === 'authenticated'
  )

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

  const read = reviewData.read
  const ringLines = reviewData.comparisons ? ringNotes(reviewData.comparisons) : { notes: {} }
  const words = reviewData.coachSummary ?? (read ? plainReadText(read) : null)
  const showEvidence = !!read && (read.evidence.length > 0 || (read.timing && alignment.length > 0))

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

      {/* The week on the app's one scale, averaged across its days, against the person's usual */}
      {reviewData.averages && (
        <div className="mb-5">
          <MetricRingRow
            values={reviewData.averages}
            size={76}
            srLabel="Average scores for this week"
            notes={ringLines.notes}
            caption={ringLines.caption}
          />
        </div>
      )}

      {/* The read: one decision, worded from its facts */}
      {words && (
        <section className="mb-5">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-foreground leading-relaxed">{words}</p>
                <CommentaryThread subjectType="week" subjectKey={weekStart} commentary={words} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* What the read rests on */}
      {showEvidence && (
        <section className="mb-5">
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
              <WindowAlignmentCard facts={alignment} heading="In your windows this week" />
            </div>
          )}
        </section>
      )}

      {/* One pattern from the person's own log, never worded as a cause */}
      {reviewData.finding && (
        <section className="mb-5">
          <h2 className="eyebrow mb-3">What your log shows</h2>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-foreground leading-relaxed">{reviewData.finding.sentence}</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            From your last three months. A pattern in the log, not a cause.
          </p>
        </section>
      )}

      {/* Where a review leads: one button into the planner. */}
      {action && (
        <Button className="mb-5 h-auto min-h-11 w-full whitespace-normal py-2.5" onClick={run} disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          {action.label}
        </Button>
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
