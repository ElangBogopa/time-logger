'use client'

import { useState, useEffect } from 'react'
import { Calendar, ExternalLink, X, Trash2, CalendarX } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface CommitTimeModalProps {
  isOpen: boolean
  onClose: () => void
  onCommit: (start: string, end: string) => Promise<void>
  taskTitle: string
  date: string
  planId?: string
  existingStart?: string | null
  existingEnd?: string | null
  /** Take the time off the task and return it to the tray. */
  onUnschedule?: () => Promise<void>
  /** Remove the task from the day altogether. */
  onDelete?: () => Promise<void>
  /** The planner is the calendar: a link to it from itself goes nowhere. */
  hideCalendarLink?: boolean
  /** Where to start a task that has no time yet, instead of 9–10am for everything. */
  defaultStart?: string
  defaultEnd?: string
}

export default function CommitTimeModal({
  isOpen,
  onClose,
  onCommit,
  taskTitle,
  date,
  planId,
  existingStart,
  existingEnd,
  onUnschedule,
  onDelete,
  hideCalendarLink = false,
  defaultStart,
  defaultEnd,
}: CommitTimeModalProps) {
  const router = useRouter()
  const [startTime, setStartTime] = useState(defaultStart ?? '09:00')
  const [endTime, setEndTime] = useState(defaultEnd ?? '10:00')
  const [isSaving, setIsSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // A sheet with a drag handle and no other way out: Escape did nothing and
  // there was no close button, only the backdrop.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const run = async (action: () => Promise<void>) => {
    setIsSaving(true)
    try {
      await action()
      onClose()
    } catch (err) {
      console.error('Failed to update task:', err)
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    if (existingStart) setStartTime(existingStart.slice(0, 5))
    if (existingEnd) setEndTime(existingEnd.slice(0, 5))
  }, [existingStart, existingEnd])

  // Quick duration presets
  const presets = [
    { label: '30m', minutes: 30 },
    { label: '1h', minutes: 60 },
    { label: '1.5h', minutes: 90 },
    { label: '2h', minutes: 120 },
  ]

  const applyPreset = (minutes: number) => {
    const [h, m] = startTime.split(':').map(Number)
    const totalMinutes = h * 60 + m + minutes
    const endH = Math.floor(totalMinutes / 60) % 24
    const endM = totalMinutes % 60
    setEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`)
  }

  const handleCommit = async () => {
    setIsSaving(true)
    try {
      await onCommit(startTime, endTime)
      onClose()
    } catch (err) {
      console.error('Failed to commit time:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleViewCalendar = () => {
    onClose()
    const params = new URLSearchParams({ date, task: taskTitle })
    if (planId) params.set('planId', planId)
    router.push(`/calendar?${params.toString()}`)
  }

  if (!isOpen) return null

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div role="dialog" aria-modal="true" aria-label={`Set a time for ${taskTitle}`} className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg animate-in slide-in-from-bottom duration-200" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="rounded-t-2xl border border-border bg-card px-5 pt-3 pb-20 shadow-xl">
          {/* Drag handle */}
          <div className="flex justify-center mb-2">
            <div className="h-1 w-8 rounded-full bg-muted-foreground/20" />
          </div>

          {/* Header row — title + view calendar link */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Commit to a time</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{dateLabel}</p>
            </div>
            <div className="flex items-center gap-1">
              {!hideCalendarLink && (
                <button
                  onClick={handleViewCalendar}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
                >
                  <Calendar className="h-3 w-3" />
                  View calendar
                  <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                </button>
              )}
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Task name */}
          <div className="mb-3 rounded-lg bg-secondary/50 px-3 py-2">
            <p className="text-sm font-medium text-foreground truncate">{taskTitle}</p>
          </div>

          {/* Time pickers — compact inline */}
          <div className="mb-2">
            <div className="flex items-center gap-2">
              <div className="w-[120px]">
                <label className="field-label">Start</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
              </div>
              <span className="text-muted-foreground mt-4 text-xs">–</span>
              <div className="w-[120px]">
                <label className="field-label">End</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Duration presets */}
          <div className="flex gap-2 mb-4">
            {presets.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.minutes)}
                className="rounded-lg border border-border bg-secondary/30 px-4 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Commit button */}
          <button
            onClick={handleCommit}
            disabled={isSaving || startTime >= endTime}
            className="w-full rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isSaving ? 'Saving...' : existingStart ? 'Update time block' : 'Commit to calendar'}
          </button>

          {/* The ways back out of a plan. There were none: a task, once
              added, could be given a new time and nothing else. */}
          {(onDelete || (onUnschedule && existingStart)) && (
            <div className="mt-2">
              {confirmingDelete && onDelete ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-1.5">
                  <p className="text-sm text-foreground truncate">Delete &ldquo;{taskTitle}&rdquo;?</p>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => run(onDelete)}
                      disabled={isSaving}
                      className="min-h-11 rounded-lg px-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmingDelete(false)}
                      className="min-h-11 rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Keep
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  {onUnschedule && existingStart ? (
                    <button
                      onClick={() => run(onUnschedule)}
                      disabled={isSaving}
                      className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      <CalendarX className="h-4 w-4" />
                      Remove the time
                    </button>
                  ) : (
                    <span />
                  )}
                  {onDelete && (
                    <button
                      onClick={() => setConfirmingDelete(true)}
                      disabled={isSaving}
                      className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete task
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
