'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Target, ChevronRight, Loader2, Flame, CalendarClock } from 'lucide-react'
import { getUserToday, shiftDateString } from '@/lib/types'
import { fetchGoals, type Goal } from '@/lib/goals'
import { STATUS_CLASSES } from '@/lib/palette'

interface StreakData {
  planning: { current: number; best: number; label: string }
  execution: { current: number; best: number; label: string }
}

interface YourPlanProps {
  date: string
  isToday: boolean
}

const CACHE_KEY = 'your-plan-cache'

function loadCache(): { goals: Goal[]; streaks: StreakData | null } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function saveCache(goals: Goal[], streaks: StreakData | null) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ goals, streaks }))
  } catch { /* ignore */ }
}

export default function YourPlan({ date, isToday }: YourPlanProps) {
  const router = useRouter()
  const cached = loadCache()
  const [goals, setGoals] = useState<Goal[]>(cached?.goals || [])
  const [streaks, setStreaks] = useState<StreakData | null>(cached?.streaks || null)
  const [isLoading, setIsLoading] = useState(!cached)

  const fetchData = useCallback(async () => {
    try {
      const [fetchedGoals, streaksRes] = await Promise.all([
        fetchGoals().catch(() => null),
        fetch(`/api/streaks-productivity?date=${getUserToday()}`),
      ])

      let newGoals = goals
      let newStreaks = streaks
      if (fetchedGoals) {
        newGoals = fetchedGoals
        setGoals(newGoals)
      }
      if (streaksRes.ok) {
        const data = await streaksRes.json()
        newStreaks = data
        setStreaks(newStreaks)
      }
      saveCache(newGoals, newStreaks)
    } catch (err) {
      console.error('Failed to fetch plan data:', err)
    } finally {
      setIsLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (isLoading) {
    return (
      <div className="mt-4">
        <h3 className="eyebrow mb-3">
          Your Plan
        </h3>
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    )
  }

  const productiveStreak = streaks?.execution.current ?? 0
  const crushingStreak = streaks?.planning.current ?? 0
  // Only show streaks at 3+ days — 1-2 days isn't a streak yet
  const showProductive = productiveStreak >= 3
  const showCrushing = crushingStreak >= 3
  const showStreaks = showProductive || showCrushing

  return (
    <div className="mt-6">
      {/* Nothing in the app pointed at the planner: you set a task inside a
          goal, gave it a time in a modal there, and it appeared on a
          calendar reachable only from Settings. */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="eyebrow">Goals</h3>
        <button
          onClick={() => router.push(`/calendar?date=${shiftDateString(getUserToday(), 1)}`)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <CalendarClock className="h-3.5 w-3.5" />
          Plan tomorrow
        </button>
      </div>

      {/* Streaks card — only visible when a real streak exists (3+ days) */}
      {showStreaks && (
        <div className="rounded-xl bg-card border border-border p-4 mb-3">
          <h4 className="eyebrow mb-3">Streaks</h4>
          <div className={`flex items-center ${showProductive && showCrushing ? 'gap-4' : ''}`}>
            {/* Productive Day streak — completed #1 task */}
            {showProductive && (
              <div className="flex-1 flex items-center gap-2.5">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full ${STATUS_CLASSES.green.iconBg}`}>
                  <Target className={`h-4 w-4 ${STATUS_CLASSES.green.icon}`} />
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-foreground">
                      {productiveStreak}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      days
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Productive
                  </p>
                </div>
              </div>
            )}

            {/* Divider — only when both streaks show */}
            {showProductive && showCrushing && (
              <div className="h-10 w-px bg-border" />
            )}

            {/* Crushing It streak — completed 3+ tasks */}
            {showCrushing && (
              <div className="flex-1 flex items-center gap-2.5">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full ${STATUS_CLASSES.yellow.iconBg}`}>
                  <Flame className={`h-4 w-4 ${STATUS_CLASSES.yellow.icon}`} />
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-foreground">
                      {crushingStreak}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      days
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Crushing It
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Goals, as plain rows. This was a titled card holding a row that
          was itself a card, with the icon in a tinted circle. */}
      {goals.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
          {goals.map(goal => (
            <button
              key={goal.id}
              onClick={() => router.push(`/goal/${goal.id}`)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-accent/40 active:bg-accent/60"
            >
              <Target className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{goal.title}</p>
                {goal.description && (
                  <p className="text-xs text-muted-foreground">{goal.description}</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
          No goals set yet
        </p>
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars

