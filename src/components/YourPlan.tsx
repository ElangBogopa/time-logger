'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Target, ChevronRight, Loader2, Flame, CalendarCheck } from 'lucide-react'
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

  const planningStreak = streaks?.planning.current ?? 0
  const executionStreak = streaks?.execution.current ?? 0
  const hasAnyStreak = planningStreak > 0 || executionStreak > 0

  return (
    <div className="mt-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Your Plan
      </h3>

      {/* Streaks card */}
      <div className="rounded-xl bg-card border border-border p-4 mb-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Streaks</h4>
        <div className="flex items-center gap-4">
          {/* Planning streak */}
          <div className="flex-1 flex items-center gap-2.5">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
              planningStreak > 0 ? 'bg-blue-500/15' : 'bg-secondary'
            }`}>
              <CalendarCheck className={`h-4 w-4 ${
                planningStreak > 0 ? 'text-blue-500' : 'text-muted-foreground/50'
              }`} />
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className={`text-lg font-bold ${
                  planningStreak > 0 ? 'text-foreground' : 'text-muted-foreground/40'
                }`}>
                  {planningStreak}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  day{planningStreak !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground/70">
                Planning
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-10 w-px bg-border" />

          {/* Execution streak */}
          <div className="flex-1 flex items-center gap-2.5">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
              executionStreak > 0 ? 'bg-orange-500/15' : 'bg-secondary'
            }`}>
              <Flame className={`h-4 w-4 ${
                executionStreak > 0 ? 'text-orange-500' : 'text-muted-foreground/50'
              }`} />
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className={`text-lg font-bold ${
                  executionStreak > 0 ? 'text-foreground' : 'text-muted-foreground/40'
                }`}>
                  {executionStreak}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  day{executionStreak !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground/70">
                Follow-through
              </p>
            </div>
          </div>
        </div>

        {/* Streak message */}
        {hasAnyStreak && (
          <p className="mt-2.5 text-[11px] text-center text-muted-foreground/60 border-t border-border pt-2.5">
            {getStreakMessage(planningStreak, executionStreak)}
          </p>
        )}
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

/**
 * Identity-framed streak messages (per research: identity > evaluative).
 * Encouraging, never punishing.
 */
function getStreakMessage(planning: number, execution: number): string {
  // Both streaks active
  if (planning >= 7 && execution >= 7) return "🔥 A full week of planning and doing. You're locked in."
  if (planning >= 3 && execution >= 3) return "Building momentum — plan it, do it, repeat."
  if (planning >= 7) return "A week of planning. Now keep following through."
  if (execution >= 7) return "7 days of getting the #1 thing done. That's consistency."
  if (planning >= 3 && execution >= 1) return "Planning streak growing. Keep doing what you plan."
  if (execution >= 3) return "Three days of follow-through. That's how habits start."
  if (planning >= 3) return "Three days planned in a row. Consistency is building."
  if (planning >= 1 && execution >= 1) return "Planned and delivered. Keep it going."
  if (planning >= 1) return "Day one of planning. Set up tomorrow to keep it going."
  if (execution >= 1) return "You did what you said you would. That matters."
  return ''
}
