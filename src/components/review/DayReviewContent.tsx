'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { csrfFetch } from '@/lib/api'
import { cacheGet, cacheSet } from '@/lib/client-cache'
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TimeCategory,
  MoodCheckin,
  MOOD_EMOJIS,
  SESSION_MOOD_CONFIG,
  TimeEntry,
  AggregatedCategory,
  getUserToday,
} from '@/lib/types'

import {
  getAggregatedCategory,
  AGGREGATED_CATEGORY_LABELS,
  AGGREGATED_CATEGORY_COLORS,
} from '@/lib/types'

interface Win { icon: string; label: string }
interface TargetProgress { targetId: string; label: string; emoji: string; currentMinutes: number; targetMinutes: number; percentComplete: number; todayMinutes?: number; dailyTarget?: number; progress?: number }
interface CategoryBreakdown { category: TimeCategory; label: string; totalMinutes: number; percentage: number }
interface AggregatedBreakdown { category: AggregatedCategory; label: string; totalMinutes: number; percentage: number }
interface TimelineSlot { hour: number; period: 'morning' | 'afternoon' | 'evening'; hasEntry: boolean; category?: TimeCategory; minutes?: number }
interface DaySummary {
  date: string; score: number; scoreColor: string
  sessionsLogged: number; totalSessions: number; totalMinutesLogged: number
  wins: Win[]; targetProgress: TargetProgress[]
  categoryBreakdown: CategoryBreakdown[]; aggregatedBreakdown: AggregatedBreakdown[]
  timeline: TimelineSlot[]; todayMood: MoodCheckin | null
  longestFocusSession: { activity: string; minutes: number } | null
}

// ─── Helpers ─────────────────────────────────────────────────
function formatMinutes(m: number) {
  const h = Math.floor(m / 60)
  const mins = m % 60
  return h > 0 ? `${h}h ${mins}m` : `${mins}m`
}

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

// ─── Sub-components ──────────────────────────────────────────
function ScoreCircle({ score, color, size = 'large' }: { score: number; color: string; size?: 'large' | 'small' }) {
  const sz = size === 'large' ? 120 : 64
  const sw = size === 'large' ? 8 : 4
  const r = (sz - sw) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const colorMap: Record<string, string> = { green: '#22c55e', yellow: '#eab308', orange: '#f97316', red: '#ef4444' }
  const strokeColor = colorMap[color] || '#6366f1'

  return (
    <div className="relative flex items-center justify-center" style={{ width: sz, height: sz }}>
      <svg width={sz} height={sz} className="-rotate-90">
        <circle cx={sz/2} cy={sz/2} r={r} stroke="currentColor" strokeWidth={sw} fill="none" className="text-zinc-200 dark:text-zinc-700" />
        <circle cx={sz/2} cy={sz/2} r={r} stroke={strokeColor} strokeWidth={sw} fill="none" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} className="transition-all duration-1000" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`font-bold ${size === 'large' ? 'text-3xl' : 'text-lg'}`}>{score}</span>
        {size === 'large' && <span className="text-xs text-muted-foreground">/ 100</span>}
      </div>
    </div>
  )
}

function WinsSection({ wins }: { wins: Win[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-amber-500" />
        <h2 className="font-semibold text-foreground text-sm">Today&apos;s Wins</h2>
      </div>
      <div className="space-y-2">
        {wins.map((w, i) => (
          <div key={i} className="flex items-center gap-2 text-sm"><span>{w.icon}</span><span className="text-foreground">{w.label}</span></div>
        ))}
      </div>
    </section>
  )
}

function TargetCard({ target }: { target: TargetProgress }) {
  // Handle both field naming conventions from different API responses
  const current = target.currentMinutes ?? target.todayMinutes ?? 0
  const total = target.targetMinutes ?? target.dailyTarget ?? 0
  const pct = Math.min(target.percentComplete ?? target.progress ?? (total > 0 ? (current / total) * 100 : 0), 100)
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {target.emoji && <span>{target.emoji}</span>}
          <span className="text-sm font-medium">{target.label}</span>
        </div>
        <span className="text-xs text-muted-foreground">{formatMinutes(current)} / {formatMinutes(total)}</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-blue-500' : 'bg-zinc-400')}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function TimelineStrip({ timeline }: { timeline: TimelineSlot[] }) {
  return (
    <section>
      <h2 className="font-semibold text-foreground text-sm mb-3">Timeline</h2>
      <div className="flex gap-0.5">
        {timeline.map((slot, i) => (
          <div key={i} title={`${slot.hour}:00 - ${slot.hasEntry ? slot.category : 'empty'}`}
            className={cn('h-8 flex-1 rounded-sm transition-colors',
              slot.hasEntry ? AGGREGATED_CATEGORY_COLORS[getAggregatedCategory(slot.category!)] || 'bg-blue-500' : 'bg-secondary'
            )} />
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">6am</span>
        <span className="text-[10px] text-muted-foreground">12pm</span>
        <span className="text-[10px] text-muted-foreground">6pm</span>
        <span className="text-[10px] text-muted-foreground">12am</span>
      </div>
    </section>
  )
}

function AggregatedBreakdownSection({ breakdown }: { breakdown: AggregatedBreakdown[] }) {
  const total = breakdown.reduce((s, b) => s + b.totalMinutes, 0)
  return (
    <section>
      <h2 className="font-semibold text-foreground text-sm mb-3">Energy Breakdown</h2>
      <div className="space-y-2">
        {breakdown.map(b => (
          <div key={b.category} className="flex items-center gap-3">
            <div className={cn('h-3 w-3 rounded-full', AGGREGATED_CATEGORY_COLORS[b.category as AggregatedCategory])} />
            <span className="text-sm flex-1">{b.label}</span>
            <span className="text-sm text-muted-foreground">{formatMinutes(b.totalMinutes)}</span>
            <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(b.percentage)}%</span>
          </div>
        ))}
      </div>
    </section>
  )
}

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

// ─── Main Component ──────────────────────────────────────────
export default function DayReviewContent() {
  const { status } = useSession()
  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [commentary, setCommentary] = useState<string | null>(null)
  const [isLoadingCommentary, setIsLoadingCommentary] = useState(false)
  const [currentHour, setCurrentHour] = useState<number | null>(null)

  useEffect(() => {
    setCurrentHour(new Date().getHours())
  }, [])

  const isLocked = currentHour !== null && currentHour < 21

  const fetchSummary = useCallback(async () => {
    // Check cache for summary
    const cacheKey = `day-summary:${getUserToday()}`
    const summaryCache = cacheGet<DaySummary>(cacheKey)
    if (summaryCache) {
      setSummary(summaryCache)
      setIsLoading(false)
      // Still check for cached commentary
      const commentaryCache = cacheGet<string>(`day-commentary:${getUserToday()}`)
      if (commentaryCache) {
        setCommentary(commentaryCache)
        return
      }
    }

    try {
      const response = await fetch(`/api/day-summary?date=${getUserToday()}`)
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      cacheSet(`day-summary:${getUserToday()}`, data)
      setSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchCommentary = useCallback(async (summaryData: DaySummary) => {
    // Check cache first — avoids redundant OpenAI calls
    const cached = cacheGet<string>(`day-commentary:${getUserToday()}`)
    if (cached) {
      setCommentary(cached)
      return
    }

    setIsLoadingCommentary(true)
    try {
      const response = await csrfFetch('/api/day-commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: summaryData.score,
          totalMinutesLogged: summaryData.totalMinutesLogged,
          wins: summaryData.wins,
          targetProgress: summaryData.targetProgress,
          mood: summaryData.todayMood?.mood || null,
          longestFocusSession: summaryData.longestFocusSession,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        cacheSet(`day-commentary:${getUserToday()}`, data.commentary)
        setCommentary(data.commentary)
      }
    } catch (err) {
      console.error('Failed to fetch commentary:', err)
    } finally {
      setIsLoadingCommentary(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && !isLocked) fetchSummary()
  }, [status, fetchSummary, isLocked])

  useEffect(() => {
    if (summary && !commentary && !isLoadingCommentary) fetchCommentary(summary)
  }, [summary, commentary, isLoadingCommentary, fetchCommentary])

  // Locked before 9pm
  if (isLocked) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary mb-5">
          <Clock className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">Not available yet</h2>
        <p className="text-sm text-muted-foreground text-center max-w-xs mb-1">
          Your daily review unlocks at 9:00 PM once your day is wrapping up.
        </p>
        {currentHour !== null && (
          <p className="text-xs text-muted-foreground/50">
            {21 - currentHour} hour{21 - currentHour !== 1 ? 's' : ''} to go
          </p>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !summary) {
    return <p className="text-center text-muted-foreground py-12">Unable to load day review</p>
  }

  return (
    <div>
      {/* Score Hero */}
      <section className="flex flex-col items-center py-6 mb-6">
        <ScoreCircle score={summary.score} color={summary.scoreColor} size="large" />
        <h2 className="text-lg font-semibold mt-3">Day in Review</h2>
        <p className="text-sm text-muted-foreground">
          {formatDate(summary.date)} · {summary.sessionsLogged}/{summary.totalSessions} sessions · {formatMinutes(summary.totalMinutesLogged)} tracked
        </p>
      </section>

      {/* AI Commentary */}
      {(commentary || isLoadingCommentary) && (
        <section className="mb-6">
          <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200/50 dark:border-indigo-800/50 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                {isLoadingCommentary ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-4 bg-indigo-200 dark:bg-indigo-800 rounded w-full" />
                    <div className="h-4 bg-indigo-200 dark:bg-indigo-800 rounded w-3/4" />
                  </div>
                ) : (
                  <p className="text-sm text-foreground leading-relaxed">{commentary}</p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {summary.wins.length > 0 && <div className="mb-6"><WinsSection wins={summary.wins} /></div>}
      <div className="mb-6"><TimelineStrip timeline={summary.timeline} /></div>
      {summary.targetProgress.length > 0 && (
        <section className="mb-6 space-y-3">
          <h2 className="font-semibold text-foreground">Goal Progress</h2>
          <div className="space-y-3">{summary.targetProgress.map(tp => <TargetCard key={tp.targetId} target={tp} />)}</div>
        </section>
      )}
      {/* Energy breakdown — commented out until science-based measurement is ready
      {summary.aggregatedBreakdown && summary.aggregatedBreakdown.length > 0 && (
        <div className="mb-6"><AggregatedBreakdownSection breakdown={summary.aggregatedBreakdown} /></div>
      )}
      */}
      {/* Mood — commented out until science-based measurement is ready
      {summary.todayMood && <div className="mb-6"><MoodSection mood={summary.todayMood} /></div>}
      */}
      {summary.longestFocusSession && summary.longestFocusSession.minutes >= 30 && (
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Longest focus session</p>
              <p className="font-medium text-foreground">{summary.longestFocusSession.minutes} min on &quot;{summary.longestFocusSession.activity}&quot;</p>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
