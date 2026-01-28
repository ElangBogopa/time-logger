'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { csrfFetch } from '@/lib/api'
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
} from 'lucide-react'
import { ENERGY_VIEW, getAggregatedCategory, TimeCategory, AGGREGATED_CATEGORY_COLORS } from '@/lib/types'

// ─── Types matching API route response ────────────────

interface WeekHighlight {
  type: string
  icon: string
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
  weekScore: number
  weekScoreLabel: string
  activeDays: number
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

// ─── Helpers ────────────────

function getWeekStart(d: Date) {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d)
  monday.setDate(diff)
  return monday.toISOString().split('T')[0]
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
  good: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  neutral: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  rough: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  no_data: 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500',
}

const RATING_ICONS = { good: '✓', neutral: '~', rough: '✗', no_data: '—' }

// ─── Component ────────────────

export default function WeeklyReviewContent() {
  const { status } = useSession()
  const [isLoading, setIsLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()))
  const [reviewData, setReviewData] = useState<WeeklyReviewData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchReview = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const response = await csrfFetch('/api/weekly-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, timezone }),
      })
      if (!response.ok) throw new Error('Failed to fetch review')
      const data = await response.json()
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

  const goToPreviousWeek = () => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() - 7)
    setWeekStart(d.toISOString().split('T')[0])
  }

  const goToNextWeek = () => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + 7)
    const newWeekStart = d.toISOString().split('T')[0]
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
      <div className="rounded-xl border border-red-200 dark:border-red-800 p-6 text-center">
        <p className="text-red-500 mb-3">{error}</p>
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

      {/* Week Score */}
      <div className="flex flex-col items-center mb-5">
        <div className="relative flex items-center justify-center" style={{ width: 110, height: 110 }}>
          <svg width={110} height={110} className="-rotate-90">
            <circle cx={55} cy={55} r={48} stroke="currentColor" strokeWidth={7} fill="none"
              className="text-zinc-200 dark:text-zinc-700" />
            <circle cx={55} cy={55} r={48} stroke="#6366f1" strokeWidth={7} fill="none" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 48}
              strokeDashoffset={2 * Math.PI * 48 - (reviewData.weekScore / 100) * 2 * Math.PI * 48}
              className="transition-all duration-1000" />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-2xl font-bold">{reviewData.weekScore}</span>
            <span className="text-[10px] text-muted-foreground">/ 100</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{reviewData.weekScoreLabel}</p>
        {weekChange !== null && (
          <div className="flex items-center gap-1 mt-1 text-xs">
            {weekChange > 0 ? (
              <><TrendingUp className="h-3.5 w-3.5 text-green-500" /><span className="text-green-500">+{weekChange}%</span></>
            ) : weekChange < 0 ? (
              <><TrendingDown className="h-3.5 w-3.5 text-red-500" /><span className="text-red-500">{weekChange}%</span></>
            ) : (
              <><Minus className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Same</span></>
            )}
            <span className="text-muted-foreground">vs last week</span>
          </div>
        )}
      </div>

      {/* Highlights */}
      {reviewData.highlights.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-5">
          {reviewData.highlights.map((h, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3">
              <span className="text-lg">{h.icon}</span>
              <p className="text-sm font-medium mt-1">{h.text}</p>
              {h.subtext && <p className="text-[11px] text-muted-foreground">{h.subtext}</p>}
            </div>
          ))}
        </div>
      )}

      {/* AI Coach Summary */}
      {reviewData.coachSummary && (
        <section className="mb-5">
          <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200/50 dark:border-indigo-800/50 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground leading-relaxed">{reviewData.coachSummary}</p>
            </div>
          </div>
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
          <p className="text-lg font-bold">{reviewData.activeDays}/7</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Entries</p>
          <p className="text-lg font-bold">{reviewData.entryCount}</p>
        </div>
      </div>

      {/* Target Scorecards */}
      {reviewData.targetScorecards.length > 0 && (
        <section className="mb-5">
          <h2 className="font-semibold text-foreground text-sm mb-3">
            <Target className="h-4 w-4 inline mr-1" />
            Goal Scorecards
          </h2>
          <div className="space-y-3">
            {reviewData.targetScorecards.map((sc) => (
              <div key={sc.targetId} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{sc.targetLabel}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {sc.goodDays} good · {sc.roughDays} rough
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {sc.days.map((day) => (
                    <div key={day.date} className="flex-1 text-center">
                      <p className="text-[9px] text-muted-foreground mb-1">{day.day}</p>
                      <div className={`mx-auto h-7 w-7 rounded-md flex items-center justify-center text-[10px] font-medium ${RATING_STYLES[day.rating]}`}>
                        {RATING_ICONS[day.rating]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Target Progress Bars */}
      {reviewData.targetProgress.length > 0 && (
        <section className="mb-5">
          <h2 className="font-semibold text-foreground text-sm mb-3">Goal Progress</h2>
          <div className="space-y-3">
            {reviewData.targetProgress.map((tp) => {
              const pct = Math.min(tp.percentage ?? 0, 100)
              const trendIcon = tp.trend === 'up' ? '↑' : tp.trend === 'down' ? '↓' : ''
              return (
                <div key={tp.target.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{tp.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatMinutes(tp.currentMinutes)} / {formatMinutes(tp.targetMinutes)}
                      {trendIcon && <span className="ml-1">{trendIcon}</span>}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-blue-500' : 'bg-zinc-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {tp.feedbackMessage && (
                    <p className={`text-[11px] mt-1.5 ${
                      tp.feedbackTone === 'success' ? 'text-green-600 dark:text-green-400' :
                      tp.feedbackTone === 'warning' ? 'text-amber-600 dark:text-amber-400' :
                      tp.feedbackTone === 'danger' ? 'text-red-600 dark:text-red-400' :
                      'text-muted-foreground'
                    }`}>
                      {tp.feedbackMessage}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Category Breakdown */}
      {reviewData.categoryBreakdown.length > 0 && (
        <section className="mb-5">
          <h2 className="font-semibold text-foreground text-sm mb-3">Category Breakdown</h2>
          <div className="space-y-2">
            {reviewData.categoryBreakdown.slice(0, 8).map((cb) => {
              const aggCat = getAggregatedCategory(cb.category as TimeCategory)
              const colorClass = AGGREGATED_CATEGORY_COLORS[aggCat] || 'bg-zinc-500'
              return (
                <div key={cb.category} className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full flex-shrink-0 ${colorClass}`} />
                  <span className="text-sm flex-1">{cb.label}</span>
                  <span className="text-sm text-muted-foreground">{formatMinutes(cb.minutes)}</span>
                  <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(cb.percentage)}%</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

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
    </div>
  )
}
