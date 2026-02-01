'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUserToday } from '@/lib/types'

interface TargetProgress {
  targetId: string
  targetType: string
  label: string
  todayMinutes: number
  yesterdayMinutes: number
  dailyTarget: number
  weeklyTarget: number
  weekMinutes: number
  progress: number
  direction: 'at_least' | 'at_most'
  trend: 'up' | 'down' | 'same'
}

interface DaySummary {
  score: number
  scoreColor: 'green' | 'orange' | 'red'
  targetProgress: TargetProgress[]
  sessionsLogged: number
  totalSessions: number
  totalMinutesLogged: number
  hasEveningPassed: boolean
}

interface DayInReviewProps {
  className?: string
}

function formatMinutes(minutes: number): string {
  if (minutes === 0) return '0m'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function ScoreCircle({ score, color }: { score: number; color: 'green' | 'orange' | 'red' }) {
  const colorClasses = {
    green: 'text-green-500 border-green-500/30 bg-green-500/10',
    orange: 'text-amber-500 border-amber-500/30 bg-amber-500/10',
    red: 'text-red-500 border-red-500/30 bg-red-500/10',
  }

  const ringColor = {
    green: 'stroke-green-500',
    orange: 'stroke-amber-500',
    red: 'stroke-red-500',
  }

  // SVG circle progress
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference

  return (
    <div className="relative flex items-center justify-center">
      {/* Background circle */}
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-zinc-200 dark:text-zinc-700"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className={ringColor[color]}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset,
            transition: 'stroke-dashoffset 0.5s ease-in-out',
          }}
        />
      </svg>
      {/* Score text */}
      <div className={cn('absolute flex flex-col items-center', colorClasses[color].split(' ')[0])}>
        <span className="text-2xl font-bold">{score}</span>
      </div>
    </div>
  )
}

export default function DayInReview({ className }: DayInReviewProps) {
  const router = useRouter()
  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch(`/api/day-summary?date=${getUserToday()}`)
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  // Don't show if loading, error, or evening hasn't passed
  if (isLoading) {
    return (
      <div className={cn('rounded-xl border border-border p-4', className)}>
        <div className="flex items-center gap-4 animate-pulse">
          <div className="w-20 h-20 rounded-full bg-zinc-200 dark:bg-zinc-700" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-24" />
            <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-32" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !summary) {
    return null
  }

  // Only show when evening has passed (after 9pm)
  if (!summary.hasEveningPassed) {
    return null
  }

  return (
    <button
      onClick={() => router.push(`/day-review?date=${getUserToday()}`)}
      className={cn(
        'w-full text-left rounded-xl border border-border bg-card p-4',
        'hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all',
        'active:scale-[0.99]',
        className
      )}
    >
      {/* Header with score */}
      <div className="flex items-center gap-4">
        <ScoreCircle score={summary.score} color={summary.scoreColor} />

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground">Day in Review</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {summary.sessionsLogged}/{summary.totalSessions} sessions logged
            {summary.totalMinutesLogged > 0 && (
              <span className="ml-1">
                · {formatMinutes(summary.totalMinutesLogged)} tracked
              </span>
            )}
          </p>
        </div>

        <ChevronRight className="h-5 w-5 text-zinc-400 flex-shrink-0" />
      </div>

      {/* Tap to see details hint */}
      <p className="text-xs text-muted-foreground mt-3 text-center">
        Tap to see full review
      </p>
    </button>
  )
}
