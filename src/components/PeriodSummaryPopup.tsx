'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { TimePeriod, PERIOD_LABELS, TimeEntry, CATEGORY_LABELS, TimeCategory, PERIOD_TIME_RANGES, getUserToday, getRealToday } from '@/lib/types'
import { PERIOD_CLASSES } from '@/lib/palette'
import CommentaryThread from '@/components/CommentaryThread'
import { Sun, Cloud, Moon, Sparkles, ArrowRight, X, TrendingUp, Zap, Share2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { csrfFetch } from '@/lib/api'
import AnimatedCheckbox from '@/components/AnimatedCheckbox'

interface PreviousPeriodStats {
  totalMinutes: number
  productiveMinutes: number
  entryCount: number
}

interface PeriodSummaryPopupProps {
  isOpen: boolean
  onClose: () => void
  period: TimePeriod
  /** The session's date, YYYY-MM-DD — half of the follow-up thread's key. */
  date: string
  entries: TimeEntry[]
  commentary: string | null
  isLoading: boolean
  isEvening: boolean
  onViewDayReview?: () => void
  previousPeriodStats?: PreviousPeriodStats
}

const PERIOD_ICONS: Record<TimePeriod, typeof Sun> = {
  morning: Sun,
  afternoon: Cloud,
  evening: Moon,
}

const PERIOD_COLORS: Record<TimePeriod, { icon: string; border: string }> = {
  morning: { icon: PERIOD_CLASSES.morning.icon, border: PERIOD_CLASSES.morning.border },
  afternoon: { icon: PERIOD_CLASSES.afternoon.icon, border: PERIOD_CLASSES.afternoon.border },
  evening: { icon: PERIOD_CLASSES.evening.icon, border: PERIOD_CLASSES.evening.border },
}

export default function PeriodSummaryPopup({
  isOpen,
  onClose,
  period,
  date,
  entries,
  commentary,
  isLoading,
  isEvening,
  onViewDayReview,
  previousPeriodStats,
}: PeriodSummaryPopupProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const shareCardRef = useRef<HTMLDivElement>(null)

  // Task completion state
  interface TaskItem {
    id: string
    title: string
    completed: boolean
    sort_order: number
  }
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(new Set())
  const tasksFetchedRef = useRef(false)

  // Fetch today's uncompleted tasks when popup opens
  const fetchTasks = useCallback(async () => {
    try {
      const today = getUserToday()
      const res = await fetch(`/api/plans?date=${today}`)
      if (res.ok) {
        const { plans } = await res.json()
        // Show all tasks — uncompleted ones are interactive, completed ones are shown as done
        setTasks(plans || [])
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    }
  }, [])

  useEffect(() => {
    if (isOpen && !tasksFetchedRef.current) {
      tasksFetchedRef.current = true
      fetchTasks()
    }
    if (!isOpen) {
      tasksFetchedRef.current = false
    }
  }, [isOpen, fetchTasks])

  // Toggle task completion from the popup
  const handleToggleTask = async (taskId: string, currentCompleted: boolean) => {
    if (currentCompleted) {
      // Un-completing: instant
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: false } : t))
      try {
        await csrfFetch('/api/plans', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: taskId, completed: false }),
        })
      } catch { /* revert on error */ fetchTasks() }
    } else {
      // Completing: animate then update — tag with current session period
      setCompletingTaskIds(prev => new Set(prev).add(taskId))
      csrfFetch('/api/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, completed: true, completed_session: period }),
      }).catch(() => {})
      setTimeout(() => {
        setCompletingTaskIds(prev => {
          const next = new Set(prev)
          next.delete(taskId)
          return next
        })
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: true } : t))
      }, 1000)
    }
  }

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true))
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- animation state driven by prop changes
      setIsVisible(false)
      setIsLeaving(false)
    }
  }, [isOpen])

  const handleClose = () => {
    setIsLeaving(true)
    setTimeout(onClose, 300)
  }

  const handleShare = async () => {
    try {
      // Dynamically import html2canvas
      const html2canvas = (await import('html2canvas')).default

      // Prepare data for ShareableSessionCard
      const topCategories = sortedCategories.slice(0, 3).map(([cat, mins]) => ({
        category: cat as TimeCategory,
        minutes: mins,
      }))

      // Create the shareable card component
      const { default: ShareableSessionCard } = await import('./ShareableSessionCard')
      const { createRoot } = await import('react-dom/client')

      // Create a temporary container
      const container = document.createElement('div')
      container.style.position = 'fixed'
      container.style.left = '-9999px'
      container.style.top = '-9999px'
      document.body.appendChild(container)

      // Render the card and wait for element
      const root = createRoot(container)
      let cardElement: HTMLDivElement | null = null

      const elementPromise = new Promise<HTMLDivElement>((resolve) => {
        root.render(
          <ShareableSessionCard
            ref={(el) => {
              if (el) {
                cardElement = el
                resolve(el)
              }
            }}
            period={period}
            date={getRealToday()}
            totalMinutes={totalMinutes}
            topCategories={topCategories}
            commentary={commentary || `Great ${PERIOD_LABELS[period].toLowerCase()} session!`}
          />
        )
      })

      await elementPromise

      // Wait for rendering
      await new Promise((resolve) => setTimeout(resolve, 100))

      if (!cardElement) {
        throw new Error('Failed to render card')
      }

      // Capture the card
      const canvas = await html2canvas(cardElement, {
        backgroundColor: null,
        scale: 2,
        logging: false,
      })

      // Clean up
      root.unmount()
      document.body.removeChild(container)

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b)
          else reject(new Error('Failed to create blob'))
        }, 'image/png')
      })

      // Try Web Share API first
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], 'session-card.png', { type: 'image/png' })
        const shareData = {
          files: [file],
          title: `${PERIOD_LABELS[period]} Session`,
          text: `My ${PERIOD_LABELS[period].toLowerCase()} session — ${totalMinutes} minutes tracked`,
        }

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData)
          return
        }
      }

      // Fallback to download
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `session-${period}-${Date.now()}.png`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Share failed:', error)
    }
  }

  // Filter entries to only include those within this period's time range
  // Must be before early return to maintain hooks order
  const periodEntries = useMemo(() => {
    const range = PERIOD_TIME_RANGES[period]
    return entries.filter(entry => {
      if (!entry.start_time) return false
      const hour = parseInt(entry.start_time.split(':')[0])
      return hour >= range.start && hour < range.end
    })
  }, [entries, period])

  /**
   * There was a session score here, drawn as an unlabelled number in a ring.
   * It was: 50 × (minutes of deep_work/learning/exercise/creating ÷ total),
   * plus 6 per entry to a maximum of 30, plus a flat 20 awarded
   * unconditionally.
   *
   * So an evening of seeing a friend, eating, and a shower — the kind of
   * evening Body and Heart are built to reward — scored 44: nothing from the
   * first term, 24 for logging four things, 20 for free. A fourth scoring
   * system, disagreeing with the three it sat beside, with nothing on screen
   * to say what it measured. Removed rather than repaired.
   */

  // Find session MVP (activity with most time)
  const sessionMVP = useMemo(() => {
    if (periodEntries.length === 0) return null

    const sorted = [...periodEntries].sort((a, b) => b.duration_minutes - a.duration_minutes)
    return sorted[0]
  }, [periodEntries])

  // Calculate comparison with previous period
  const comparison = useMemo(() => {
    if (!previousPeriodStats) return null

    const currentTotal = periodEntries.reduce((sum, e) => sum + e.duration_minutes, 0)
    const currentProductive = periodEntries
      .filter(e => ['deep_work', 'learning', 'exercise', 'creating'].includes(e.category || ''))
      .reduce((sum, e) => sum + e.duration_minutes, 0)

    const diffMinutes = currentProductive - previousPeriodStats.productiveMinutes
    if (Math.abs(diffMinutes) < 15) return null // Too small to mention

    const isPositive = diffMinutes > 0
    const hours = Math.floor(Math.abs(diffMinutes) / 60)
    const minutes = Math.abs(diffMinutes) % 60
    const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`

    return {
      isPositive,
      text: `${isPositive ? '+' : '-'}${timeStr} productive time`,
    }
  }, [periodEntries, previousPeriodStats])

  if (!isOpen) return null

  const Icon = PERIOD_ICONS[period]
  const colors = PERIOD_COLORS[period]
  const periodLabel = PERIOD_LABELS[period]

  // Calculate stats from filtered entries
  const totalMinutes = periodEntries.reduce((sum, e) => sum + e.duration_minutes, 0)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  // Group by category
  const categoryBreakdown = periodEntries.reduce((acc, entry) => {
    const cat = entry.category || 'other'
    acc[cat] = (acc[cat] || 0) + entry.duration_minutes
    return acc
  }, {} as Record<string, number>)

  // Sort categories by time
  const sortedCategories = Object.entries(categoryBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3) // Top 3

  return (
    <>
      {/* Confetti animation styles */}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
            isVisible && !isLeaving ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={handleClose}
        />

        {/* Modal */}
        <div
          className={`relative w-full max-w-sm transform transition-all duration-300 ease-out ${
            isVisible && !isLeaving
              ? 'translate-y-0 opacity-100 scale-100'
              : 'translate-y-8 opacity-0 scale-95'
          }`}
        >
          {/* Was a 2px gradient frame — amber→orange, or indigo→purple→pink
              for the evening, which is the loudest thing in the app. */}
          <div className="relative overflow-hidden rounded-2xl border border-zinc-700 shadow-2xl max-h-[85vh]">
            <div className="relative rounded-2xl bg-zinc-900 p-6 overflow-y-auto max-h-[calc(85vh-4px)]">
              {/* Header buttons */}
              <div className="absolute right-4 top-4 flex items-center gap-2">
                <button
                  onClick={handleShare}
                  className="rounded-full p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                  title="Share session"
                >
                  <Share2 className="h-5 w-5" />
                </button>
                <button
                  onClick={handleClose}
                  className="rounded-full p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 ${colors.border} border`}>
                <Icon className={`h-6 w-6 ${colors.icon}`} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white">{periodLabel} Complete</h2>
                <p className="text-sm text-zinc-400">
                  {periodEntries.length} {periodEntries.length === 1 ? 'activity' : 'activities'} logged
                </p>
              </div>
            </div>

            {/* Comparison line */}
            {comparison && (
              <div className="mb-4 flex items-center gap-2 text-sm">
                <TrendingUp className={`h-4 w-4 ${comparison.isPositive ? 'text-[#9BB5A6]' : 'text-[#C79089]'}`} />
                <span className={comparison.isPositive ? 'text-[#9BB5A6]' : 'text-[#C79089]'}>
                  vs last {periodLabel.toLowerCase()}: {comparison.text}
                </span>
              </div>
            )}

            {/* Time summary with MVP */}
            <div className="mb-4 rounded-xl bg-zinc-800/50 p-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">
                  {hours > 0 && `${hours}h `}{minutes}m
                </p>
                <p className="text-sm text-zinc-400">total time tracked</p>
              </div>

              {/* Session MVP */}
              {sessionMVP && (
                <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-zinc-700/30 px-3 py-2">
                  <Zap className="h-4 w-4 text-[#CBB894]" />
                  <div className="flex-1 text-center">
                    <p className="field-label">Session MVP</p>
                    <p className="text-sm font-medium text-white truncate">{sessionMVP.activity}</p>
                    <p className="text-xs text-zinc-400">
                      {Math.floor(sessionMVP.duration_minutes / 60) > 0
                        ? `${Math.floor(sessionMVP.duration_minutes / 60)}h `
                        : ''}
                      {sessionMVP.duration_minutes % 60}m
                    </p>
                  </div>
                </div>
              )}

              {/* Category breakdown */}
              {sortedCategories.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {sortedCategories.map(([cat, mins]) => (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1 rounded-full bg-zinc-700/50 px-2.5 py-1 text-xs text-zinc-300"
                    >
                      {CATEGORY_LABELS[cat as TimeCategory]}
                      <span className="text-zinc-500">
                        {Math.floor(mins / 60) > 0 ? `${Math.floor(mins / 60)}h` : ''}{mins % 60 > 0 ? `${mins % 60}m` : ''}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* AI Commentary */}
            <div className="mb-5 rounded-xl bg-zinc-800/30 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-zinc-500 mt-0.5 shrink-0" />
                {isLoading ? (
                  <div className="flex-1">
                    <div className="h-4 bg-zinc-700 rounded animate-pulse mb-2 w-full" />
                    <div className="h-4 bg-zinc-700 rounded animate-pulse w-3/4" />
                  </div>
                ) : (
                  <div className="flex-1">
                    <p className="text-sm text-zinc-300 leading-relaxed italic">
                      &ldquo;{commentary || `Great ${periodLabel.toLowerCase()}! You stayed on track.`}&rdquo;
                    </p>
                    <CommentaryThread
                      subjectType="session"
                      subjectKey={`${date}:${period}`}
                      commentary={commentary}
                      tone="dark"
                    />
                  </div>
                )}
              </div>

            </div>

            {/* Task completion prompt */}
            {tasks.length > 0 && (() => {
              const incompleteTasks = tasks.filter(t => !t.completed && !completingTaskIds.has(t.id))
              const completedCount = tasks.filter(t => t.completed || completingTaskIds.has(t.id)).length
              const allDone = incompleteTasks.length === 0 && completedCount > 0

              return (
                <div className="mb-5 rounded-xl bg-zinc-800/30 p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-zinc-500" />
                      <p className="field-label">
                        Complete any tasks?
                      </p>
                    </div>
                    {completedCount > 0 && (
                      <span className="text-[11px] text-[#7D9B8A] font-medium">
                        {completedCount}/{tasks.length}
                      </span>
                    )}
                  </div>

                  {/* All done celebration */}
                  {allDone && (
                    <div className="flex items-center justify-center gap-2 py-2 mb-3 rounded-lg bg-[#7D9B8A]/10 border border-[#7D9B8A]/20">
                      <Sparkles className="h-4 w-4 text-[#7D9B8A]" />
                      <span className="text-sm font-medium text-[#7D9B8A]">All tasks done!</span>
                    </div>
                  )}

                  {/* Task list */}
                  <div className="space-y-2.5">
                    {/* Incomplete tasks first */}
                    {incompleteTasks.map((task, i) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 hover:bg-zinc-700/20 transition-colors"
                      >
                        <AnimatedCheckbox
                          completed={false}
                          onToggle={() => handleToggleTask(task.id, false)}
                        />
                        <span className="text-sm flex-1 text-zinc-200">
                          {task.title}
                        </span>
                        {i === 0 && incompleteTasks[0]?.sort_order === 0 && (
                          <span className="text-[10px] text-[#CBB894]/70 font-medium">#1</span>
                        )}
                      </div>
                    ))}

                    {/* Currently animating */}
                    {tasks.filter(t => completingTaskIds.has(t.id)).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 transition-all duration-700 opacity-40 scale-[0.97] translate-x-1"
                      >
                        <AnimatedCheckbox
                          completed={true}
                          onToggle={() => {}}
                        />
                        <span className="text-sm flex-1 text-[#9BB5A6] transition-all duration-500">
                          {task.title}
                        </span>
                      </div>
                    ))}

                    {/* Completed tasks */}
                    {tasks.filter(t => t.completed && !completingTaskIds.has(t.id)).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 opacity-50 hover:opacity-70 transition-all"
                      >
                        <AnimatedCheckbox
                          completed={true}
                          onToggle={() => handleToggleTask(task.id, true)}
                        />
                        <span className="text-sm flex-1 text-zinc-500 line-through">
                          {task.title}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  {tasks.length > 1 && (
                    <div className="mt-3 h-1.5 rounded-full bg-zinc-700/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          allDone ? 'bg-[#7D9B8A]' : completedCount > 0 ? 'bg-[#7D9B8A]/70' : 'bg-zinc-600'
                        }`}
                        style={{ width: `${(completedCount / tasks.length) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Actions */}
            {isEvening && onViewDayReview ? (
              <div className="space-y-3">
                <Button
                  onClick={() => {
                    handleClose()
                    setTimeout(onViewDayReview, 300)
                  }}
                  className="w-full"
                >
                  <Sparkles className="h-4 w-4" />
                  Your Day in Review is ready
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <button
                  onClick={handleClose}
                  className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Maybe later
                </button>
              </div>
            ) : (
              <Button
                onClick={handleClose}
                variant="outline"
                className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Continue
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Hidden ShareableSessionCard for capture - will be added later */}
      <div ref={shareCardRef} className="fixed -left-[9999px] -top-[9999px]" />
    </div>
    </>
  )
}
