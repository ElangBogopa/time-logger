'use client'

import { useState, useEffect, useCallback } from 'react'
import { TimePeriod, getUserToday } from '@/lib/types'
import { csrfFetch } from '@/lib/api'
import AnimatedCheckbox from '@/components/AnimatedCheckbox'
import { CheckCircle2, ChevronDown } from 'lucide-react'

interface TaskItem {
  id: string
  title: string
  completed: boolean
  completed_session: string | null
  sort_order: number
}

interface SessionTasksProps {
  period: TimePeriod
  date: string
}

/**
 * Task section for session log pages.
 * Shows today's planned tasks with checkboxes — the ONLY place tasks can be completed.
 * Each completion is tagged with the current session period.
 */
export default function SessionTasks({ period, date }: SessionTasksProps) {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set())
  const [showCompleted, setShowCompleted] = useState(false)

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/plans?date=${date}`)
      if (res.ok) {
        const { plans } = await res.json()
        setTasks(plans || [])
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    } finally {
      setIsLoading(false)
    }
  }, [date])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const handleToggle = async (taskId: string, currentCompleted: boolean) => {
    if (currentCompleted) {
      // Un-completing: instant
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: false, completed_session: null } : t))
      try {
        await csrfFetch('/api/plans', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: taskId, completed: false }),
        })
      } catch {
        fetchTasks()
      }
    } else {
      // Completing: animate then update
      setCompletingIds(prev => new Set(prev).add(taskId))
      csrfFetch('/api/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, completed: true, completed_session: period }),
      }).catch(() => {})

      setTimeout(() => {
        setCompletingIds(prev => {
          const next = new Set(prev)
          next.delete(taskId)
          return next
        })
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: true, completed_session: period } : t))
      }, 1000)
    }
  }

  // Don't render if no tasks planned
  if (isLoading || tasks.length === 0) return null

  const incompleteTasks = tasks.filter(t => !t.completed && !completingIds.has(t.id))
  const completedTasks = tasks.filter(t => t.completed || completingIds.has(t.id))
  const allDone = incompleteTasks.length === 0 && completedTasks.length > 0

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Today&apos;s Tasks
        </h2>
        {allDone && (
          <div className="flex items-center gap-1 text-green-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium">All done!</span>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="space-y-2">
          {/* Incomplete tasks */}
          {incompleteTasks.map((task) => (
            <div key={task.id} className="flex items-center gap-2.5">
              <AnimatedCheckbox
                completed={false}
                onToggle={() => handleToggle(task.id, false)}
              />
              <span className="text-sm flex-1 text-foreground">
                {task.title}
              </span>
            </div>
          ))}

          {/* Currently completing (animating) */}
          {tasks.filter(t => completingIds.has(t.id)).map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2.5 transition-all duration-500 opacity-40 scale-95"
            >
              <AnimatedCheckbox
                completed={true}
                onToggle={() => {}}
              />
              <span className="text-sm flex-1 text-green-500 line-through">
                {task.title}
              </span>
            </div>
          ))}

          {/* Completed tasks — collapsible */}
          {completedTasks.filter(t => !completingIds.has(t.id)).length > 0 && (
            <div className={`${incompleteTasks.length > 0 ? 'mt-2 pt-2 border-t border-border/50' : ''}`}>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="w-full text-[11px] text-green-500/70 font-medium flex items-center gap-1.5 hover:text-green-500 transition-colors"
              >
                <CheckCircle2 className="h-3 w-3" />
                {completedTasks.filter(t => !completingIds.has(t.id)).length} completed
                <ChevronDown className={`h-3 w-3 ml-auto transition-transform duration-200 ${showCompleted ? 'rotate-180' : ''}`} />
              </button>
              {showCompleted && (
                <div className="mt-2 space-y-2">
                  {completedTasks.filter(t => !completingIds.has(t.id)).map((task) => (
                    <div key={task.id} className="flex items-center gap-2.5 opacity-60">
                      <AnimatedCheckbox
                        completed={true}
                        onToggle={() => handleToggle(task.id, true)}
                      />
                      <span className="text-sm flex-1 text-muted-foreground line-through">
                        {task.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
