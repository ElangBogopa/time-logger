'use client'

import { csrfFetch } from '@/lib/api'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Sparkles,
  Target,
  Zap,
  Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TimeCategory,
  MoodCheckin,
  MOOD_EMOJIS,
  SESSION_MOOD_CONFIG,
  TimeEntry,
  AggregatedCategory,
} from '@/lib/types'

// Map each TimeCategory → aggregated category (mirrors ENERGY_VIEW)
const CATEGORY_TO_AGGREGATED: Record<TimeCategory, AggregatedCategory> = {
  deep_work: 'focus',
  learning: 'focus',
  creating: 'focus',
  shallow_work: 'ops',
  meetings: 'ops',
  admin: 'ops',
  errands: 'ops',
  chores: 'ops',
  commute: 'ops',
  exercise: 'body',
  movement: 'body',
  meals: 'body',
  sleep: 'body',
  rest: 'recovery',
  self_care: 'recovery',
  social: 'connection',
  calls: 'connection',
  entertainment: 'escape',
  other: 'escape',
}

// Muted 6-color palette for aggregated categories
const AGGREGATED_HEX: Record<AggregatedCategory, string> = {
  focus: '#6B8CAE',      // Slate blue
  ops: '#8B8680',        // Warm gray
  body: '#7D9B8A',       // Sage green
  recovery: '#B5A07A',   // Dusty amber
  connection: '#A0848E', // Muted rose
  escape: '#7A7D82',     // Cool gray
}

// Category colors for timeline strip — uses aggregated hex colors
const CATEGORY_COLORS: Record<TimeCategory, string> = Object.fromEntries(
  (Object.keys(CATEGORY_TO_AGGREGATED) as TimeCategory[]).map(cat => [
    cat,
    `bg-[${AGGREGATED_HEX[CATEGORY_TO_AGGREGATED[cat]]}]`,
  ])
) as Record<TimeCategory, string>

// Aggregated category colors (for the 6-category energy view)
const AGGREGATED_COLORS: Record<AggregatedCategory, string> = {
  focus: 'bg-[#6B8CAE]',
  ops: 'bg-[#8B8680]',
  body: 'bg-[#7D9B8A]',
  recovery: 'bg-[#B5A07A]',
  connection: 'bg-[#A0848E]',
  escape: 'bg-[#7A7D82]',
}

const AGGREGATED_TEXT_COLORS: Record<AggregatedCategory, string> = {
  focus: 'text-[#6B8CAE]',
  ops: 'text-[#8B8680]',
  body: 'text-[#7D9B8A]',
  recovery: 'text-[#B5A07A]',
  connection: 'text-[#A0848E]',
  escape: 'text-[#7A7D82]',
}

interface TargetProgress {
  targetId: string
  targetType: string
  label: string
  todayMinutes: number
  yesterdayMinutes: number
  sameDayLastWeekMinutes: number
  dailyTarget: number
  weeklyTarget: number
  weekMinutes: number
  progress: number
  direction: 'at_least' | 'at_most'
  trend: 'up' | 'down' | 'same'
  vsLastWeekTrend: 'up' | 'down' | 'same'
}

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
  isTargetLinked: boolean
}

interface DaySummary {
  score: number
  scoreColor: 'green' | 'orange' | 'red'
  sessionsLogged: number
  totalSessions: number
  totalMinutesLogged: number
  hasEveningPassed: boolean
  date: string
  targetProgress: TargetProgress[]
  wins: Win[]
  timeline: TimelineBlock[]
  longestFocusSession: { activity: string; minutes: number } | null
  categoryBreakdown: CategoryBreakdown[]
  aggregatedBreakdown: AggregatedBreakdown[]
  todayMood: MoodCheckin | null
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

// Score Circle Component
function ScoreCircle({ score, color, size = 'large' }: { score: number; color: 'green' | 'orange' | 'red'; size?: 'small' | 'large' }) {
  const ringColor = {
    green: 'stroke-green-500',
    orange: 'stroke-amber-500',
    red: 'stroke-red-500',
  }

  const textColor = {
    green: 'text-green-500',
    orange: 'text-amber-500',
    red: 'text-red-500',
  }

  const radius = size === 'large' ? 54 : 36
  const strokeWidth = size === 'large' ? 8 : 6
  const viewBox = size === 'large' ? '0 0 120 120' : '0 0 80 80'
  const center = size === 'large' ? 60 : 40
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference

  return (
    <div className="relative flex items-center justify-center">
      <svg className={cn('-rotate-90', size === 'large' ? 'w-[120px] h-[120px]' : 'w-20 h-20')} viewBox={viewBox}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-zinc-200 dark:text-zinc-700"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={ringColor[color]}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset,
            transition: 'stroke-dashoffset 0.5s ease-in-out',
          }}
        />
      </svg>
      <div className={cn('absolute flex flex-col items-center', textColor[color])}>
        <span className={cn('font-bold', size === 'large' ? 'text-4xl' : 'text-2xl')}>{score}</span>
        {size === 'large' && <span className="text-xs text-muted-foreground">/ 100</span>}
      </div>
    </div>
  )
}

// Wins Section
function WinsSection({ wins }: { wins: Win[] }) {
  if (wins.length === 0) return null

  const winIcons: Record<Win['type'], React.ReactNode> = {
    goal_met: <Target className="h-4 w-4 text-green-500" />,
    streak: <Zap className="h-4 w-4 text-amber-500" />,
    focus: <Clock className="h-4 w-4 text-blue-500" />,
    improvement: <TrendingUp className="h-4 w-4 text-purple-500" />,
    balance: <Sparkles className="h-4 w-4 text-pink-500" />,
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-amber-500" />
        <h2 className="font-semibold text-foreground">Today&apos;s Wins</h2>
      </div>
      <div className="space-y-2">
        {wins.map(win => (
          <div
            key={win.id}
            className="flex items-center gap-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 px-3 py-2"
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
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                {block.hour}
              </div>
            </div>
          )
        })}
      </div>
      {/* Hour labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground px-1">
        <span>{startHour}:00</span>
        <span>12:00</span>
        <span>{endHour}:00</span>
      </div>
    </section>
  )
}

// Trend Icon Component (extracted to avoid creating components during render)
function TrendIcon({ trend, direction }: { trend: 'up' | 'down' | 'same'; direction: 'at_least' | 'at_most' }) {
  const isGood = direction === 'at_least' ? trend === 'up' : trend === 'down'

  if (trend === 'same') return <Minus className="h-3 w-3 text-zinc-400" />
  if (trend === 'up') return <TrendingUp className={cn('h-3 w-3', isGood ? 'text-green-500' : 'text-red-500')} />
  return <TrendingDown className={cn('h-3 w-3', isGood ? 'text-green-500' : 'text-red-500')} />
}

// Target Progress Card
function TargetCard({ target }: { target: TargetProgress }) {
  const getBarColor = () => {
    if (target.progress >= 80) return 'bg-green-500'
    if (target.progress >= 50) return 'bg-amber-500'
    return 'bg-red-500'
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-foreground">{target.label}</h3>
          <p className="text-2xl font-bold text-foreground mt-1">
            {formatMinutes(target.todayMinutes)}
            <span className="text-sm font-normal text-muted-foreground ml-1">
              / {formatMinutes(target.dailyTarget)}
            </span>
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>vs yesterday</span>
            <TrendIcon trend={target.trend} direction={target.direction} />
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <span>vs last week</span>
            <TrendIcon trend={target.vsLastWeekTrend} direction={target.direction} />
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', getBarColor())}
          style={{ width: `${Math.min(target.progress, 100)}%` }}
        />
      </div>

      {/* Comparison stats */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Yesterday: {formatMinutes(target.yesterdayMinutes)}</span>
        <span>Last {new Date().toLocaleDateString('en-US', { weekday: 'short' })}: {formatMinutes(target.sameDayLastWeekMinutes)}</span>
      </div>
    </div>
  )
}

// Aggregated Category Breakdown (6 energy categories)
function AggregatedBreakdownSection({ breakdown }: { breakdown: AggregatedBreakdown[] }) {
  // Filter to only show categories with time (or target-linked)
  const visibleCategories = breakdown.filter(cat => cat.minutes > 0 || cat.isTargetLinked)

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
                <span className={cn(
                  'text-sm font-medium',
                  cat.isTargetLinked ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {cat.label}
                </span>
                {cat.isTargetLinked && (
                  <Target className="h-3 w-3 text-blue-500" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-sm font-medium',
                  cat.isTargetLinked ? 'text-foreground' : 'text-muted-foreground'
                )}>
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

function DayReviewContent() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const dateParam = searchParams.get('date')
  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [commentary, setCommentary] = useState<string | null>(null)
  const [isLoadingCommentary, setIsLoadingCommentary] = useState(false)

  // Generate AI commentary from summary data
  const generateCommentary = useCallback(async (summaryData: DaySummary): Promise<string | null> => {
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
        return data.commentary || null
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
          targetProgress: summaryData.targetProgress,
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

  // Main fetch logic — checks persistence layer first
  const fetchData = useCallback(async () => {
    try {
      // Step 1: Check persistence status
      const reviewUrl = dateParam ? `/api/day-review?date=${dateParam}` : '/api/day-review'
      const reviewRes = await fetch(reviewUrl)
      if (!reviewRes.ok) throw new Error('Failed to fetch review status')
      const reviewData = await reviewRes.json()

      if (reviewData.source === 'saved') {
        // Locked & finalized — use saved data directly
        const saved = reviewData.review
        setSummary(saved)
        setCommentary(saved.commentary || null)
        setIsLoading(false)
        return
      }

      // Either 'live' (editable) or 'needs_finalization' (locked but not saved yet)
      // In both cases, fetch fresh summary
      const summaryUrl = dateParam ? `/api/day-summary?date=${dateParam}` : '/api/day-summary'
      const summaryRes = await fetch(summaryUrl)
      if (!summaryRes.ok) throw new Error('Failed to fetch summary')
      const summaryData: DaySummary = await summaryRes.json()
      setSummary(summaryData)
      setIsLoading(false)

      // Fetch AI commentary
      setIsLoadingCommentary(true)
      const commentaryText = await generateCommentary(summaryData)
      setCommentary(commentaryText)
      setIsLoadingCommentary(false)

      // If needs finalization (locked date, first view), save to DB
      if (reviewData.source === 'needs_finalization') {
        await saveReview(summaryData, commentaryText)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setIsLoading(false)
    }
  }, [dateParam, generateCommentary, saveReview])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData()
    } else if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, fetchData, router])

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-background p-4">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
        <p className="text-center text-muted-foreground">Unable to load day review</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Header */}
        <header className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground mb-4 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-foreground">Day in Review</h1>
          <p className="text-muted-foreground">{formatDate(summary.date)}</p>
        </header>

        {/* Score Hero */}
        <section className="flex flex-col items-center py-6 mb-6">
          <ScoreCircle score={summary.score} color={summary.scoreColor} size="large" />
          <p className="text-sm text-muted-foreground mt-4">
            {summary.sessionsLogged}/{summary.totalSessions} sessions · {formatMinutes(summary.totalMinutesLogged)} tracked
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

        {/* Wins */}
        {summary.wins.length > 0 && (
          <div className="mb-6">
            <WinsSection wins={summary.wins} />
          </div>
        )}

        {/* Timeline */}
        <div className="mb-6">
          <TimelineStrip timeline={summary.timeline} />
        </div>

        {/* Target Progress */}
        {summary.targetProgress.length > 0 && (
          <section className="mb-6 space-y-3">
            <h2 className="font-semibold text-foreground">Goal Progress</h2>
            <div className="space-y-3">
              {summary.targetProgress.map(tp => (
                <TargetCard key={tp.targetId} target={tp} />
              ))}
            </div>
          </section>
        )}

        {/* Aggregated Energy Breakdown (primary view) */}
        {summary.aggregatedBreakdown && summary.aggregatedBreakdown.length > 0 && (
          <div className="mb-6">
            <AggregatedBreakdownSection breakdown={summary.aggregatedBreakdown} />
          </div>
        )}

        {/* Detailed Category Breakdown (secondary) */}
        {summary.categoryBreakdown && summary.categoryBreakdown.length > 5 && (
          <div className="mb-6">
            <CategoryBreakdownSection breakdown={summary.categoryBreakdown} />
          </div>
        )}

        {/* Mood */}
        {summary.todayMood && (
          <div className="mb-6">
            <MoodSection mood={summary.todayMood} />
          </div>
        )}

        {/* Longest Focus */}
        {summary.longestFocusSession && summary.longestFocusSession.minutes >= 30 && (
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Longest focus session</p>
                <p className="font-medium text-foreground">
                  {summary.longestFocusSession.minutes} min on &quot;{summary.longestFocusSession.activity}&quot;
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export default function DayReviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    }>
      <DayReviewContent />
    </Suspense>
  )
}
