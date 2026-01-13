'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TimeEntry, getLocalDateString } from '@/lib/types'
import { formatHours } from '@/lib/time-utils'

interface Streaks {
  deepWork: number
  exercise: number
  noDistraction: number
}

interface WeeklyStats {
  deepWorkMinutes: number
  exerciseMinutes: number
}

function getDateDaysAgo(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return getLocalDateString(date)
}

function calculateStreaks(entriesByDate: Map<string, TimeEntry[]>): Streaks {
  let deepWorkStreak = 0
  let exerciseStreak = 0
  let noDistractionStreak = 0

  // Check consecutive days starting from yesterday
  // (today is still in progress, so we start from yesterday)
  for (let daysAgo = 1; daysAgo <= 365; daysAgo++) {
    const dateStr = getDateDaysAgo(daysAgo)
    const dayEntries = entriesByDate.get(dateStr) || []

    // Deep work: 2+ hours (120+ minutes)
    const deepWorkMinutes = dayEntries
      .filter(e => e.category === 'deep_work')
      .reduce((sum, e) => sum + e.duration_minutes, 0)

    if (deepWorkMinutes >= 120) {
      if (daysAgo === 1 || deepWorkStreak === daysAgo - 1) {
        deepWorkStreak = daysAgo
      }
    }

    // Exercise: any entry
    const hasExercise = dayEntries.some(e => e.category === 'exercise')
    if (hasExercise) {
      if (daysAgo === 1 || exerciseStreak === daysAgo - 1) {
        exerciseStreak = daysAgo
      }
    }

    // No distraction: zero distraction entries
    const hasDistraction = dayEntries.some(e => e.category === 'distraction')
    if (!hasDistraction && dayEntries.length > 0) {
      // Only count days that have entries (active days)
      if (daysAgo === 1 || noDistractionStreak === daysAgo - 1) {
        noDistractionStreak = daysAgo
      }
    } else if (hasDistraction) {
      // Streak broken, stop counting
      if (noDistractionStreak > 0) break
    }
  }

  return {
    deepWork: deepWorkStreak,
    exercise: exerciseStreak,
    noDistraction: noDistractionStreak,
  }
}

function getWeekStart(): string {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - dayOfWeek)
  startOfWeek.setHours(0, 0, 0, 0)
  return getLocalDateString(startOfWeek)
}

interface StatsCardProps {
  userId: string
}

export default function StatsCard({ userId }: StatsCardProps) {
  const [streaks, setStreaks] = useState<Streaks>({ deepWork: 0, exercise: 0, noDistraction: 0 })
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({ deepWorkMinutes: 0, exerciseMinutes: 0 })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      if (!userId) return
      setIsLoading(true)

      // Fetch entries from the last 60 days for streak calculation
      const sixtyDaysAgo = getDateDaysAgo(60)
      const today = getLocalDateString()

      const { data: entries } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('date', sixtyDaysAgo)
        .lte('date', today)

      if (entries) {
        // Group entries by date
        const entriesByDate = new Map<string, TimeEntry[]>()
        entries.forEach((entry: TimeEntry) => {
          const existing = entriesByDate.get(entry.date) || []
          entriesByDate.set(entry.date, [...existing, entry])
        })

        // Calculate streaks
        setStreaks(calculateStreaks(entriesByDate))

        // Calculate weekly stats
        const weekStart = getWeekStart()
        const weekEntries = entries.filter((e: TimeEntry) => e.date >= weekStart)

        const deepWorkMinutes = weekEntries
          .filter((e: TimeEntry) => e.category === 'deep_work')
          .reduce((sum: number, e: TimeEntry) => sum + e.duration_minutes, 0)

        const exerciseMinutes = weekEntries
          .filter((e: TimeEntry) => e.category === 'exercise')
          .reduce((sum: number, e: TimeEntry) => sum + e.duration_minutes, 0)

        setWeeklyStats({ deepWorkMinutes, exerciseMinutes })
      }

      setIsLoading(false)
    }

    fetchStats()
  }, [userId])

  if (isLoading) {
    return (
      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center justify-center py-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600"></div>
        </div>
      </div>
    )
  }

  const activeStreaks = [
    { name: 'Deep Work', days: streaks.deepWork, emoji: '💻' },
    { name: 'Exercise', days: streaks.exercise, emoji: '💪' },
    { name: 'Focus', days: streaks.noDistraction, emoji: '🎯' },
  ].filter(s => s.days >= 2)

  const hasStreaks = activeStreaks.length > 0
  const hasWeeklyActivity = weeklyStats.deepWorkMinutes > 0 || weeklyStats.exerciseMinutes > 0

  return (
    <div className="mb-6 rounded-xl border border-zinc-200 bg-gradient-to-br from-orange-50 to-amber-50 p-4 shadow-sm dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Streaks Section */}
        <div className="flex-1">
          {hasStreaks ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-lg">🔥</span>
              {activeStreaks.map((streak, i) => (
                <div
                  key={streak.name}
                  className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-sm dark:bg-zinc-700/50"
                >
                  <span>{streak.emoji}</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {streak.days}d
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {streak.name}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              ✨ Start a streak today! Log 2+ hrs deep work or exercise daily.
            </p>
          )}
        </div>

        {/* Weekly Stats Section */}
        {hasWeeklyActivity && (
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-zinc-500 dark:text-zinc-500">This week:</span>
            {weeklyStats.deepWorkMinutes > 0 && (
              <span className="rounded bg-purple-100 px-2 py-0.5 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                💻 {formatHours(weeklyStats.deepWorkMinutes)}
              </span>
            )}
            {weeklyStats.exerciseMinutes > 0 && (
              <span className="rounded bg-orange-100 px-2 py-0.5 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                💪 {formatHours(weeklyStats.exerciseMinutes)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
