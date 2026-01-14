'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Clock,
  Sparkles,
  BarChart3,
  Info,
  CheckCircle2,
  XCircle,
  Circle,
} from 'lucide-react'
import { TimeCategory, CATEGORY_LABELS } from '@/lib/types'

const MIN_ENTRIES_FOR_REVIEW = 7

interface IntentionProgress {
  intention: {
    id: string
    intention_type: string
    custom_text: string | null
    weekly_target_minutes: number | null
  }
  label: string
  currentMinutes: number
  targetMinutes: number | null
  percentage: number | null
  trend: 'up' | 'down' | 'same' | null
  previousMinutes: number | null
  isReductionGoal: boolean
  changeMinutes: number | null
  improvementPercentage: number | null
}

interface CategoryBreakdown {
  category: TimeCategory
  label: string
  minutes: number
  percentage: number
  entryCount: number
}

type DayRating = 'good' | 'neutral' | 'rough' | 'no_data'

interface IntentionDayScore {
  date: string
  day: string
  rating: DayRating
  intentionMinutes: number
  hadDistraction: boolean
}

interface IntentionScorecard {
  intentionId: string
  intentionLabel: string
  isReductionGoal: boolean
  days: IntentionDayScore[]
  goodDays: number
  roughDays: number
}

interface WeeklyReviewData {
  weekStart: string
  weekEnd: string
  totalMinutes: number
  entryCount: number
  previousWeekMinutes: number | null
  previousWeekEntryCount: number
  hasEnoughData: boolean
  hasPreviousWeekData: boolean
  intentionProgress: IntentionProgress[]
  intentionScorecards: IntentionScorecard[]
  categoryBreakdown: CategoryBreakdown[]
  bestDays: string[]
  bestHours: string[]
  insights: string[]
  coachSummary: string | null
}

const CATEGORY_COLORS: Record<TimeCategory, string> = {
  deep_work: 'bg-slate-500',
  meetings: 'bg-purple-400',
  admin: 'bg-gray-400',
  learning: 'bg-teal-500',
  exercise: 'bg-green-500',
  rest: 'bg-indigo-400',
  meals: 'bg-amber-500',
  self_care: 'bg-lime-500',
  relationships: 'bg-rose-400',
  distraction: 'bg-red-400',
  other: 'bg-zinc-400',
}

// Get Sunday (start) of a given week
function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sunday, 1 = Monday, etc.
  d.setDate(d.getDate() - day) // Go back to Sunday
  return d.toISOString().split('T')[0]
}

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart + 'T00:00:00')
  const end = new Date(weekEnd + 'T00:00:00')
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' })
  const startDay = start.getDate()
  const endDay = end.getDate()

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}`
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`
}

function formatHours(minutes: number): string {
  const hours = Math.round((minutes / 60) * 10) / 10
  return hours === 1 ? '1 hour' : `${hours} hours`
}

function formatHoursShort(minutes: number): string {
  const hours = Math.round((minutes / 60) * 10) / 10
  return `${hours}h`
}

function isCurrentWeek(weekStart: string): boolean {
  return weekStart === getWeekStart(new Date())
}

// Info tooltip helper
function InfoTooltip({ content }: { content: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="ml-1 inline-flex text-zinc-400 hover:text-zinc-300">
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[200px]">
        <p>{content}</p>
      </TooltipContent>
    </Tooltip>
  )
}

// Day rating icon
function DayRatingIcon({ rating }: { rating: DayRating }) {
  switch (rating) {
    case 'good':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />
    case 'neutral':
      return <Circle className="h-5 w-5 text-amber-400" />
    case 'rough':
      return <XCircle className="h-5 w-5 text-red-400" />
    default:
      return <Circle className="h-5 w-5 text-zinc-600" />
  }
}

export default function WeeklyReviewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()))
  const [reviewData, setReviewData] = useState<WeeklyReviewData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const fetchReview = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/weekly-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch review')
      }

      const data = await response.json()
      setReviewData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }, [weekStart])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchReview()
    }
  }, [status, fetchReview])

  const goToPreviousWeek = () => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() - 7)
    setWeekStart(d.toISOString().split('T')[0])
  }

  const goToNextWeek = () => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + 7)
    const newWeekStart = d.toISOString().split('T')[0]
    if (newWeekStart <= getWeekStart(new Date())) {
      setWeekStart(newWeekStart)
    }
  }

  const goToCurrentWeek = () => {
    setWeekStart(getWeekStart(new Date()))
  }

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

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 py-8">
          {/* Header */}
          <header className="mb-6">
            <button
              onClick={() => router.push('/')}
              className="mb-4 flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {session?.user?.preferredName ? `${session.user.preferredName}'s Week` : 'Your Week in Review'}
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Personal insights and progress
                </p>
              </div>
            </div>
          </header>

          {/* Week Navigation */}
          <div className="mb-6 flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
            <Button variant="ghost" size="icon" onClick={goToPreviousWeek}>
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <div className="text-center">
              <p className="font-semibold text-foreground">
                {reviewData ? formatWeekRange(reviewData.weekStart, reviewData.weekEnd) : '...'}
              </p>
              {!isCurrentWeek(weekStart) && (
                <button onClick={goToCurrentWeek} className="text-xs text-primary hover:underline">
                  Go to this week
                </button>
              )}
              {isCurrentWeek(weekStart) && <p className="text-xs text-zinc-500">This week</p>}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextWeek}
              disabled={isCurrentWeek(weekStart)}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-900/20">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <Button variant="outline" onClick={fetchReview} className="mt-4">
                Try again
              </Button>
            </div>
          ) : reviewData ? (
            <div className="space-y-6">
              {/* Minimum Data Check */}
              {!reviewData.hasEnoughData ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-900/20">
                  <div className="flex items-center gap-3 mb-4">
                    <Target className="h-6 w-6 text-amber-500" />
                    <h2 className="font-semibold text-foreground">Almost there!</h2>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                    Log at least {MIN_ENTRIES_FOR_REVIEW} activities to unlock your weekly review.
                  </p>
                  {/* Progress bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>{reviewData.entryCount} logged</span>
                      <span>{MIN_ENTRIES_FOR_REVIEW} needed</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all"
                        style={{
                          width: `${Math.min((reviewData.entryCount / MIN_ENTRIES_FOR_REVIEW) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <Button onClick={() => router.push('/')} className="w-full mt-4">
                    Start logging
                  </Button>
                </div>
              ) : (
                <>
                  {/* Total Time Summary */}
                  <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-zinc-500 flex items-center">
                          Total time logged
                          <InfoTooltip content="Sum of all confirmed time entries this week" />
                        </p>
                        <p className="text-3xl font-bold text-foreground">
                          {formatHours(reviewData.totalMinutes)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-zinc-500 flex items-center justify-end">
                          vs last week
                          {!reviewData.hasPreviousWeekData && (
                            <InfoTooltip content="Need 7+ entries from last week to compare" />
                          )}
                        </p>
                        {reviewData.hasPreviousWeekData && reviewData.previousWeekMinutes !== null ? (
                          <div className="flex items-center gap-1 justify-end">
                            {reviewData.totalMinutes > reviewData.previousWeekMinutes ? (
                              <>
                                <TrendingUp className="h-4 w-4 text-green-500" />
                                <span className="font-medium text-green-500">
                                  +{formatHoursShort(reviewData.totalMinutes - reviewData.previousWeekMinutes)}
                                </span>
                              </>
                            ) : reviewData.totalMinutes < reviewData.previousWeekMinutes ? (
                              <>
                                <TrendingDown className="h-4 w-4 text-amber-500" />
                                <span className="font-medium text-amber-500">
                                  -{formatHoursShort(reviewData.previousWeekMinutes - reviewData.totalMinutes)}
                                </span>
                              </>
                            ) : (
                              <>
                                <Minus className="h-4 w-4 text-zinc-400" />
                                <span className="font-medium text-zinc-400">Same</span>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-400">N/A</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Intention Progress */}
                  {reviewData.intentionProgress.length > 0 && (
                    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
                      <div className="mb-4 flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        <h2 className="font-semibold text-foreground">Intention Progress</h2>
                        <InfoTooltip content="Progress toward your weekly goals" />
                      </div>

                      <div className="space-y-5">
                        {reviewData.intentionProgress.map((ip) => (
                          <div key={ip.intention.id}>
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className="text-sm font-medium text-foreground">{ip.label}</span>
                              <div className="flex items-center gap-2 text-sm">
                                {ip.isReductionGoal ? (
                                  // Reduction goal display: show comparison
                                  <>
                                    <span className="text-zinc-500">
                                      {formatHoursShort(ip.currentMinutes)} this week
                                    </span>
                                    {ip.previousMinutes !== null && ip.changeMinutes !== null ? (
                                      ip.changeMinutes < 0 ? (
                                        <span className="flex items-center gap-1 text-green-500">
                                          <TrendingDown className="h-4 w-4" />
                                          {formatHoursShort(Math.abs(ip.changeMinutes))} less
                                        </span>
                                      ) : ip.changeMinutes > 0 ? (
                                        <span className="flex items-center gap-1 text-red-400">
                                          <TrendingUp className="h-4 w-4" />
                                          {formatHoursShort(ip.changeMinutes)} more
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-1 text-zinc-400">
                                          <Minus className="h-4 w-4" />
                                          Same
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-zinc-400 text-xs">(no previous data)</span>
                                    )}
                                  </>
                                ) : (
                                  // Growth goal display
                                  <>
                                    <span className="text-zinc-500">
                                      {formatHoursShort(ip.currentMinutes)}
                                      {ip.targetMinutes && (
                                        <span className="text-zinc-400">
                                          {' '}/ {formatHoursShort(ip.targetMinutes)}
                                        </span>
                                      )}
                                    </span>
                                    {ip.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                                    {ip.trend === 'down' && <TrendingDown className="h-4 w-4 text-amber-500" />}
                                    {ip.trend === 'same' && <Minus className="h-4 w-4 text-zinc-400" />}
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Progress bar */}
                            {!ip.isReductionGoal && ip.targetMinutes && (
                              <>
                                <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      ip.percentage !== null && ip.percentage >= 100
                                        ? 'bg-green-500'
                                        : ip.percentage !== null && ip.percentage >= 75
                                          ? 'bg-primary'
                                          : ip.percentage !== null && ip.percentage >= 50
                                            ? 'bg-amber-500'
                                            : 'bg-zinc-400'
                                    }`}
                                    style={{ width: `${Math.min(ip.percentage || 0, 100)}%` }}
                                  />
                                </div>
                                <p className="mt-1 text-xs text-zinc-500">
                                  {ip.percentage !== null && ip.percentage >= 100
                                    ? 'Target achieved!'
                                    : `${ip.percentage || 0}% of target`}
                                </p>
                              </>
                            )}

                            {/* Reduction goal: improvement bar */}
                            {ip.isReductionGoal && ip.previousMinutes !== null && ip.improvementPercentage !== null && (
                              <>
                                <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      ip.improvementPercentage > 0 ? 'bg-green-500' : 'bg-red-400'
                                    }`}
                                    style={{
                                      width: `${Math.min(Math.abs(ip.improvementPercentage), 100)}%`,
                                    }}
                                  />
                                </div>
                                <p className="mt-1 text-xs text-zinc-500">
                                  {ip.improvementPercentage > 0
                                    ? `${ip.improvementPercentage}% reduction from last week`
                                    : ip.improvementPercentage < 0
                                      ? `${Math.abs(ip.improvementPercentage)}% increase from last week`
                                      : 'Same as last week'}
                                </p>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Intention Scorecards */}
                  {reviewData.intentionScorecards.length > 0 && (
                    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
                      <div className="mb-4 flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        <h2 className="font-semibold text-foreground">Intention Scorecard</h2>
                        <InfoTooltip content="Daily progress toward each intention. Green = good day, Yellow = some progress, Red = rough day" />
                      </div>

                      <div className="space-y-4">
                        {reviewData.intentionScorecards.map((sc) => (
                          <div key={sc.intentionId}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-foreground">{sc.intentionLabel}</span>
                              <span className="text-xs text-zinc-500">
                                {sc.goodDays} good, {sc.roughDays} rough
                              </span>
                            </div>
                            <div className="flex justify-between gap-1">
                              {sc.days.map((day) => (
                                <Tooltip key={day.date}>
                                  <TooltipTrigger asChild>
                                    <div className="flex flex-col items-center flex-1">
                                      <DayRatingIcon rating={day.rating} />
                                      <span className="text-xs text-zinc-500 mt-1">{day.day}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      {sc.isReductionGoal
                                        ? day.hadDistraction
                                          ? `${formatHoursShort(day.intentionMinutes)} distraction`
                                          : 'No distraction'
                                        : day.intentionMinutes > 0
                                          ? `${formatHoursShort(day.intentionMinutes)} logged`
                                          : 'No activity logged'}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Category Breakdown */}
                  {reviewData.categoryBreakdown.length > 0 && (
                    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
                      <div className="mb-4 flex items-center gap-2">
                        <Clock className="h-5 w-5 text-primary" />
                        <h2 className="font-semibold text-foreground">Time by Category</h2>
                        <InfoTooltip content="Breakdown of time by activity type" />
                      </div>

                      {/* Horizontal stacked bar */}
                      <div className="mb-4 h-6 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700 flex">
                        {reviewData.categoryBreakdown.map((cat) => (
                          <Tooltip key={cat.category}>
                            <TooltipTrigger asChild>
                              <div
                                className={`h-full ${CATEGORY_COLORS[cat.category]} first:rounded-l-full last:rounded-r-full cursor-default`}
                                style={{ width: `${cat.percentage}%` }}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {cat.label}: {formatHoursShort(cat.minutes)} ({cat.percentage}%)
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>

                      {/* Category list */}
                      <div className="space-y-2">
                        {reviewData.categoryBreakdown.slice(0, 6).map((cat) => (
                          <div key={cat.category} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className={`h-3 w-3 rounded-full ${CATEGORY_COLORS[cat.category]}`} />
                              <span className="text-foreground">{cat.label}</span>
                            </div>
                            <span className="text-zinc-500">
                              {formatHoursShort(cat.minutes)} ({cat.percentage}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Coach Summary */}
                  {reviewData.coachSummary && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <h2 className="font-semibold text-foreground">Coach&apos;s Reflection</h2>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground/90">
                        {reviewData.coachSummary}
                      </p>
                    </div>
                  )}

                  {/* Quick Insights */}
                  {reviewData.insights.length > 0 && (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Quick insights
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {reviewData.insights.map((insight, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-white px-3 py-1 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                          >
                            {insight}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Empty state - no entries at all */}
              {reviewData.entryCount === 0 && (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-800/50">
                  <BarChart3 className="mx-auto mb-3 h-12 w-12 text-zinc-400" />
                  <h3 className="font-semibold text-zinc-700 dark:text-zinc-300">
                    No entries this week
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    Start logging your time to see your weekly review.
                  </p>
                  <Button onClick={() => router.push('/')} className="mt-4">
                    Go to today
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  )
}
