'use client'

import { useState, useEffect } from 'react'
import { X, Clock, Calendar } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface CommitTimeModalProps {
  isOpen: boolean
  onClose: () => void
  onCommit: (start: string, end: string) => Promise<void>
  taskTitle: string
  date: string
  existingStart?: string | null
  existingEnd?: string | null
}

export default function CommitTimeModal({
  isOpen,
  onClose,
  onCommit,
  taskTitle,
  date,
  existingStart,
  existingEnd,
}: CommitTimeModalProps) {
  const router = useRouter()
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [isSaving, setIsSaving] = useState(false)

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
    router.push(`/calendar?date=${date}`)
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
      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg animate-in slide-in-from-bottom duration-200">
        <div className="rounded-t-2xl border border-border bg-card p-5 pb-8 shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Commit to a time</h3>
            </div>
            <button onClick={onClose} className="text-muted-foreground/50 hover:text-muted-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Task name + date */}
          <div className="mb-4 rounded-lg bg-secondary/50 px-3 py-2.5">
            <p className="text-sm font-medium text-foreground truncate">{taskTitle}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{dateLabel}</p>
          </div>

          {/* Time pickers */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Start</label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <span className="text-muted-foreground/40 mt-5">→</span>
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">End</label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Duration presets */}
          <div className="flex gap-2 mb-5">
            {presets.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.minutes)}
                className="flex-1 rounded-lg border border-border bg-secondary/30 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={handleCommit}
              disabled={isSaving || startTime >= endTime}
              className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : existingStart ? 'Update time block' : 'Commit to calendar'}
            </button>

            <button
              onClick={handleViewCalendar}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-all"
            >
              <Calendar className="h-3.5 w-3.5" />
              View in calendar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
