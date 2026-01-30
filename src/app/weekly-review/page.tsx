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
  Share2,
  Grid3X3,
} from 'lucide-react'
import { TimeCategory, CATEGORY_LABELS, ENERGY_VIEW, AggregatedCategory, AGGREGATED_CATEGORY_LABELS } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import ShareableStatsCard, { type ShareableStatsCardProps } from '@/components/ShareableStatsCard'
import { csrfFetch } from '@/lib/api'
import { cacheGet, cacheSet } from '@/lib/client-cache'
import { WeeklyBarsChart, type WeeklyBarDataPoint } from '@/components/charts/WeeklyBarsChart'
import { WeekComparisonChart, type WeekDataPoint } from '@/components/charts/WeekComparisonChart'
import { MiniSparkline } from '@/components/charts/MiniSparkline'
import { ChartErrorBoundary } from '@/components/charts/ChartErrorBoundary'
import { METRIC_COLORS } from '@/lib/chart-colors'
import type { TrendAPIResponse } from '@/lib/trend-types'

const MIN_ENTRIES_FOR_REVIEW = 7

interface TargetProgress {
  target: {
    id: string
    target_type: string
    weekly_target_minutes: number | null
  }
  label: string
  currentMinutes: number
  targetMinutes: number | null
  percentage: number | null
  trend: 'up' | 'down' | 'same' | null
  previousMinutes: number | null
  isLimitTarget: boolean
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

interface TargetDayScore {
  date: string
  day: string
  rating: DayRating
  targetMinutes: number
  hadDistraction: boolean
}

interface TargetScorecard {
  targetId: string
  targetLabel: string
  isLimitTarget: boolean
  days: TargetDayScore[]
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
  evaluatedDays: number
  highlights: WeekHighlight[]
  // Existing
  totalMinutes: number
  entryCount: number
  previousWeekMinutes: number | null
  previousWeekEntryCount: number
  hasEnoughData: boolean
  hasPreviousWeekData: boolean
  targetProgress: TargetProgress[]
  targetScorecards: TargetScorecard[]
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
  const [showShareModal, setShowShareModal] = useState(false)
  const [trendData, setTrendData] = useState<TrendAPIResponse | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

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
      const response = await csrfFetch('/api/weekly-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, timezone }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch review')
      }

      const data = await response.json()
      cacheSet(cacheKey, data)
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

  // Fetch trend data for metric charts (only for current week)
  // Use 14d period to get both current and previous week for comparison
  useEffect(() => {
    if (status !== 'authenticated' || !isCurrentWeek(weekStart)) {
      setTrendData(null)
      return
    }

    const controller = new AbortController()
    fetch('/api/metrics/trend?period=14d', { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setTrendData(data) })
      .catch(() => {/* ignore abort */})

    return () => controller.abort()
  }, [status, weekStart])

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

  // Build shareable card props from review data
  const buildShareCardProps = (): ShareableStatsCardProps | null => {
    if (!reviewData || !reviewData.hasEnoughData) return null

    const weekDateRange = formatWeekRange(reviewData.weekStart, reviewData.weekEnd)

    // Build top categories from the category breakdown, aggregated
    const aggMinutes = new Map<string, number>()
    for (const cb of reviewData.categoryBreakdown) {
      for (const [aggKey, group] of Object.entries(ENERGY_VIEW)) {
        if (group.categories.includes(cb.category)) {
          aggMinutes.set(aggKey, (aggMinutes.get(aggKey) || 0) + cb.minutes)
          break
        }
      }
    }

    const topCategories = Array.from(aggMinutes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key, minutes]) => ({
        name: AGGREGATED_CATEGORY_LABELS[key as AggregatedCategory] || key,
        key,
        hours: Math.round((minutes / 60) * 10) / 10,
      }))

    // Build ring progress from target progress
    const ringColorMap: Record<string, string> = {
      deep_focus: '#6B8CAE',
      exercise: '#7D9B8A',
      social_time: '#A0848E',
      recovery: '#B5A07A',
      leisure: '#7A7D82',
      meetings: '#8B8680',
    }

    const rings = reviewData.targetProgress
      .filter(tp => tp.percentage !== null)
      .map(tp => ({
        label: tp.label,
        percentage: Math.max(0, Math.min(100, tp.percentage || 0)),
        color: ringColorMap[tp.target.target_type] || '#71717a',
      }))

    return {
      weekDateRange,
      avgDayScore: reviewData.weekScore,
      totalHours: Math.round((reviewData.totalMinutes / 60) * 10) / 10,
      topCategories,
      streakDays: reviewData.highlights.find(h => h.type === 'consistency')
        ? parseInt(reviewData.highlights.find(h => h.type === 'consistency')!.text) || null
        : null,
      rings,
    }
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
      <div className="min-h-screen bg-background pb-20">
        <div className="mx-auto max-w-2xl px-4 py-6">
          {/* Header */}
          <header className="mb-6">
            <div className="flex items-center justify-between">
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
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.push('/pixels')}
                      className="h-9 w-9"
                    >
                      <Grid3X3 className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Year in Pixels</TooltipContent>
                </Tooltip>
                {reviewData?.hasEnoughData && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowShareModal(true)}
                        className="h-9 w-9"
                      >
                        <Share2 className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Share Weekly Stats</TooltipContent>
                  </Tooltip>
                )}
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
                <div className="space-y-6">
                  {/* Motivating prompt */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-900/20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                        <Target className="h-5 w-5 text-amber-500" />
                      </div>
                      <div>
                        <h2 className="font-semibold text-foreground">Almost there!</h2>
                        <p className="text-xs text-muted-foreground">
                          Your weekly review is waiting
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                      Log {MIN_ENTRIES_FOR_REVIEW - reviewData.entryCount} more {MIN_ENTRIES_FOR_REVIEW - reviewData.entryCount === 1 ? 'activity' : 'activities'} to unlock insights, trends, and your personalized coach summary.
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

                  {/* Preview mockup of what the review looks like */}
                  <div className="rounded-xl border border-border bg-card p-5 opacity-50 pointer-events-none select-none">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-3">
                      Preview — What you&apos;ll unlock
                    </p>

                    {/* Fake Week Score */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-xs text-zinc-400">Week Score</p>
                        <p className="text-3xl font-bold text-zinc-300 dark:text-zinc-600">72</p>
                        <p className="text-xs text-zinc-300 dark:text-zinc-600">Solid week</p>
                      </div>
                      <svg className="h-14 w-14 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="none" className="stroke-zinc-200 dark:stroke-zinc-700" strokeWidth="3" />
                        <circle cx="18" cy="18" r="14" fill="none" className="stroke-zinc-300 dark:stroke-zinc-600" strokeWidth="3" strokeLinecap="round" strokeDasharray="63 88" />
                      </svg>
                    </div>

                    {/* Fake highlights */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="rounded-lg bg-zinc-50 dark:bg-zinc-700/30 p-2 flex items-center gap-2">
                        <span className="text-lg">🔥</span>
                        <span className="text-xs text-zinc-300 dark:text-zinc-600">3 day streak</span>
                      </div>
                      <div className="rounded-lg bg-zinc-50 dark:bg-zinc-700/30 p-2 flex items-center gap-2">
                        <span className="text-lg">📈</span>
                        <span className="text-xs text-zinc-300 dark:text-zinc-600">+20% focus</span>
                      </div>
                    </div>

                    {/* Fake coach note */}
                    <div className="rounded-lg bg-zinc-50 dark:bg-zinc-700/30 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="h-4 w-4 text-zinc-300 dark:text-zinc-600" />
                        <span className="text-xs font-medium text-zinc-300 dark:text-zinc-600">Coach&apos;s Reflection</span>
                      </div>
                      <div className="space-y-1">
                        <div className="h-2 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
                        <div className="h-2 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
                        <div className="h-2 w-5/6 rounded bg-zinc-200 dark:bg-zinc-700" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Hero Week Score + Weekly Bars Chart */}
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
                          <span className="font-medium text-foreground text-lg">{reviewData.activeDays}/{reviewData.evaluatedDays || 7}</span>
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

                    {/* Weekly Bars Chart — hero visual showing daily scores */}
                    {trendData && (() => {
                      // Use last 7 entries (current week) from the trend data
                      const focusTrend = trendData.focus.trend.slice(-7)
                      const todayDate = new Date().toISOString().split('T')[0]
                      const barsData: WeeklyBarDataPoint[] = focusTrend.map(d => ({
                        day: d.label,
                        value: d.value,
                        date: d.date,
                      }))
                      const todayIdx = focusTrend.findIndex(d => d.date === todayDate)
                      return (
                        <div className="mt-4 -mx-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 mx-2">
                            Daily Focus Scores
                          </p>
                          <ChartErrorBoundary fallbackValue={reviewData.weekScore} fallbackLabel="Week Score" height={160}>
                            <WeeklyBarsChart
                              data={barsData}
                              average={trendData.focus.average}
                              todayIndex={todayIdx >= 0 ? todayIdx : focusTrend.length - 1}
                              height={160}
                            />
                          </ChartErrorBoundary>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Metric Sparklines — Focus / Balance / Rhythm trends */}
                  {trendData && (
                    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
                      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Metric Trends
                      </h2>
                      <div className="grid grid-cols-3 gap-4">
                        {(['focus', 'balance', 'rhythm'] as const).map(metric => {
                          const md = trendData[metric]
                          // Use last 7 data points for sparkline
                          const last7 = md.trend.slice(-7)
                          return (
                            <div key={metric} className="text-center">
                              <p className="text-xs font-medium text-foreground mb-1 capitalize">{metric}</p>
                              <p className="text-2xl font-bold tabular-nums" style={{ color: METRIC_COLORS[metric].hex }}>
                                {md.current}
                              </p>
                              <div className="mt-1">
                                <ChartErrorBoundary fallbackValue={md.current} fallbackLabel={metric} height={28}>
                                  <MiniSparkline
                                    data={last7.map(d => d.value)}
                                    color={METRIC_COLORS[metric].hex}
                                    average={md.average}
                                    delta={md.vsLastWeek?.change ?? 0}
                                    gradientId={`weekly-sparkline-${metric}`}
                                    height={28}
                                  />
                                </ChartErrorBoundary>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Week Comparison Chart — This Week vs Last Week */}
                  {trendData && trendData.focus.trend.length >= 14 && (
                    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
                      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        This Week vs Last Week
                      </h2>
                      {(() => {
                        const trend = trendData.focus.trend
                        const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                        // Last 7 = current week, first 7 = previous week
                        const prevWeek = trend.slice(0, 7)
                        const currWeek = trend.slice(7, 14)
                        return (
                          <ChartErrorBoundary fallbackLabel="Focus comparison" height={140}>
                            <WeekComparisonChart
                              currentWeek={currWeek.map((d, i) => ({ day: DAYS[i] || d.label, value: d.value }))}
                              previousWeek={prevWeek.map((d, i) => ({ day: DAYS[i] || d.label, value: d.value }))}
                              metricColor={METRIC_COLORS.focus.hex}
                              metricName="Focus"
                              height={140}
                            />
                          </ChartErrorBoundary>
                        )
                      })()}
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

                  {/* Target Progress with Rings */}
                  {reviewData.targetProgress.length > 0 && (
                    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
                      <div className="mb-4 flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        <h2 className="font-semibold text-foreground">Targets</h2>
                      </div>

                      <div className="space-y-4">
                        {reviewData.targetProgress.map((tp) => {
                          // Calculate progress percentage for the ring
                          const ringProgress = tp.isLimitTarget
                            ? tp.targetMinutes && tp.targetMinutes > 0
                              ? Math.max(0, Math.min(100, ((tp.targetMinutes - tp.currentMinutes) / tp.targetMinutes) * 100))
                              : 50
                            : tp.percentage || 0

                          // Determine ring color
                          const ringColor = tp.feedbackTone === 'success' ? 'stroke-green-500'
                            : tp.feedbackTone === 'warning' ? 'stroke-amber-500'
                            : tp.feedbackTone === 'danger' ? 'stroke-red-400'
                            : 'stroke-orange-500'

                          // Week-over-week change
                          const weekChange = tp.changeMinutes !== null && tp.previousMinutes !== null && tp.previousMinutes > 0
                            ? Math.round((tp.changeMinutes / tp.previousMinutes) * 100)
                            : null

                          return (
                            <div key={tp.target.id} className="flex items-center gap-4">
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
                                  <span className="font-medium text-foreground">{tp.label}</span>
                                  {weekChange !== null && (
                                    <span className={`flex items-center gap-1 text-xs font-medium ${
                                      tp.isLimitTarget
                                        ? weekChange < 0 ? 'text-green-500' : weekChange > 0 ? 'text-red-400' : 'text-zinc-400'
                                        : weekChange > 0 ? 'text-green-500' : weekChange < 0 ? 'text-amber-500' : 'text-zinc-400'
                                    }`}>
                                      {tp.isLimitTarget ? (
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
                                    {formatHoursShort(tp.currentMinutes)}
                                    {tp.targetMinutes && !tp.isLimitTarget && (
                                      <span className="text-zinc-400"> / {formatHoursShort(tp.targetMinutes)}</span>
                                    )}
                                    {tp.targetMinutes && tp.isLimitTarget && (
                                      <span className="text-zinc-400"> of {formatHoursShort(tp.targetMinutes)} limit</span>
                                    )}
                                  </span>
                                  {tp.feedbackMessage && (
                                    <span className={`text-xs ${
                                      tp.feedbackTone === 'success' ? 'text-green-500' :
                                      tp.feedbackTone === 'danger' ? 'text-red-400' : ''
                                    }`}>
                                      {tp.feedbackMessage}
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

                  {/* Target Scorecards */}
                  {reviewData.targetScorecards.length > 0 && (
                    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
                      <div className="mb-4 flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        <h2 className="font-semibold text-foreground">Target Scorecard</h2>
                        <InfoTooltip content="Daily progress toward each target. Green = good day, Yellow = some progress, Red = rough day" />
                      </div>

                      <div className="space-y-4">
                        {reviewData.targetScorecards.map((sc) => (
                          <div key={sc.targetId}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-foreground">{sc.targetLabel}</span>
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
                                      {sc.isLimitTarget
                                        ? day.hadDistraction
                                          ? `${formatHoursShort(day.targetMinutes)} over limit`
                                          : 'Under limit'
                                        : day.targetMinutes > 0
                                          ? `${formatHoursShort(day.targetMinutes)} logged`
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

      {/* Share Modal */}
      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent className="max-w-[420px] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Share Your Week</DialogTitle>
            <DialogDescription>
              Screenshot this card and share it on social media!
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center overflow-hidden rounded-xl">
            {(() => {
              const props = buildShareCardProps()
              if (!props) return <p className="text-sm text-zinc-500 py-8">Not enough data to generate a share card.</p>
              return <ShareableStatsCard {...props} />
            })()}
          </div>

          <p className="text-center text-xs text-zinc-500">
            Take a screenshot to share on Instagram, Twitter, or WhatsApp
          </p>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
