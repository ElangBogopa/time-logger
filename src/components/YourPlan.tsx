'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Target, ChevronRight, Loader2, Flame } from 'lucide-react'
import { getUserToday } from '@/lib/types'

interface Goal {
  id: string
  title: string
  description: string | null
  active: boolean
}

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
      const [goalsRes, streaksRes] = await Promise.all([
        fetch('/api/goals'),
        fetch(`/api/streaks-productivity?date=${getUserToday()}`),
      ])

      let newGoals = goals
      let newStreaks = streaks
      if (goalsRes.ok) {
        const data = await goalsRes.json()
        newGoals = data.goals || []
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
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
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
    <div className="mt-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Your Plan
      </h3>

      {/* Streaks card — only visible when a real streak exists (3+ days) */}
      {showStreaks && (
        <div className="rounded-xl bg-card border border-border p-4 mb-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Streaks</h4>
          <div className={`flex items-center ${showProductive && showCrushing ? 'gap-4' : ''}`}>
            {/* Productive Day streak — completed #1 task */}
            {showProductive && (
              <div className="flex-1 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500/15">
                  <Target className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-foreground">
                      {productiveStreak}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      days
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/70">
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
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/15">
                  <Flame className="h-4 w-4 text-orange-500" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-foreground">
                      {crushingStreak}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      days
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/70">
                    Crushing It
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Goal pills card */}
      {goals.length > 0 ? (
        <div className="rounded-xl bg-card border border-border p-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Goals</h4>
          <div className="space-y-2">
            {goals.map(goal => (
              <button
                key={goal.id}
                onClick={() => router.push(`/goal/${goal.id}`)}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-3 transition-all bg-secondary/50 border border-transparent hover:bg-accent/50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15">
                  <Target className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-foreground">
                    {goal.title}
                  </p>
                  {goal.description && (
                    <p className="text-[11px] text-muted-foreground">
                      {goal.description}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-card border border-border p-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Goals</h4>
          <p className="text-sm text-muted-foreground/60 text-center py-2">
            No goals set yet
          </p>
        </div>
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars

