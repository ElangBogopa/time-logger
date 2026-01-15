'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  TimeEntry,
  getLocalDateString,
  StreakType,
  StreakCalculation,
  STREAK_CONFIGS,
  calculateStreakWithGrace,
  calculateDailyTarget,
  formatMinutesForStreak,
  UserStreak,
  UserIntention,
  INTENTION_CATEGORY_MAP,
  StreakConfig,
  IntentionType,
} from '@/lib/types'
import { Flame, ChevronRight, Sparkles } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import StreakDetailModal from './StreakDetailModal'
import StreakCelebrationModal from './StreakCelebrationModal'

interface StreakDisplay extends StreakCalculation {
  type: StreakType
  config: StreakConfig
  customDescription?: string // Dynamic description based on intention
  dailyTargetMinutes?: number // From intention's weekly target
}

function getDateDaysAgo(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return getLocalDateString(date)
}

// Map intention type to streak type
const INTENTION_TO_STREAK_MAP: Partial<Record<IntentionType, StreakType>> = {
  deep_work: 'deep_work',
  exercise: 'exercise',
  less_distraction: 'focus',
  learning: 'learning',
  relationships: 'relationships',
}

// Map intentions to streak types with their weekly targets
interface StreakTypeWithTarget {
  type: StreakType
  weeklyTargetMinutes: number | null
  intentionType: IntentionType | null
}

function getStreakTypesFromIntentions(intentions: UserIntention[]): StreakTypeWithTarget[] {
  const streakMap = new Map<StreakType, StreakTypeWithTarget>()

  intentions.forEach(intention => {
    const streakType = INTENTION_TO_STREAK_MAP[intention.intention_type]
    if (streakType) {
      // Use the intention's weekly target
      streakMap.set(streakType, {
        type: streakType,
        weeklyTargetMinutes: intention.weekly_target_minutes,
        intentionType: intention.intention_type,
      })
    }
  })

  // Add defaults if no intentions set
  if (streakMap.size === 0) {
    streakMap.set('deep_work', { type: 'deep_work', weeklyTargetMinutes: null, intentionType: null })
    streakMap.set('exercise', { type: 'exercise', weeklyTargetMinutes: null, intentionType: null })
    streakMap.set('focus', { type: 'focus', weeklyTargetMinutes: null, intentionType: null })
  }

  return Array.from(streakMap.values())
}

interface StatsCardProps {
  userId: string
}

// localStorage key for tracking shown celebrations
const CELEBRATIONS_STORAGE_KEY = 'streak_celebrations_shown'

function getShownCelebrations(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const stored = localStorage.getItem(CELEBRATIONS_STORAGE_KEY)
    return stored ? new Set(JSON.parse(stored)) : new Set()
  } catch {
    return new Set()
  }
}

function markCelebrationShown(key: string): void {
  if (typeof window === 'undefined') return
  try {
    const shown = getShownCelebrations()
    shown.add(key)
    localStorage.setItem(CELEBRATIONS_STORAGE_KEY, JSON.stringify([...shown]))
  } catch {
    // Ignore localStorage errors
  }
}

export default function StatsCard({ userId }: StatsCardProps) {
  const [streaks, setStreaks] = useState<StreakDisplay[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedStreak, setSelectedStreak] = useState<StreakDisplay | null>(null)
  const [celebration, setCelebration] = useState<{
    type: 'milestone' | 'personal_best'
    streak: StreakDisplay
    previousBest?: number
  } | null>(null)

  const fetchStats = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)

    try {
      const sixtyDaysAgo = getDateDaysAgo(60)
      const today = getLocalDateString()

      const [entriesResult, intentionsResult, streakRecordsResult] = await Promise.all([
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
          .eq('active', true),
        supabase
          .from('user_streaks')
          .select('*')
          .eq('user_id', userId),
      ])

      const entries = (entriesResult.data || []) as TimeEntry[]
      const intentions = (intentionsResult.data || []) as UserIntention[]
      const existingStreaks = (streakRecordsResult.data || []) as UserStreak[]

      // Build personal bests map
      const pbMap = new Map<StreakType, number>()
      existingStreaks.forEach(s => {
        pbMap.set(s.streak_type as StreakType, s.personal_best_days)
      })

      // Group entries by date
      const entriesByDate = new Map<string, TimeEntry[]>()
      entries.forEach((entry: TimeEntry) => {
        const existing = entriesByDate.get(entry.date) || []
        entriesByDate.set(entry.date, [...existing, entry])
      })

      // Get streak types based on intentions (with their targets)
      const streakTypesWithTargets = getStreakTypesFromIntentions(intentions)

      // Calculate all streaks with intention-based thresholds
      const calculatedStreaks: StreakDisplay[] = streakTypesWithTargets
        .filter(({ type }) => type && STREAK_CONFIGS[type]) // Filter out invalid types
        .map(({ type, weeklyTargetMinutes }) => {
          const config = STREAK_CONFIGS[type]
          const existingPB = pbMap.get(type) || 0

          // Calculate daily target from weekly intention (if set)
          const dailyTarget = calculateDailyTarget(weeklyTargetMinutes)

          // Pass custom threshold to streak calculation
          const calculation = calculateStreakWithGrace(entriesByDate, config, existingPB, dailyTarget ?? undefined)

          // Create custom description based on target
          let customDescription = config.description
          if (dailyTarget) {
            customDescription = `Days with ${formatMinutesForStreak(dailyTarget)} ${config.label.toLowerCase()}`
          }

          return {
            ...calculation,
            type,
            config,
            customDescription,
            dailyTargetMinutes: dailyTarget ?? undefined,
          }
        })

      // Update personal bests in database and trigger celebrations
      const shownCelebrations = getShownCelebrations()

      for (const streak of calculatedStreaks) {
        const celebrationKey = `${streak.type}-${streak.currentStreak}`

        if (streak.isNewPersonalBest && streak.currentStreak >= 3) {
          await supabase
            .from('user_streaks')
            .upsert({
              user_id: userId,
              streak_type: streak.type,
              personal_best_days: streak.personalBest,
              personal_best_achieved_at: new Date().toISOString(),
              current_streak_days: streak.currentStreak,
              current_streak_start_date: streak.streakStartDate,
              last_calculated_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id,streak_type',
            })

          // Show celebration for new PB (only once ever)
          if (!shownCelebrations.has(celebrationKey)) {
            const prevPB = pbMap.get(streak.type) || 0
            setCelebration({
              type: 'personal_best',
              streak,
              previousBest: prevPB > 0 ? prevPB : undefined,
            })
            markCelebrationShown(celebrationKey)
          }
        } else if (
          streak.recentMilestone &&
          streak.currentStreak === streak.recentMilestone &&
          !shownCelebrations.has(celebrationKey)
        ) {
          // Show milestone celebration
          setCelebration({ type: 'milestone', streak })
          markCelebrationShown(celebrationKey)
        }
      }

      // Filter to active streaks (2+ days or notable PB)
      const activeStreaks = calculatedStreaks
        .filter(s => s.currentStreak >= 2 || s.personalBest >= 7)
        .sort((a, b) => b.currentStreak - a.currentStreak)

      setStreaks(activeStreaks)
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  if (isLoading) {
    return (
      <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="hidden sm:flex items-center gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-2 w-2 rounded-sm" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // No streaks to show
  if (streaks.length === 0) {
    return (
      <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/50">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
            <Sparkles className="h-6 w-6 text-orange-500 dark:text-orange-400" />
          </div>
          <div>
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              Build your first streak
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Log activities consistently to start tracking streaks
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Get the top streak to feature
  const topStreak = streaks[0]
  const otherStreaks = streaks.slice(1)

  return (
    <>
      <div className="mb-4 space-y-2">
        {/* Main featured streak - tappable */}
        <button
          onClick={() => setSelectedStreak(topStreak)}
          className="w-full rounded-xl border border-zinc-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.99] dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-800"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {topStreak.currentStreak}
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    day streak
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                  <span>{topStreak.config.emoji}</span>
                  <span>{topStreak.config.label}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Weekly progress mini bar */}
              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: 7 }).map((_, i) => {
                  const { weeklyConsistency } = topStreak
                  const isHit = i < weeklyConsistency.daysHit
                  const isFuture = i >= weeklyConsistency.totalDays
                  return (
                    <div
                      key={i}
                      className={`h-2 w-2 rounded-sm ${
                        isFuture
                          ? 'bg-zinc-200 dark:bg-zinc-600'
                          : isHit
                            ? 'bg-emerald-500'
                            : 'bg-zinc-300 dark:bg-zinc-500'
                      }`}
                    />
                  )
                })}
              </div>
              <ChevronRight className="h-5 w-5 text-zinc-400" />
            </div>
          </div>
        </button>

        {/* Other streaks - compact row */}
        {otherStreaks.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {otherStreaks.map(streak => (
              <button
                key={streak.type}
                onClick={() => setSelectedStreak(streak)}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm transition-all hover:shadow-md active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-800"
              >
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {streak.currentStreak}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {streak.config.emoji} {streak.config.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedStreak && (
        <StreakDetailModal
          streak={selectedStreak}
          onClose={() => setSelectedStreak(null)}
        />
      )}

      {/* Celebration modal */}
      {celebration && (
        <StreakCelebrationModal
          type={celebration.type}
          streakType={celebration.streak.type}
          config={celebration.streak.config}
          days={celebration.streak.currentStreak}
          previousBest={celebration.previousBest}
          onClose={() => setCelebration(null)}
        />
      )}
    </>
  )
}
