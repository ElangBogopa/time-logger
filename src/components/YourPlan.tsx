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

export default function YourPlan({ date, isToday }: YourPlanProps) {
  const router = useRouter()
  const [goals, setGoals] = useState<Goal[]>([])
  const [streaks, setStreaks] = useState<StreakData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [goalsRes, streaksRes] = await Promise.all([
        fetch('/api/goals'),
        fetch(`/api/streaks-productivity?date=${getUserToday()}`),
      ])

      if (goalsRes.ok) {
        const data = await goalsRes.json()
        setGoals(data.goals || [])
      }
      if (streaksRes.ok) {
        const data = await streaksRes.json()
        setStreaks(data)
      }
    } catch (err) {
      console.error('Failed to fetch plan data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

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

  const executionStreak = streaks?.execution.current ?? 0

  return (
    <div className="mt-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Your Plan
      </h3>

      {/* Streak card */}
      <div className="rounded-xl bg-card border border-border p-4 mb-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
            executionStreak > 0 ? 'bg-orange-500/15' : 'bg-secondary'
          }`}>
            <Flame className={`h-5 w-5 ${
              executionStreak > 0 ? 'text-orange-500' : 'text-muted-foreground/50'
            }`} />
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl font-bold ${
                executionStreak > 0 ? 'text-foreground' : 'text-muted-foreground/40'
              }`}>
                {executionStreak}
              </span>
              <span className="text-xs text-muted-foreground">
                day{executionStreak !== 1 ? 's' : ''} streak
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground/70">
              {executionStreak === 0
                ? 'Complete your #1 task to start a streak'
                : executionStreak < 3
                  ? 'Keep completing your top task daily'
                  : executionStreak < 7
                    ? 'Building momentum 💪'
                    : 'On fire 🔥'}
            </p>
          </div>
        </div>
      </div>

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

