'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { fetchEntries, fetchWeeklyTargets } from '@/lib/api'
import {
  WeeklyTarget,
  WEEKLY_TARGET_CONFIGS,
  calculateTargetProgress,
  getLocalDateString,
  getUserToday,
  WeeklyTargetType,
} from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'
import RingCelebration from '@/components/RingCelebration'

interface TargetProgress {
  target: WeeklyTarget
  actualMinutes: number
  weeklyMinutes: number
  dailyTarget: number
  progress: number // 0-100
}

interface HeroRingsWidgetProps {
  userId: string
}

function getWeekStartDate(): string {
  const userToday = getUserToday()
  const todayDate = new Date(userToday + 'T12:00:00')
  const dayOfWeek = todayDate.getDay()
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  todayDate.setDate(todayDate.getDate() - diff)
  return getLocalDateString(todayDate)
}

function formatMinutesCompact(minutes: number, unit: 'hours' | 'minutes'): string {
  if (unit === 'minutes') return `${minutes}m`
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function formatDailyTarget(minutes: number, unit: 'hours' | 'minutes'): string {
  if (unit === 'minutes') return `${minutes}m`
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours}h`
  return `${hours}h${mins}m`
}

// Concentric ring - Apple Fitness style
function ConcentricRing({
  progress,
  color,
  radius,
  strokeWidth,
  size,
}: {
  progress: number
  color: string
  radius: number
  strokeWidth: number
  size: number
}) {
  const circumference = 2 * Math.PI * radius
  const clampedProgress = Math.max(0, Math.min(100, progress))
  const offset = circumference - (clampedProgress / 100) * circumference
  const center = size / 2

  return (
    <>
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
      {/* Progress ring */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
        style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
      />
      {/* Glow cap at end of progress */}
      {clampedProgress > 2 && (
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 12px ${color}80)`, opacity: 0.5 }}
        />
      )}
    </>
  )
}

export default function HeroRingsWidget({ userId }: HeroRingsWidgetProps) {
  const [targetProgress, setTargetProgress] = useState<TargetProgress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [celebration, setCelebration] = useState<{ label: string; icon: string } | null>(null)
  const prevProgressRef = useRef<Map<string, number>>(new Map())

  const fetchProgress = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)

    try {
      const weekStart = getWeekStartDate()
      const today = getLocalDateString()

      const [entries, targets] = await Promise.all([
        fetchEntries({ status: 'confirmed', dateFrom: weekStart, dateTo: today }),
        fetchWeeklyTargets(),
      ])

      if (targets.length === 0) {
        setTargetProgress([])
        setIsLoading(false)
        return
      }

      const progressData: TargetProgress[] = targets.map(target => {
        const config = WEEKLY_TARGET_CONFIGS[target.target_type as WeeklyTargetType]
        if (!config) {
          return { target, actualMinutes: 0, weeklyMinutes: 0, dailyTarget: 0, progress: 0 }
        }

        const weeklyMinutes = entries
          .filter(e => config.categories.includes(e.category as never))
          .reduce((sum, e) => sum + e.duration_minutes, 0)

        // Today's entries only
        const todayEntries = entries.filter(e => e.date === today)
        const actualMinutes = todayEntries
          .filter(e => config.categories.includes(e.category as never))
          .reduce((sum, e) => sum + e.duration_minutes, 0)

        const dailyTarget = Math.round(target.weekly_target_minutes / 7)

        const progress = calculateTargetProgress(
          actualMinutes,
          dailyTarget,
          target.direction as 'at_least' | 'at_most'
        )

        return { target, actualMinutes, weeklyMinutes, dailyTarget, progress }
      })

      // Check for ring close celebration
      const prevMap = prevProgressRef.current
      for (const tp of progressData) {
        const prevProgress = prevMap.get(tp.target.id)
        if (prevProgress !== undefined && prevProgress < 100 && tp.progress >= 100) {
          const config = WEEKLY_TARGET_CONFIGS[tp.target.target_type as WeeklyTargetType]
          if (config) {
            setCelebration({ label: config.label, icon: config.icon })
          }
        }
      }

      // Update previous progress
      const newMap = new Map<string, number>()
      for (const tp of progressData) {
        newMap.set(tp.target.id, tp.progress)
      }
      prevProgressRef.current = newMap

      setTargetProgress(progressData)
    } catch (error) {
      console.error('Failed to fetch target progress:', error)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchProgress()
  }, [fetchProgress])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-4 mb-6">
        <Skeleton className="h-52 w-52 rounded-full" />
        <div className="flex gap-4">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className="h-16 w-20 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (targetProgress.length === 0) {
    return null
  }

  // Ring layout: concentric rings from outside in
  const size = 220
  const strokeWidth = 14
  const gap = 4
  const rings = targetProgress.slice(0, 5) // Max 5 rings

  return (
    <div className="flex flex-col items-center mb-6">
      {/* Celebration overlay */}
      <RingCelebration
        celebration={celebration}
        onDone={() => setCelebration(null)}
      />

      {/* Concentric rings - Apple Fitness style */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
          viewBox={`0 0 ${size} ${size}`}
        >
          {rings.map((tp, idx) => {
            const config = WEEKLY_TARGET_CONFIGS[tp.target.target_type as WeeklyTargetType]
            if (!config) return null

            const radius = (size - strokeWidth) / 2 - idx * (strokeWidth + gap)

            return (
              <ConcentricRing
                key={tp.target.id}
                progress={tp.progress}
                color={config.ringColor}
                radius={radius}
                strokeWidth={strokeWidth}
                size={size}
              />
            )
          })}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Today
          </span>
          <span className="text-2xl font-bold text-foreground">
            {rings.filter(r => r.progress >= 100).length}/{rings.length}
          </span>
          <span className="text-[10px] text-muted-foreground">goals hit</span>
        </div>
      </div>

      {/* Daily micro-targets below rings */}
      <div className="flex flex-wrap justify-center gap-3 mt-4 w-full max-w-sm">
        {rings.map(tp => {
          const config = WEEKLY_TARGET_CONFIGS[tp.target.target_type as WeeklyTargetType]
          if (!config) return null

          const isComplete = tp.progress >= 100
          const directionSymbol = tp.target.direction === 'at_least' ? '↑' : '↓'

          return (
            <div
              key={tp.target.id}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                isComplete
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400 ring-1 ring-green-500/20'
                  : 'bg-zinc-100 dark:bg-zinc-800/80 text-muted-foreground'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: config.ringColor }}
              />
              <span>{config.icon}</span>
              <span className="whitespace-nowrap">
                {isComplete ? (
                  <span className="flex items-center gap-1">
                    {config.label} ✓
                  </span>
                ) : (
                  <>
                    {formatMinutesCompact(tp.actualMinutes, config.unit)}
                    <span className="text-muted-foreground/60"> / </span>
                    {formatDailyTarget(tp.dailyTarget, config.unit)}
                    <span className="ml-0.5 opacity-50">{directionSymbol}</span>
                  </>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
