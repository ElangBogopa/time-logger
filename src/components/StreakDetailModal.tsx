'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  StreakCalculation,
  StreakConfig,
  StreakType,
  getLocalDateString,
} from '@/lib/types'
import { Flame, Trophy, Target, Calendar } from 'lucide-react'

interface StreakDisplay extends StreakCalculation {
  type: StreakType
  config: StreakConfig
  customDescription?: string
  dailyTargetMinutes?: number
}

interface StreakDetailModalProps {
  streak: StreakDisplay
  onClose: () => void
}

// Get day names for the week
function getWeekDays(): { date: string; dayName: string; isToday: boolean }[] {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - dayOfWeek)

  const days = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    days.push({
      date: getLocalDateString(date),
      dayName: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][i],
      isToday: getLocalDateString(date) === getLocalDateString(today),
    })
  }
  return days
}

export default function StreakDetailModal({ streak, onClose }: StreakDetailModalProps) {
  const weekDays = getWeekDays()
  const { weeklyConsistency } = streak

  // Calculate which days were hits vs misses
  // This is a simplification - in reality we'd need the actual day data
  const todayIndex = new Date().getDay()
  const activeDays = weeklyConsistency.totalDays
  const hitDays = weeklyConsistency.daysHit

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{streak.config.emoji}</span>
            {streak.config.label} Streak
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Main streak number */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-3">
              <Flame className="h-10 w-10 text-orange-500" />
              <span className="text-5xl font-bold text-zinc-900 dark:text-zinc-100">
                {streak.currentStreak}
              </span>
            </div>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {streak.currentStreak === 1 ? 'day' : 'days'} in a row
            </p>
          </div>

          {/* Stats row */}
          <div className="flex justify-center gap-8">
            {/* Personal Best */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-amber-600 dark:text-amber-400">
                <Trophy className="h-4 w-4" />
                <span className="text-lg font-semibold">{streak.personalBest}</span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Personal Best</p>
            </div>

            {/* Next Milestone */}
            {streak.nextMilestone && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <Target className="h-4 w-4" />
                  <span className="text-lg font-semibold">{streak.nextMilestone}</span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {streak.nextMilestone - streak.currentStreak} to go
                </p>
              </div>
            )}
          </div>

          {/* Weekly calendar */}
          <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <Calendar className="h-4 w-4" />
              This Week
            </div>
            <div className="flex justify-between">
              {weekDays.map((day, i) => {
                const isFuture = i > todayIndex
                const isActive = i < activeDays
                // Simplified: assume hits are consecutive from start of week
                const isHit = i < hitDays && !isFuture

                return (
                  <div key={day.date} className="flex flex-col items-center gap-1.5">
                    <span className={`text-xs font-medium ${
                      day.isToday
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-zinc-500 dark:text-zinc-400'
                    }`}>
                      {day.dayName}
                    </span>
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        isFuture
                          ? 'bg-zinc-200 dark:bg-zinc-700'
                          : isHit
                            ? 'bg-emerald-500 text-white'
                            : isActive
                              ? 'bg-zinc-300 dark:bg-zinc-600'
                              : 'bg-zinc-200 dark:bg-zinc-700'
                      } ${day.isToday ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-zinc-900' : ''}`}
                    >
                      {!isFuture && isHit && (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 text-center text-sm text-zinc-600 dark:text-zinc-400">
              {weeklyConsistency.daysHit}/{weeklyConsistency.totalDays} days this week
              {weeklyConsistency.isPerfect && activeDays >= 3 && (
                <span className="ml-2 text-emerald-600 dark:text-emerald-400">Perfect!</span>
              )}
            </div>
          </div>

          {/* Rest days */}
          {streak.graceDaysRemaining > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20">
              <p className="text-center text-sm text-emerald-700 dark:text-emerald-300">
                <span className="font-medium">{streak.graceDaysRemaining}</span> rest {streak.graceDaysRemaining === 1 ? 'day' : 'days'} remaining this week
              </p>
              <p className="mt-1 text-center text-xs text-emerald-600 dark:text-emerald-400">
                Take a break without losing your streak
              </p>
            </div>
          )}

          {/* Streak description */}
          <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
            {streak.customDescription || streak.config.description}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
