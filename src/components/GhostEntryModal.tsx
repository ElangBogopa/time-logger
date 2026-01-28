'use client'

import { useState, useEffect, useMemo } from 'react'
import { getLocalDateString } from '@/lib/types'
import { fetchEntries, createEntry, updateEntry, csrfFetch } from '@/lib/api'
import { CalendarEvent } from './TimelineView'
import TimeRangePicker from './TimeRangePicker'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Calendar } from 'lucide-react'

interface GhostEntryModalProps {
  event: CalendarEvent | null
  onClose: () => void
  onConfirm: () => void
  onShowToast: (message: string) => void
  userId: string
  selectedDate: string
}

function formatTimeDisplay(time: string): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function calculateDuration(start: string, end: string): number {
  if (!start || !end) return 0
  const startMins = timeToMinutes(start)
  let endMins = timeToMinutes(end)
  if (endMins <= startMins) endMins += 24 * 60
  return endMins - startMins
}

export default function GhostEntryModal({
  event,
  onClose,
  onConfirm,
  onShowToast,
  userId,
  selectedDate,
}: GhostEntryModalProps) {
  const [activity, setActivity] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize form when event changes
  useEffect(() => {
    if (event) {
      setActivity(event.title)
      setStartTime(event.startTime)
      setEndTime(event.endTime)
      setNotes('')
      setError(null)
    }
  }, [event])

  // Check if event has ended - must consider the DATE, not just time
  const hasEnded = useMemo(() => {
    const today = getLocalDateString()

    // Past day - all events have ended
    if (selectedDate < today) {
      return true
    }

    // Future day - no events have ended
    if (selectedDate > today) {
      return false
    }

    // Today - check if end time has passed
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const endMinutes = endTime ? timeToMinutes(endTime) : 0

    // Event has ended if end time is before now, or if it's a late-night event (near midnight)
    return endMinutes <= currentMinutes || endMinutes > 23 * 60 + 45
  }, [selectedDate, endTime])

  const duration = calculateDuration(startTime, endTime)

  const handleConfirm = async () => {
    if (!activity.trim()) {
      setError('Please enter an activity name')
      return
    }

    if (duration <= 0) {
      setError('Please set valid start and end times')
      return
    }

    if (!hasEnded) {
      setError('You can only confirm entries after they end')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      // Check for duplicate/overlapping entries first
      const existingEntries = await fetchEntries({ date: selectedDate, fields: 'id,start_time,end_time,activity' })

      if (existingEntries.length > 0) {
        const newStart = timeToMinutes(startTime)
        const newEnd = timeToMinutes(endTime)

        const overlappingEntry = existingEntries.find(entry => {
          if (!entry.start_time || !entry.end_time) return false
          const entryStart = timeToMinutes(entry.start_time)
          const entryEnd = timeToMinutes(entry.end_time)

          // Check for significant overlap (>50%)
          const overlapStart = Math.max(newStart, entryStart)
          const overlapEnd = Math.min(newEnd, entryEnd)
          const overlapDuration = Math.max(0, overlapEnd - overlapStart)
          const newDuration = newEnd - newStart

          return newDuration > 0 && overlapDuration / newDuration > 0.5
        })

        if (overlappingEntry) {
          setError(`This time slot overlaps with "${overlappingEntry.activity}". Please adjust the times or delete the existing entry first.`)
          setIsSubmitting(false)
          return
        }
      }

      // Get category from AI
      const categoryResponse = await csrfFetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity }),
      })

      let category = 'other'
      if (categoryResponse.ok) {
        const categoryData = await categoryResponse.json()
        category = categoryData.category
      }

      // Save via API
      const insertedEntry = await createEntry({
        date: selectedDate,
        activity,
        category: category as import('@/lib/types').TimeCategory,
        duration_minutes: duration,
        start_time: startTime,
        end_time: endTime,
        description: notes || null,
      })

      // Generate commentary
      let generatedCommentary: string | null = null
      try {
        const dayEntries = await fetchEntries({ date: selectedDate, orderBy: 'created_at', orderAsc: true })

        const commentaryResponse = await csrfFetch('/api/commentary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entry: insertedEntry,
            dayEntries,
          }),
        })

        if (commentaryResponse.ok) {
          const { commentary } = await commentaryResponse.json()
          generatedCommentary = commentary

          await updateEntry(insertedEntry.id, { commentary })
        } else {
          generatedCommentary = null
        }
      } catch {
        generatedCommentary = null
      }

      onConfirm()
      // Show different toast based on whether commentary generated
      if (generatedCommentary) {
        onShowToast(generatedCommentary)
      } else {
        onShowToast('Calendar event confirmed! (AI commentary unavailable)')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!event) return null

  return (
    <Dialog open={!!event} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton={!isSubmitting}>
        <DialogHeader className="bg-blue-500/10 -mx-6 -mt-6 px-6 pt-6 pb-4 border-b border-blue-500/20 rounded-t-lg">
          <DialogTitle className="flex items-center gap-2 text-blue-400">
            <Calendar className="h-5 w-5" />
            Confirm Calendar Event
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Activity — shown as text by default, tap to edit */}
          <div className="space-y-2">
            <Label htmlFor="ghost-activity">Activity</Label>
            <div className="flex items-center gap-2">
              <p className="flex-1 text-sm font-medium text-foreground py-2 px-3 rounded-md bg-zinc-100 dark:bg-zinc-800">
                {activity}
              </p>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('ghost-activity-edit') as HTMLInputElement
                  if (el) {
                    el.classList.toggle('hidden')
                    el.focus()
                  }
                }}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
              >
                Edit
              </button>
            </div>
            <Input
              id="ghost-activity-edit"
              className="hidden"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              placeholder="Edit activity name..."
            />
          </div>

          {/* Time Range */}
          <div className="space-y-2">
            <Label>Time</Label>
            <TimeRangePicker
              startTime={startTime}
              endTime={endTime}
              onStartTimeChange={setStartTime}
              onEndTimeChange={setEndTime}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="ghost-notes">
              Notes <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="ghost-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any details to add..."
            />
          </div>

          {/* Info/Warning */}
          {!hasEnded && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
              <p className="text-sm text-amber-400">
                You can confirm this entry after {formatTimeDisplay(endTime)}
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            onClick={handleConfirm}
            disabled={!hasEnded || isSubmitting || !activity.trim() || duration <= 0}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Confirming...
              </>
            ) : hasEnded ? (
              'Confirm Entry'
            ) : (
              `Available after ${formatTimeDisplay(endTime)}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
