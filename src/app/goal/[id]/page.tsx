'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Loader2, Star, Plus, X, Flame, CalendarCheck, TrendingUp, Check, HelpCircle, Clock } from 'lucide-react'
import { csrfFetch } from '@/lib/api'
import { getUserToday } from '@/lib/types'
import CommitTimeModal from '@/components/CommitTimeModal'

interface Goal {
  id: string
  title: string
  description: string | null
}

interface PlanItem {
  id: string
  goal_id: string | null
  date: string
  title: string
  completed: boolean
  sort_order: number
  committed_start: string | null
  committed_end: string | null
}

interface DailyScore {
  date: string
  score: number
  maxPossible: number
  earnedPoints: number
  totalTasks: number
  completedTasks: number
  priorityCompleted: boolean
  tasks: { title: string; completed: boolean; weight: number; slot: number }[]
  label: string
  hasPlans: boolean
}

interface WeeklyStats {
  average: number
  plannedDays: number
  totalDays: number
  perfectDays: number
  priorityCompletionRate: number
}

interface StreakData {
  planning: { current: number; best: number; label: string }
  execution: { current: number; best: number; label: string }
}

export default function GoalPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const goalId = params.id as string

  const [goal, setGoal] = useState<Goal | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Tomorrow's date
  const today = getUserToday()
  const tomorrow = (() => {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })()

  // Task inputs
  const [tasks, setTasks] = useState<string[]>(['', '', ''])
  const [existingPlans, setExistingPlans] = useState<PlanItem[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showCoachCard, setShowCoachCard] = useState(false)
  const [commitModalIdx, setCommitModalIdx] = useState<number | null>(null)

  // Check if user has seen the coach card before
  useEffect(() => {
    const seen = localStorage.getItem('better_coach_tasks_vs_cal')
    if (!seen) setShowCoachCard(true)
  }, [])

  const dismissCoachCard = () => {
    setShowCoachCard(false)
    localStorage.setItem('better_coach_tasks_vs_cal', '1')
  }

  const toggleCoachCard = () => setShowCoachCard(prev => !prev)

  // Stats
  const [todayScore, setTodayScore] = useState<DailyScore | null>(null)
  const [weeklyScores, setWeeklyScores] = useState<DailyScore[]>([])
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null)
  const [streaks, setStreaks] = useState<StreakData | null>(null)

  const hasExistingPlans = existingPlans.length > 0

  const fetchData = useCallback(async () => {
    try {
      const [goalsRes, plansRes, todayScoreRes, weeklyRes, streaksRes] = await Promise.all([
        fetch('/api/goals'),
        fetch(`/api/plans?date=${tomorrow}`),
        fetch(`/api/productivity-score?date=${today}`),
        fetch(`/api/productivity-score?date=${today}&period=7d`),
        fetch('/api/streaks-productivity'),
      ])

      if (goalsRes.ok) {
        const { goals } = await goalsRes.json()
        setGoal(goals.find((g: Goal) => g.id === goalId) || null)
      }

      if (plansRes.ok) {
        const { plans } = await plansRes.json()
        setExistingPlans(plans || [])
        if (plans && plans.length > 0) {
          const filled = plans.map((p: PlanItem) => p.title)
          // Ensure at least 3 slots
          while (filled.length < 3) filled.push('')
          setTasks(filled)
          setSaved(true)
        }
      }

      if (todayScoreRes.ok) {
        const data = await todayScoreRes.json()
        setTodayScore(data)
      }

      if (weeklyRes.ok) {
        const data = await weeklyRes.json()
        setWeeklyScores(data.daily || [])
        setWeeklyStats(data.weekly || null)
      }

      if (streaksRes.ok) {
        const data = await streaksRes.json()
        setStreaks(data)
      }
    } catch (err) {
      console.error('Failed to fetch goal data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [goalId, tomorrow, today])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') fetchData()
  }, [status, router, fetchData])

  const handleSave = async () => {
    const nonEmpty = tasks.filter(t => t.trim())
    if (nonEmpty.length === 0) return
    setIsSaving(true)
    try {
      if (hasExistingPlans) {
        await Promise.all(existingPlans.map(p => csrfFetch(`/api/plans?id=${p.id}`, { method: 'DELETE' })))
      }
      for (let i = 0; i < tasks.length; i++) {
        const title = tasks[i].trim()
        if (!title) continue
        await csrfFetch('/api/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: tomorrow, title, goal_id: goalId }),
        })
      }
      setSaved(true)
      const plansRes = await fetch(`/api/plans?date=${tomorrow}`)
      if (plansRes.ok) {
        const { plans } = await plansRes.json()
        setExistingPlans(plans || [])
      }
    } catch (err) {
      console.error('Failed to save plans:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTaskChange = (index: number, value: string) => {
    const updated = [...tasks]
    updated[index] = value
    setTasks(updated)
    if (saved) setSaved(false)
  }

  const clearTask = (index: number) => {
    if (index >= 3 && tasks.length > 3) {
      // Remove extra slots entirely
      const updated = tasks.filter((_, i) => i !== index)
      setTasks(updated)
      if (saved) setSaved(false)
    } else {
      handleTaskChange(index, '')
    }
  }

  const handleCommitTime = async (index: number, start: string, end: string) => {
    const plan = existingPlans[index]
    if (!plan) return
    await csrfFetch('/api/plans', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: plan.id, committed_start: start, committed_end: end }),
    })
    // Re-fetch plans to get updated data
    const plansRes = await fetch(`/api/plans?date=${tomorrow}`)
    if (plansRes.ok) {
      const { plans } = await plansRes.json()
      setExistingPlans(plans || [])
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!goal) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <button onClick={() => router.push('/')} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <p className="text-muted-foreground">Goal not found.</p>
        </div>
      </div>
    )
  }

  const tomorrowDate = new Date(tomorrow + 'T12:00:00')
  const tomorrowLabel = tomorrowDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const hasContent = tasks.some(t => t.trim())

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Header */}
        <header className="mb-6">
          <button onClick={() => router.push('/')} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="text-2xl font-bold text-foreground">{goal.title}</h1>
          {goal.description && <p className="mt-1 text-sm text-muted-foreground">{goal.description}</p>}
        </header>

        {/* Tomorrow's Tasks */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tasks for tomorrow
            </h2>
            <button
              onClick={toggleCoachCard}
              className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              aria-label="What goes here?"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Coach Card */}
          {showCoachCard && (
            <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-foreground">Tasks vs Calendar — what goes where?</p>
                <button
                  onClick={dismissCoachCard}
                  className="text-muted-foreground/40 hover:text-muted-foreground shrink-0 ml-2"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2.5">
                <div className="flex gap-2.5">
                  <span className="text-lg leading-none mt-0.5">✅</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">Tasks</p>
                    <p className="text-xs text-muted-foreground">Things you want to accomplish — on your terms.</p>
                    <p className="text-xs text-muted-foreground/60 italic mt-0.5">"Study 2 hours", "Code a feature", "Hit the gym"</p>
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <span className="text-lg leading-none mt-0.5">📅</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">Calendar</p>
                    <p className="text-xs text-muted-foreground">Things with a set time — the world expects you there.</p>
                    <p className="text-xs text-muted-foreground/60 italic mt-0.5">"Class at 9am", "Meeting at 2pm", "Doctor at 4pm"</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-background/60 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Rule of thumb:</span> If someone else is expecting you at a specific time → calendar. If it's your call when to do it → task.
                </p>
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground/70 mb-4">
            {tomorrowLabel} — What will you get done?
          </p>

          <div className="space-y-3">
            {tasks.map((task, idx) => {
              const icon = idx === 0
                ? <Star className="h-4 w-4 text-primary fill-primary" />
                : <Plus className="h-4 w-4 text-muted-foreground/30" />
              const placeholder = idx === 0 ? 'Most important task'
                : idx < 3 ? 'Another task (optional)'
                : `Task ${idx + 1} (bonus)`
              const plan = existingPlans[idx]
              const isCommitted = plan?.committed_start && plan?.committed_end
              return (
                <div key={idx}>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</div>
                    <input
                      type="text"
                      value={task}
                      onChange={e => handleTaskChange(idx, e.target.value)}
                      placeholder={placeholder}
                      className={`w-full rounded-xl border bg-card pl-10 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all ${
                        isCommitted ? 'border-[#8B7E74]/30 pr-24' : 'border-border pr-12'
                      }`}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-3">
                      {/* Commit button — only show when task is saved */}
                      {saved && plan && task.trim() && (
                        <button
                          onClick={() => setCommitModalIdx(idx)}
                          className={`rounded-lg p-1.5 transition-colors ${
                            isCommitted
                              ? 'text-[#8B7E74] hover:bg-[#8B7E74]/10'
                              : 'text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-secondary/50'
                          }`}
                          title={isCommitted ? `${plan.committed_start?.slice(0,5)} – ${plan.committed_end?.slice(0,5)}` : 'Commit to a time'}
                        >
                          <Clock className="h-5 w-5" />
                        </button>
                      )}
                      {task && (
                        <button onClick={() => clearTask(idx)} className="rounded-lg p-1 text-muted-foreground/40 hover:text-muted-foreground">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Committed time badge */}
                  {isCommitted && (
                    <div className="mt-1 ml-10 flex items-center gap-1">
                      <span className="text-[10px] text-[#8B7E74] font-medium">
                        {plan.committed_start?.slice(0,5)} – {plan.committed_end?.slice(0,5)}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Add task button */}
            <button
              onClick={() => { setTasks([...tasks, '']); if (saved) setSaved(false) }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground/50 hover:text-muted-foreground hover:border-muted-foreground/30 transition-all"
            >
              <Plus className="h-4 w-4" />
              Add another task
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={!hasContent || isSaving || saved}
            className={`mt-4 w-full rounded-xl py-3 text-sm font-medium transition-all ${
              saved ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                : hasContent ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-secondary text-muted-foreground cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Saving...</span>
            ) : saved ? '✓ Tasks saved' : hasExistingPlans ? 'Update tasks' : 'Set tasks for tomorrow'}
          </button>
        </section>

        {/* ═══ STATS SECTION ═══ */}

        {/* Today's Score */}
        {todayScore?.hasPlans && (
          <section className="mb-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Today
            </h2>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-3xl font-bold text-foreground">{todayScore.score}%</span>
                  <p className="text-sm text-muted-foreground mt-0.5">{todayScore.label}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {todayScore.completedTasks}/{todayScore.totalTasks} tasks
                </div>
              </div>

              {/* Task breakdown */}
              <div className="space-y-1.5">
                {todayScore.tasks.map((task, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      task.completed ? 'border-green-500 bg-green-500' : 'border-zinc-300 dark:border-zinc-600'
                    }`}>
                      {task.completed && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className={`text-sm flex-1 ${task.completed ? 'line-through text-muted-foreground/50' : 'text-foreground'}`}>
                      {task.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground/40">
                      {task.weight}pts
                    </span>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    todayScore.score >= 80 ? 'bg-green-500' : todayScore.score >= 50 ? 'bg-amber-500' : 'bg-red-400'
                  }`}
                  style={{ width: `${todayScore.score}%` }}
                />
              </div>
            </div>
          </section>
        )}

        {/* This Week */}
        {weeklyStats && weeklyStats.plannedDays > 0 && (
          <section className="mb-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              This week
            </h2>
            <div className="rounded-xl border border-border bg-card p-4">
              {/* Summary stats row */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-3xl font-bold text-foreground">{weeklyStats.average}%</span>
                  <p className="text-sm text-muted-foreground mt-0.5">Weekly average</p>
                </div>
                <div className="text-right space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    {weeklyStats.priorityCompletionRate}% priority done
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Star className="h-3 w-3" />
                    {weeklyStats.perfectDays} perfect day{weeklyStats.perfectDays !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* 7-day dots */}
              <div className="flex items-end justify-between gap-1">
                {weeklyScores.map((day) => {
                  const dayLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })
                  const isToday = day.date === today
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                      {/* Bar */}
                      <div className="w-full h-16 rounded-md bg-secondary/50 relative overflow-hidden">
                        {day.hasPlans && (
                          <div
                            className={`absolute bottom-0 w-full rounded-md transition-all duration-500 ${
                              day.score >= 80 ? 'bg-green-500/80' : day.score >= 50 ? 'bg-amber-500/80' : day.score > 0 ? 'bg-red-400/80' : 'bg-zinc-400/30'
                            }`}
                            style={{ height: `${Math.max(day.score, 4)}%` }}
                          />
                        )}
                      </div>
                      <span className={`text-[10px] ${isToday ? 'text-primary font-bold' : 'text-muted-foreground/50'}`}>
                        {dayLabel}
                      </span>
                    </div>
                  )
                })}
              </div>

              <p className="mt-3 text-center text-[11px] text-muted-foreground/50">
                {weeklyStats.plannedDays} of 7 days planned
              </p>
            </div>
          </section>
        )}

        {/* Streaks */}
        {streaks && (
          <section className="mb-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Streaks
            </h2>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 flex items-center gap-2.5">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    streaks.planning.current > 0 ? 'bg-blue-500/15' : 'bg-secondary'
                  }`}>
                    <CalendarCheck className={`h-4 w-4 ${streaks.planning.current > 0 ? 'text-blue-500' : 'text-muted-foreground/50'}`} />
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-lg font-bold ${streaks.planning.current > 0 ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                        {streaks.planning.current}
                      </span>
                      <span className="text-[10px] text-muted-foreground">day{streaks.planning.current !== 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/70">Planning</p>
                  </div>
                </div>
                <div className="h-10 w-px bg-border" />
                <div className="flex-1 flex items-center gap-2.5">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    streaks.execution.current > 0 ? 'bg-orange-500/15' : 'bg-secondary'
                  }`}>
                    <Flame className={`h-4 w-4 ${streaks.execution.current > 0 ? 'text-orange-500' : 'text-muted-foreground/50'}`} />
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-lg font-bold ${streaks.execution.current > 0 ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                        {streaks.execution.current}
                      </span>
                      <span className="text-[10px] text-muted-foreground">day{streaks.execution.current !== 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/70">Follow-through</p>
                  </div>
                </div>
              </div>
              {(streaks.planning.best > 0 || streaks.execution.best > 0) && (
                <p className="mt-2.5 text-[11px] text-center text-muted-foreground/50 border-t border-border pt-2.5">
                  Best: {streaks.planning.best} day{streaks.planning.best !== 1 ? 's' : ''} planning · {streaks.execution.best} day{streaks.execution.best !== 1 ? 's' : ''} follow-through
                </p>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Commit Time Modal */}
      {commitModalIdx !== null && existingPlans[commitModalIdx] && (
        <CommitTimeModal
          isOpen={true}
          onClose={() => setCommitModalIdx(null)}
          onCommit={(start, end) => handleCommitTime(commitModalIdx, start, end)}
          taskTitle={existingPlans[commitModalIdx].title}
          date={tomorrow}
          existingStart={existingPlans[commitModalIdx].committed_start}
          existingEnd={existingPlans[commitModalIdx].committed_end}
        />
      )}
    </div>
  )
}
