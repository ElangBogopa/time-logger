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
  // Research-based feedback
  feedbackMessage: string | null
  feedbackTone: 'success' | 'warning' | 'neutral' | 'danger' | null
  researchNote: string | null
  optimalRangeMin: number | null
  optimalRangeMax: number | null
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

interface WeekHighlight {
  type: 'streak' | 'improvement' | 'target_hit' | 'personal_best' | 'consistency'
  icon: string
  text: string
  subtext?: string
}

interface WeeklyReviewData {
  weekStart: string
  weekEnd: string
  // Hero metrics
  weekScore: number
  weekScoreLabel: string
  activeDays: number
  highlights: WeekHighlight[]
  // Existing
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
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const response = await fetch('/api/weekly-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, timezone }),
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
                  {/* Hero Week Score */}
                  <div className="rounded-xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-6 dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-800/50">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                          Week Score
                        </p>
                        <p className="text-5xl font-bold text-foreground mt-1">
                          {reviewData.weekScore}
                        </p>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                          {reviewData.weekScoreLabel}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                          <span className="font-medium text-foreground text-lg">{reviewData.activeDays}/7</span>
                          <span>days active</span>
                        </div>
                        {/* Mini progress ring */}
                        <div className="mt-2 flex justify-end">
                          <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                            <circle
                              cx="18"
                              cy="18"
                              r="14"
                              fill="none"
                              className="stroke-zinc-200 dark:stroke-zinc-700"
                              strokeWidth="3"
                            />
                            <circle
                              cx="18"
                              cy="18"
                              r="14"
                              fill="none"
                              className={`${
                                reviewData.weekScore >= 70 ? 'stroke-green-500' :
                                reviewData.weekScore >= 40 ? 'stroke-amber-500' : 'stroke-orange-500'
                              }`}
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeDasharray={`${(reviewData.weekScore / 100) * 88} 88`}
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

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

                  {/* Highlights */}
                  {reviewData.highlights.length > 0 && (
                    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-3">
                        Highlights
                      </h2>
                      <div className="grid grid-cols-2 gap-3">
                        {reviewData.highlights.map((highlight, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-700/50"
                          >
                            <span className="text-xl">{highlight.icon}</span>
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">
                                {highlight.text}
                              </p>
                              {highlight.subtext && (
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                  {highlight.subtext}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Intention Progress with Rings */}
                  {reviewData.intentionProgress.length > 0 && (
                    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
                      <div className="mb-4 flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        <h2 className="font-semibold text-foreground">Intentions</h2>
                      </div>

                      <div className="space-y-4">
                        {reviewData.intentionProgress.map((ip) => {
                          // Calculate progress percentage for the ring
                          const ringProgress = ip.isReductionGoal
                            ? ip.targetMinutes && ip.targetMinutes > 0
                              ? Math.max(0, Math.min(100, ((ip.targetMinutes - ip.currentMinutes) / ip.targetMinutes) * 100))
                              : 50
                            : ip.percentage || 0

                          // Determine ring color
                          const ringColor = ip.feedbackTone === 'success' ? 'stroke-green-500'
                            : ip.feedbackTone === 'warning' ? 'stroke-amber-500'
                            : ip.feedbackTone === 'danger' ? 'stroke-red-400'
                            : 'stroke-orange-500'

                          // Week-over-week change
                          const weekChange = ip.changeMinutes !== null && ip.previousMinutes !== null && ip.previousMinutes > 0
                            ? Math.round((ip.changeMinutes / ip.previousMinutes) * 100)
                            : null

                          return (
                            <div key={ip.intention.id} className="flex items-center gap-4">
                              {/* Progress Ring */}
                              <div className="relative flex-shrink-0">
                                <svg className="h-14 w-14 -rotate-90" viewBox="0 0 36 36">
                                  <circle
                                    cx="18" cy="18" r="14"
                                    fill="none"
                                    className="stroke-zinc-100 dark:stroke-zinc-700"
                                    strokeWidth="3"
                                  />
                                  <circle
                                    cx="18" cy="18" r="14"
                                    fill="none"
                                    className={ringColor}
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeDasharray={`${(Math.min(ringProgress, 100) / 100) * 88} 88`}
                                  />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-xs font-semibold text-foreground">
                                    {Math.round(ringProgress)}%
                                  </span>
                                </div>
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-foreground">{ip.label}</span>
                                  {weekChange !== null && (
                                    <span className={`flex items-center gap-1 text-xs font-medium ${
                                      ip.isReductionGoal
                                        ? weekChange < 0 ? 'text-green-500' : weekChange > 0 ? 'text-red-400' : 'text-zinc-400'
                                        : weekChange > 0 ? 'text-green-500' : weekChange < 0 ? 'text-amber-500' : 'text-zinc-400'
                                    }`}>
                                      {ip.isReductionGoal ? (
                                        weekChange < 0 ? <TrendingDown className="h-3 w-3" /> : weekChange > 0 ? <TrendingUp className="h-3 w-3" /> : <Minus className="h-3 w-3" />
                                      ) : (
                                        weekChange > 0 ? <TrendingUp className="h-3 w-3" /> : weekChange < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />
                                      )}
                                      {weekChange !== 0 ? `${Math.abs(weekChange)}%` : 'Same'}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
                                  <span>
                                    {formatHoursShort(ip.currentMinutes)}
                                    {ip.targetMinutes && !ip.isReductionGoal && (
                                      <span className="text-zinc-400"> / {formatHoursShort(ip.targetMinutes)}</span>
                                    )}
                                    {ip.targetMinutes && ip.isReductionGoal && (
                                      <span className="text-zinc-400"> of {formatHoursShort(ip.targetMinutes)} limit</span>
                                    )}
                                  </span>
                                  {ip.feedbackMessage && (
                                    <span className={`text-xs ${
                                      ip.feedbackTone === 'success' ? 'text-green-500' :
                                      ip.feedbackTone === 'danger' ? 'text-red-400' : ''
                                    }`}>
                                      {ip.feedbackMessage}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
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
