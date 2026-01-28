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

/* ── Types ── */
interface TargetProgress {
  target: WeeklyTarget
  actualMinutes: number
  weeklyMinutes: number
  dailyTarget: number
  progress: number
}

interface DaySummaryData {
  score: number
  scoreColor: 'green' | 'orange' | 'red'
  sessionsLogged: number
  totalSessions: number
  totalMinutesLogged: number
}

interface DashboardHeroProps {
  userId: string
}

/* ── Helpers ── */
function getWeekStartDate(): string {
  const userToday = getUserToday()
  const todayDate = new Date(userToday + 'T12:00:00')
  const dayOfWeek = todayDate.getDay()
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  todayDate.setDate(todayDate.getDate() - diff)
  return getLocalDateString(todayDate)
}

function formatTrackedTime(minutes: number): string {
  if (minutes === 0) return '0m'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h${mins}m`
}

function formatMinutesCompact(minutes: number, unit: 'hours' | 'minutes'): string {
  if (unit === 'minutes') return `${minutes}m`
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours}h`
  return `${hours}h${mins}m`
}

function formatDailyTarget(minutes: number, unit: 'hours' | 'minutes'): string {
  if (unit === 'minutes') return `${minutes}m`
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours}h`
  return `${hours}h${mins}m`
}

const SCORE_COLORS = {
  green: { stroke: '#22c55e', text: 'text-green-500', glow: '#22c55e' },
  orange: { stroke: '#f59e0b', text: 'text-amber-500', glow: '#f59e0b' },
  red: { stroke: '#ef4444', text: 'text-red-500', glow: '#ef4444' },
}

/* ── Compact Metric Circle ── */
function MetricCircle({
  value,
  label,
  progress,
  strokeColor,
  textColorClass,
  size = 90,
  strokeWidth = 6,
  sublabel,
}: {
  value: string
  label: string
  progress: number
  strokeColor: string
  textColorClass?: string
  size?: number
  strokeWidth?: number
  sublabel?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, progress))
  const offset = circumference - (clamped / 100) * circumference
  const center = size / 2

  return (
    <div className="flex flex-col items-center">
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
          {/* Progress arc */}
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
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 6px ${strokeColor}40)` }}
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-xl font-bold tabular-nums ${textColorClass || 'text-foreground'}`}>
            {value}
          </span>
        </div>
      </div>
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1.5">
        {label} {sublabel ? '›' : ''}
      </span>
    </div>
  )
}

/* ── Main Component ── */
export default function DashboardHero({ userId }: DashboardHeroProps) {
  const [targetProgress, setTargetProgress] = useState<TargetProgress[]>([])
  const [dayData, setDayData] = useState<DaySummaryData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [celebration, setCelebration] = useState<{ label: string; icon: string } | null>(null)
  const prevProgressRef = useRef<Map<string, number>>(new Map())

  const fetchAll = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)

    try {
      const weekStart = getWeekStartDate()
      const today = getLocalDateString()

      const [entries, targets, dayRes] = await Promise.all([
        fetchEntries({ status: 'confirmed', dateFrom: weekStart, dateTo: today }),
        fetchWeeklyTargets(),
        fetch('/api/day-summary').then(r => r.ok ? r.json() : null),
      ])

      // Day summary
      if (dayRes) {
        setDayData({
          score: dayRes.score,
          scoreColor: dayRes.scoreColor,
          sessionsLogged: dayRes.sessionsLogged,
          totalSessions: dayRes.totalSessions,
          totalMinutesLogged: dayRes.totalMinutesLogged,
        })
      }

      // Target progress
      if (targets.length > 0) {
        const progressData: TargetProgress[] = targets.map(target => {
          const config = WEEKLY_TARGET_CONFIGS[target.target_type as WeeklyTargetType]
          if (!config) {
            return { target, actualMinutes: 0, weeklyMinutes: 0, dailyTarget: 0, progress: 0 }
          }

          const weeklyMinutes = entries
            .filter(e => config.categories.includes(e.category as never))
            .reduce((sum, e) => sum + e.duration_minutes, 0)

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

        const newMap = new Map<string, number>()
        for (const tp of progressData) {
          newMap.set(tp.target.id, tp.progress)
        }
        prevProgressRef.current = newMap

        setTargetProgress(progressData)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  if (isLoading) {
    return (
      <div className="mb-4">
        <div className="flex justify-center gap-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-[90px] w-[90px] rounded-full" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const rings = targetProgress.slice(0, 5)
  const goalsHit = rings.filter(r => r.progress >= 100).length
  const goalsTotal = rings.length
  const goalsProgress = goalsTotal > 0 ? (goalsHit / goalsTotal) * 100 : 0

  const scoreColor = dayData?.scoreColor || 'orange'
  const colors = SCORE_COLORS[scoreColor]

  // Tracked time: percentage of 16 waking hours
  const trackedMins = dayData?.totalMinutesLogged || 0
  const trackedProgress = Math.min((trackedMins / (16 * 60)) * 100, 100)

  return (
    <div className="mb-4">
      {/* Celebration overlay */}
      <RingCelebration
        celebration={celebration}
        onDone={() => setCelebration(null)}
      />

      {/* === Three Metric Circles - Whoop style === */}
      <div className="flex justify-center items-start gap-5 mb-3">
        {/* Goals */}
        <MetricCircle
          value={goalsTotal > 0 ? `${goalsHit}/${goalsTotal}` : '—'}
          label="Goals"
          progress={goalsProgress}
          strokeColor="#6366f1"
          textColorClass="text-indigo-500 dark:text-indigo-400"
        />

        {/* Day Score — slightly larger as the hero metric */}
        <MetricCircle
          value={dayData ? `${dayData.score}` : '—'}
          label="Score"
          progress={dayData?.score || 0}
          strokeColor={colors.stroke}
          textColorClass={colors.text}
          size={100}
          strokeWidth={7}
        />

        {/* Time Tracked */}
        <MetricCircle
          value={formatTrackedTime(trackedMins)}
          label="Tracked"
          progress={trackedProgress}
          strokeColor="#06b6d4"
          textColorClass="text-cyan-500 dark:text-cyan-400"
        />
      </div>

      {/* Summary line */}
      <p className="text-center text-xs text-muted-foreground mb-3">
        <span className="font-medium text-foreground">{dayData?.sessionsLogged || 0}/{dayData?.totalSessions || 0}</span>
        {' sessions logged'}
      </p>

      {/* Compact goal category pills */}
      {rings.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {rings.map(tp => {
            const config = WEEKLY_TARGET_CONFIGS[tp.target.target_type as WeeklyTargetType]
            if (!config) return null

            const isComplete = tp.progress >= 100
            const directionSymbol = tp.target.direction === 'at_least' ? '↑' : '↓'

            return (
              <div
                key={tp.target.id}
                className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium transition-all ${
                  isComplete
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400 ring-1 ring-green-500/20'
                    : 'bg-zinc-100 dark:bg-zinc-800/80 text-muted-foreground'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: config.ringColor }}
                />
                <span>{config.icon}</span>
                <span className="whitespace-nowrap">
                  {isComplete ? (
                    <>{config.label} ✓</>
                  ) : (
                    <>
                      {formatMinutesCompact(tp.actualMinutes, config.unit)}
                      <span className="opacity-50"> / </span>
                      {formatDailyTarget(tp.dailyTarget, config.unit)}
                      <span className="ml-0.5 opacity-40">{directionSymbol}</span>
                    </>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
