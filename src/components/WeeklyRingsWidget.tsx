'use client'

import { useEffect, useState, useCallback } from 'react'
import { fetchEntries, fetchWeeklyTargets } from '@/lib/api'
import {
  WeeklyTarget,
  WEEKLY_TARGET_CONFIGS,
  calculateTargetProgress,
  formatTargetValue,
  getLocalDateString,
  getUserToday,
  TimeEntry,
  WeeklyTargetType,
} from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface TargetProgress {
  target: WeeklyTarget
  actualMinutes: number
  progress: number // 0-100
}

interface WeeklyRingsWidgetProps {
  userId: string
}

function getWeekStartDate(): string {
  const userToday = getUserToday()
  const todayDate = new Date(userToday + 'T12:00:00')
  const dayOfWeek = todayDate.getDay()
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Monday = start
  todayDate.setDate(todayDate.getDate() - diff)
  return getLocalDateString(todayDate)
}

// SVG Ring component
function ProgressRing({
  progress,
  color,
  direction,
  size = 56,
  strokeWidth = 5,
}: {
  progress: number
  color: string
  direction: 'at_least' | 'at_most'
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  // For at_least: ring fills clockwise from top
  // For at_most: ring is full when under, depletes when over
  const clampedProgress = Math.max(0, Math.min(100, progress))
  const offset = circumference - (clampedProgress / 100) * circumference

  // Color logic for at_most targets: green when under, amber when near, red when over
  let strokeColor = color
  if (direction === 'at_most') {
    if (progress >= 100) {
      strokeColor = '#22c55e' // green — under limit is good
    } else if (progress >= 50) {
      strokeColor = '#f59e0b' // amber — getting close
    } else {
      strokeColor = '#ef4444' // red — over limit
    }
  }

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background track */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-zinc-100 dark:text-zinc-800"
      />
      {/* Progress ring */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
    </svg>
  )
}

function formatMinutesShort(minutes: number, unit: 'hours' | 'minutes'): string {
  if (unit === 'minutes') {
    return `${minutes}m`
  }
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours}h`
  return `${hours}h${mins}m`
}

export default function WeeklyRingsWidget({ userId }: WeeklyRingsWidgetProps) {
  const [targetProgress, setTargetProgress] = useState<TargetProgress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  // Collapsible state with localStorage persistence
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('weeklyRingsCollapsed') !== 'false'
  })

  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const next = !prev
      localStorage.setItem('weeklyRingsCollapsed', String(next))
      return next
    })
  }

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

      // Sum minutes per target's categories for this week
      const progressData: TargetProgress[] = targets.map(target => {
        const config = WEEKLY_TARGET_CONFIGS[target.target_type as WeeklyTargetType]
        if (!config) {
          return { target, actualMinutes: 0, progress: 0 }
        }

        const actualMinutes = entries
          .filter(e => config.categories.includes(e.category as never))
          .reduce((sum, e) => sum + e.duration_minutes, 0)

        const progress = calculateTargetProgress(
          actualMinutes,
          target.weekly_target_minutes,
          target.direction as 'at_least' | 'at_most'
        )

        return { target, actualMinutes, progress }
      })

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
      <div className="mb-6">
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    )
  }

  if (targetProgress.length === 0) {
    return null
  }

  // Compute summary line for collapsed state
  const onTrackCount = targetProgress.filter(tp => tp.progress >= 50).length
  const totalTargets = targetProgress.length

  return (
    <div className="mb-6">
      <div className="rounded-xl border border-border bg-card p-4">
        {/* Collapsible header */}
        <button
          onClick={toggleCollapsed}
          className="w-full flex items-center justify-between"
        >
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Weekly Targets
          </div>
          <div className="flex items-center gap-2">
            {isCollapsed && (
              <span className="text-xs text-muted-foreground">
                {onTrackCount}/{totalTargets} on track
              </span>
            )}
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Expanded content */}
        {!isCollapsed && (
          <>
            {/* Rings row */}
            <div className="flex justify-around items-start mt-3">
              {targetProgress.map((tp, idx) => {
                const config = WEEKLY_TARGET_CONFIGS[tp.target.target_type as WeeklyTargetType]
                if (!config) return null
                const isExpanded = expandedIndex === idx

                return (
                  <button
                    key={tp.target.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpandedIndex(isExpanded ? null : idx)
                    }}
                    className="flex flex-col items-center gap-1.5 min-w-0 flex-1"
                  >
                    {/* Ring with icon */}
                    <div className="relative">
                      <ProgressRing
                        progress={tp.progress}
                        color={config.ringColor}
                        direction={tp.target.direction as 'at_least' | 'at_most'}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-base">{config.icon}</span>
                      </div>
                    </div>

                    {/* Label */}
                    <span className="text-[10px] font-medium text-muted-foreground leading-tight text-center truncate w-full">
                      {config.label}
                    </span>

                    {/* Progress stat */}
                    <span className="text-[10px] text-muted-foreground leading-tight">
                      {formatMinutesShort(tp.actualMinutes, config.unit)}
                      {' / '}
                      {formatMinutesShort(tp.target.weekly_target_minutes, config.unit)}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Expanded detail */}
            {expandedIndex !== null && targetProgress[expandedIndex] && (() => {
              const tp = targetProgress[expandedIndex]
              const config = WEEKLY_TARGET_CONFIGS[tp.target.target_type as WeeklyTargetType]
              if (!config) return null

              const directionLabel = tp.target.direction === 'at_least' ? 'At least' : 'At most'

              return (
                <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{config.icon}</span>
                      <span className="font-medium text-sm">{config.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        tp.target.direction === 'at_least'
                          ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        {directionLabel}
                      </span>
                    </div>
                    <span className="font-semibold text-sm">{tp.progress}%</span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 rounded-full bg-secondary overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, tp.progress)}%`,
                        backgroundColor: config.ringColor,
                      }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{config.description}</span>
                    <span className="font-medium whitespace-nowrap ml-2">
                      {formatTargetValue(tp.actualMinutes, config.unit)} / {formatTargetValue(tp.target.weekly_target_minutes, config.unit)}
                    </span>
                  </div>
                </div>
              )
            })()}
          </>
        )}
      </div>
    </div>
  )
}
