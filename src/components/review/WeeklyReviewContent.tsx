'use client'

/**
 * WeeklyReviewContent — embeds the full weekly review page as a tab.
 * Instead of duplicating 800 lines, we dynamically import the page component
 * and render it within the review tab. The page already handles its own
 * auth, data fetching, and rendering.
 * 
 * We strip the outer chrome (min-h-screen, pb-20, header) by wrapping.
 */

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
  MoreHorizontal,
} from 'lucide-react'
import { ENERGY_VIEW } from '@/lib/types'

// ─── Types (mirrored from weekly-review page) ────────────────
interface TargetProgress { type: string; label: string; emoji: string; currentMinutes: number; targetMinutes: number; percentComplete: number; weeklyDelta: number | null }
interface CategoryBreakdown { category: string; label: string; minutes: number; percentage: number; color: string }
interface DayScore { date: string; dayOfWeek: string; score: number; totalMinutes: number; sessionsCompleted: number }
interface WeeklyReviewData {
  weekStart: string; weekEnd: string; hasEnoughData: boolean; entryCount: number
  overallScore: number; totalMinutesLogged: number; averageDailyMinutes: number
  daysTracked: number; currentStreak: number; bestStreak: number
  targetProgress: TargetProgress[]; categoryBreakdown: CategoryBreakdown[]
  dailyScores: DayScore[]; aiCommentary: string | null
  weekOverWeekChange: number | null; consistencyScore: number
}

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

  // Not enough data
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

  return (
    <div>
      {/* Week Navigation */}
      <div className="flex items-center justify-between rounded-xl bg-zinc-100 dark:bg-zinc-800 p-3 mb-6">
        <button onClick={goToPreviousWeek} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <MoreHorizontal className="h-4 w-4 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {isCurrentWeek ? 'This week' : formatWeekRange(reviewData.weekStart, reviewData.weekEnd)}
          </p>
        </div>
        <button onClick={goToNextWeek} disabled={isCurrentWeek}
          className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg disabled:opacity-30">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Score */}
      <div className="flex flex-col items-center mb-6">
        <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
          <svg width={120} height={120} className="-rotate-90">
            <circle cx={60} cy={60} r={52} stroke="currentColor" strokeWidth={8} fill="none" className="text-zinc-200 dark:text-zinc-700" />
            <circle cx={60} cy={60} r={52} stroke="#6366f1" strokeWidth={8} fill="none" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 52} strokeDashoffset={2 * Math.PI * 52 - (reviewData.overallScore / 100) * 2 * Math.PI * 52}
              className="transition-all duration-1000" />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-3xl font-bold">{reviewData.overallScore}</span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
        </div>
        {reviewData.weekOverWeekChange !== null && (
          <div className="flex items-center gap-1 mt-2 text-sm">
            {reviewData.weekOverWeekChange > 0 ? (
              <><TrendingUp className="h-4 w-4 text-green-500" /><span className="text-green-500">+{reviewData.weekOverWeekChange}%</span></>
            ) : reviewData.weekOverWeekChange < 0 ? (
              <><TrendingDown className="h-4 w-4 text-red-500" /><span className="text-red-500">{reviewData.weekOverWeekChange}%</span></>
            ) : (
              <><Minus className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">No change</span></>
            )}
            <span className="text-muted-foreground">vs last week</span>
          </div>
        )}
      </div>

      {/* AI Commentary */}
      {reviewData.aiCommentary && (
        <section className="mb-6">
          <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200/50 dark:border-indigo-800/50 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground leading-relaxed">{reviewData.aiCommentary}</p>
            </div>
          </div>
        </section>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-sm text-muted-foreground">Time Logged</p>
          <p className="text-xl font-bold">{formatMinutes(reviewData.totalMinutesLogged)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-sm text-muted-foreground">Daily Average</p>
          <p className="text-xl font-bold">{formatMinutes(reviewData.averageDailyMinutes)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-sm text-muted-foreground">Days Tracked</p>
          <p className="text-xl font-bold">{reviewData.daysTracked}/7</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-sm text-muted-foreground">Consistency</p>
          <p className="text-xl font-bold">{reviewData.consistencyScore}%</p>
        </div>
      </div>

      {/* Daily Scores */}
      {reviewData.dailyScores.length > 0 && (
        <section className="mb-6">
          <h2 className="font-semibold text-foreground text-sm mb-3">Daily Scores</h2>
          <div className="flex gap-2">
            {reviewData.dailyScores.map((day) => (
              <div key={day.date} className="flex-1 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">{day.dayOfWeek.slice(0, 3)}</p>
                <div className={`mx-auto h-10 w-10 rounded-lg flex items-center justify-center text-sm font-medium ${
                  day.score >= 70 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  day.score >= 40 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                  day.score > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'
                }`}>
                  {day.score > 0 ? day.score : '—'}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Target Progress */}
      {reviewData.targetProgress.length > 0 && (
        <section className="mb-6">
          <h2 className="font-semibold text-foreground text-sm mb-3">
            <Target className="h-4 w-4 inline mr-1" />
            Goal Progress
          </h2>
          <div className="space-y-3">
            {reviewData.targetProgress.map((tp) => {
              const pct = Math.min(tp.percentComplete, 100)
              return (
                <div key={tp.type} className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span>{tp.emoji}</span>
                      <span className="text-sm font-medium">{tp.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatMinutes(tp.currentMinutes)} / {formatMinutes(tp.targetMinutes)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-blue-500' : 'bg-zinc-400'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Category Breakdown */}
      {reviewData.categoryBreakdown.length > 0 && (
        <section className="mb-6">
          <h2 className="font-semibold text-foreground text-sm mb-3">Category Breakdown</h2>
          <div className="space-y-2">
            {reviewData.categoryBreakdown.slice(0, 8).map((cb) => (
              <div key={cb.category} className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cb.color }} />
                <span className="text-sm flex-1">{cb.label}</span>
                <span className="text-sm text-muted-foreground">{formatMinutes(cb.minutes)}</span>
                <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(cb.percentage)}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Streak */}
      {reviewData.currentStreak > 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-center">
          <p className="text-sm text-muted-foreground">Current Streak</p>
          <p className="text-2xl font-bold">🔥 {reviewData.currentStreak} days</p>
          {reviewData.bestStreak > reviewData.currentStreak && (
            <p className="text-xs text-muted-foreground mt-1">Best: {reviewData.bestStreak} days</p>
          )}
        </div>
      )}
    </div>
  )
}
