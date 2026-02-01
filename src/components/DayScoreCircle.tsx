'use client'

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { getUserToday } from '@/lib/types'

interface DaySummaryData {
  score: number
  scoreColor: 'green' | 'orange' | 'red'
  sessionsLogged: number
  totalSessions: number
  totalMinutesLogged: number
}

function formatTrackedTime(minutes: number): string {
  if (minutes === 0) return '0m'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

const SCORE_COLORS = {
  green: {
    stroke: '#22c55e',
    text: 'text-green-500',
    glow: '#22c55e',
    bg: 'from-green-500/5 to-green-500/0',
  },
  orange: {
    stroke: '#f59e0b',
    text: 'text-amber-500',
    glow: '#f59e0b',
    bg: 'from-amber-500/5 to-amber-500/0',
  },
  red: {
    stroke: '#ef4444',
    text: 'text-red-500',
    glow: '#ef4444',
    bg: 'from-red-500/5 to-red-500/0',
  },
}

function ScoreRing({
  score,
  color,
  size = 140,
  strokeWidth = 8,
}: {
  score: number
  color: 'green' | 'orange' | 'red'
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2
  const clampedScore = Math.max(0, Math.min(100, score))
  const offset = circumference - (clampedScore / 100) * circumference
  const colors = SCORE_COLORS[color]

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-zinc-200/30 dark:text-zinc-700/40"
        />
        {/* Score arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 8px ${colors.glow}50)` }}
        />
      </svg>

      {/* Center score */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold tabular-nums ${colors.text}`}>
          {score}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
          Day Score
        </span>
      </div>
    </div>
  )
}

export default function DayScoreCircle({ className = '' }: { className?: string }) {
  const [data, setData] = useState<DaySummaryData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    async function fetchScore() {
      try {
        const res = await fetch(`/api/day-summary?date=${getUserToday()}`, { signal: controller.signal })
        if (res.ok) {
          const json = await res.json()
          setData({
            score: json.score,
            scoreColor: json.scoreColor,
            sessionsLogged: json.sessionsLogged,
            totalSessions: json.totalSessions,
            totalMinutesLogged: json.totalMinutesLogged,
          })
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        console.error('Failed to fetch day summary:', err)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    fetchScore()
    return () => controller.abort()
  }, [])

  if (isLoading) {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        <Skeleton className="h-36 w-36 rounded-full" />
        <Skeleton className="h-4 w-48" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <ScoreRing score={data.score} color={data.scoreColor} />

      {/* Summary line */}
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{data.sessionsLogged}/{data.totalSessions}</span>
        {' sessions logged'}
        <span className="mx-1.5 text-muted-foreground/40">·</span>
        <span className="font-medium text-foreground">{formatTrackedTime(data.totalMinutesLogged)}</span>
        {' tracked'}
      </p>
    </div>
  )
}
