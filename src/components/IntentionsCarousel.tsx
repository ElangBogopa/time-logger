'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  TimeEntry,
  getLocalDateString,
  getUserToday,
  UserIntention,
  INTENTION_LABELS,
  INTENTION_CATEGORY_MAP,
  calculateStreakWithGrace,
  STREAK_CONFIGS,
  calculateDailyTarget,
  IntentionType,
  StreakType,
} from '@/lib/types'
import { Flame, Target, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface IntentionProgress {
  intention: UserIntention
  currentWeekMinutes: number
  targetMinutes: number
  progressPercent: number
  streakDays: number
  isOnTrack: boolean
}

// Map intention type to streak type for calculations
const INTENTION_TO_STREAK_MAP: Partial<Record<IntentionType, StreakType>> = {
  deep_work: 'deep_work',
  exercise: 'exercise',
  less_distraction: 'focus',
  learning: 'learning',
  relationships: 'relationships',
}

function getDateDaysAgo(daysAgo: number): string {
  // Use user's today as reference (accounts for late-night rollover)
  const userToday = getUserToday()
  const date = new Date(userToday + 'T12:00:00')
  date.setDate(date.getDate() - daysAgo)
  return getLocalDateString(date)
}

function getWeekStartDate(): string {
  // Use user's today as reference (accounts for late-night rollover)
  const userToday = getUserToday()
  const todayDate = new Date(userToday + 'T12:00:00')
  const dayOfWeek = todayDate.getDay()
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Monday = start
  todayDate.setDate(todayDate.getDate() - diff)
  return getLocalDateString(todayDate)
}

interface IntentionsCarouselProps {
  userId: string
}

export default function IntentionsCarousel({ userId }: IntentionsCarouselProps) {
  const [progress, setProgress] = useState<IntentionProgress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)

  const fetchProgress = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)

    try {
      const sixtyDaysAgo = getDateDaysAgo(60)
      const weekStart = getWeekStartDate()
      const today = getLocalDateString()

      const [entriesResult, intentionsResult] = await Promise.all([
        supabase
          .from('time_entries')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'confirmed')
          .gte('date', sixtyDaysAgo)
          .lte('date', today),
        supabase
          .from('user_intentions')
          .select('*')
          .eq('user_id', userId)
          .eq('active', true)
          .order('priority'),
      ])

      const entries = (entriesResult.data || []) as TimeEntry[]
      const intentions = (intentionsResult.data || []) as UserIntention[]

      if (intentions.length === 0) {
        setProgress([])
        setIsLoading(false)
        return
      }

      // Group entries by date
      const entriesByDate = new Map<string, TimeEntry[]>()
      entries.forEach(e => {
        const existing = entriesByDate.get(e.date) || []
        entriesByDate.set(e.date, [...existing, e])
      })

      // Calculate progress for each intention
      const progressData: IntentionProgress[] = intentions.map(intention => {
        const categories = INTENTION_CATEGORY_MAP[intention.intention_type] || []
        const targetMinutes = intention.weekly_target_minutes || 0
        const dailyTarget = calculateDailyTarget(targetMinutes)

        // Calculate this week's minutes
        let currentWeekMinutes = 0
        entries.forEach(entry => {
          if (entry.date >= weekStart && categories.includes(entry.category as never)) {
            currentWeekMinutes += entry.duration_minutes
          }
        })

        // Calculate streak
        let streakDays = 0
        const streakType = INTENTION_TO_STREAK_MAP[intention.intention_type]
        if (streakType && STREAK_CONFIGS[streakType]) {
          const config = STREAK_CONFIGS[streakType]
          const calculation = calculateStreakWithGrace(
            entriesByDate,
            config,
            0, // No existing PB for carousel
            dailyTarget || undefined
          )
          streakDays = calculation.currentStreak
        }

        const progressPercent = targetMinutes > 0
          ? Math.min(100, Math.round((currentWeekMinutes / targetMinutes) * 100))
          : 0

        // On track if progress percent matches or exceeds day-of-week expectation
        const dayOfWeek = new Date().getDay()
        const daysIntWeek = dayOfWeek === 0 ? 7 : dayOfWeek
        const expectedPercent = (daysIntWeek / 7) * 100
        const isOnTrack = progressPercent >= expectedPercent * 0.8 // 80% of expected

        return {
          intention,
          currentWeekMinutes,
          targetMinutes,
          progressPercent,
          streakDays,
          isOnTrack,
        }
      })

      setProgress(progressData)
    } catch (error) {
      console.error('Failed to fetch intentions progress:', error)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchProgress()
  }, [fetchProgress])

  const handlePrev = () => {
    setActiveIndex(prev => (prev > 0 ? prev - 1 : progress.length - 1))
  }

  const handleNext = () => {
    setActiveIndex(prev => (prev < progress.length - 1 ? prev + 1 : 0))
  }

  if (isLoading) {
    return (
      <div className="mb-6">
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    )
  }

  if (progress.length === 0) {
    return null // No intentions set up
  }

  const current = progress[activeIndex]

  return (
    <div className="mb-6">
      {/* Carousel container */}
      <div className="relative">
        {/* Navigation arrows */}
        {progress.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 p-1 rounded-full bg-background border border-zinc-200 dark:border-zinc-700 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
              aria-label="Previous intention"
            >
              <ChevronLeft className="h-4 w-4 text-zinc-500" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 p-1 rounded-full bg-background border border-zinc-200 dark:border-zinc-700 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
              aria-label="Next intention"
            >
              <ChevronRight className="h-4 w-4 text-zinc-500" />
            </button>
          </>
        )}

        {/* Card */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">
                {INTENTION_LABELS[current.intention.intention_type]}
              </span>
            </div>
            {current.streakDays > 0 && (
              <div className="flex items-center gap-1 text-orange-500">
                <Flame className="h-4 w-4" />
                <span className="text-sm font-medium">{current.streakDays} day streak</span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-2">
            <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  current.isOnTrack
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500'
                }`}
                style={{ width: `${current.progressPercent}%` }}
              />
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {formatMinutes(current.currentWeekMinutes)} / {formatMinutes(current.targetMinutes)} this week
            </span>
            <span className={`font-medium ${current.isOnTrack ? 'text-green-600' : 'text-amber-600'}`}>
              {current.progressPercent}%
            </span>
          </div>
        </div>

        {/* Dot indicators */}
        {progress.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {progress.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  idx === activeIndex
                    ? 'w-4 bg-primary'
                    : 'w-1.5 bg-zinc-300 dark:bg-zinc-700'
                }`}
                aria-label={`Go to intention ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}
