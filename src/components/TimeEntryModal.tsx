'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { TimeEntry, TimeCategory, CATEGORY_LABELS, isPendingEntryReadyToConfirm } from '@/lib/types'
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
import { Loader2, Pencil, Trash2, Clock, CheckCircle2 } from 'lucide-react'

interface TimeEntryModalProps {
  entry: TimeEntry
  onClose: () => void
  onUpdate: () => void
  onDelete: () => void
  promptAddTimes?: boolean
  onShowToast?: (message: string) => void
}

const CATEGORY_COLORS: Record<TimeCategory, string> = {
  // Productive
  deep_work: 'bg-[#3b82f6]/20 text-[#60a5fa]',
  shallow_work: 'bg-[#64748b]/20 text-[#94a3b8]',
  meetings: 'bg-[#8b7aa8]/20 text-[#b8a8d8]',
  learning: 'bg-[#0891b2]/20 text-[#22d3ee]',
  creating: 'bg-[#7c3aed]/20 text-[#a78bfa]',
  // Maintenance
  admin: 'bg-[#9ca3af]/20 text-[#d1d5db]',
  errands: 'bg-[#78716c]/20 text-[#a8a29e]',
  chores: 'bg-[#a1a1aa]/20 text-[#d4d4d8]',
  commute: 'bg-[#737373]/20 text-[#a3a3a3]',
  // Body
  exercise: 'bg-[#22c55e]/20 text-[#4ade80]',
  movement: 'bg-[#86efac]/20 text-[#bbf7d0]',
  meals: 'bg-[#f59e0b]/20 text-[#fbbf24]',
  sleep: 'bg-[#1e3a5f]/20 text-[#3b82f6]',
  // Mind
  rest: 'bg-[#a8a4ce]/20 text-[#c8c4ee]',
  self_care: 'bg-[#c4b5fd]/20 text-[#ddd6fe]',
  // Connection
  social: 'bg-[#ec4899]/20 text-[#f472b6]',
  calls: 'bg-[#f472b6]/20 text-[#f9a8d4]',
  // Leisure
  entertainment: 'bg-[#71717a]/20 text-[#a1a1aa]',
  // Fallback
  other: 'bg-[#52525b]/20 text-[#71717a]',
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`
}

function formatTime(time: string | null): string {
  if (!time) return '-'
  const [hours, minutes] = time.split(':')
  const h = parseInt(hours, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function TimeEntryModal({ entry, onClose, onUpdate, onDelete, promptAddTimes = false, onShowToast }: TimeEntryModalProps) {
  const [isEditing, setIsEditing] = useState(promptAddTimes)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTimesPrompt, setShowTimesPrompt] = useState(promptAddTimes && !entry.start_time && !entry.end_time)

  const isPending = entry.status === 'pending'
  const isReadyToConfirm = isPending && isPendingEntryReadyToConfirm(entry)

  // Edit form state
  const [date, setDate] = useState(entry.date)
  const [activity, setActivity] = useState(entry.activity)
  const [startTime, setStartTime] = useState(entry.start_time || '')
  const [endTime, setEndTime] = useState(entry.end_time || '')
  const [duration, setDuration] = useState(String(entry.duration_minutes))
  const [description, setDescription] = useState(entry.description || '')

  const isDurationAutoCalculated = startTime !== '' && endTime !== ''

  // Auto-calculate duration when start and end times change
  useEffect(() => {
    if (startTime && endTime) {
      const [startHours, startMinutes] = startTime.split(':').map(Number)
      const [endHours, endMinutes] = endTime.split(':').map(Number)

      const startTotalMinutes = startHours * 60 + startMinutes
      const endTotalMinutes = endHours * 60 + endMinutes

      let durationMinutes = endTotalMinutes - startTotalMinutes

      if (durationMinutes < 0) {
        durationMinutes += 24 * 60
      }

      if (durationMinutes > 0) {
        setDuration(String(durationMinutes))
      }
    }
  }, [startTime, endTime])

  const handleSave = async () => {
    setError(null)
    setIsSaving(true)

    try {
      const activityChanged = activity !== entry.activity
      const descriptionChanged = description !== (entry.description || '')
      const needsCommentaryUpdate = activityChanged || descriptionChanged

      // If activity changed, get new category from AI
      let newCategory = entry.category
      if (activityChanged) {
        try {
          const categoryResponse = await fetch('/api/categorize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activity }),
          })

          if (categoryResponse.ok) {
            const { category } = await categoryResponse.json()
            newCategory = category
          }
        } catch {
          console.error('Failed to re-categorize activity')
        }
      }

      const updatedEntry = {
        date,
        activity,
        category: newCategory,
        duration_minutes: parseInt(duration, 10),
        start_time: startTime || null,
        end_time: endTime || null,
        description: description || null,
      }

      const { error: updateError } = await supabase
        .from('time_entries')
        .update(updatedEntry)
        .eq('id', entry.id)

      if (updateError) {
        throw new Error(updateError.message)
      }

      // Only regenerate commentary if activity or description changed
      // This saves ~1790 tokens per edit that only changes time/duration
      if (needsCommentaryUpdate) {
        // Fetch nearby entries for context (±2 entries instead of full day)
        const { data: dayEntries } = await supabase
          .from('time_entries')
          .select('*')
          .eq('date', date)
          .eq('user_id', entry.user_id)
          .order('start_time', { ascending: true })

        // Filter to nearby entries only (reduce context tokens)
        const allEntries = dayEntries || []
        const entryIndex = allEntries.findIndex(e => e.id === entry.id)
        const nearbyEntries = allEntries.filter((_, i) =>
          Math.abs(i - entryIndex) <= 2 || entryIndex === -1
        )

        try {
          const commentaryResponse = await fetch('/api/commentary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entry: { ...entry, ...updatedEntry },
              dayEntries: nearbyEntries,
            }),
          })

          if (commentaryResponse.ok) {
            const { commentary } = await commentaryResponse.json()

            await supabase
              .from('time_entries')
              .update({ commentary })
              .eq('id', entry.id)
          }
        } catch {
          // Commentary regeneration failed, but entry was updated
          console.error('Failed to regenerate commentary')
        }
      }

      setIsEditing(false)
      onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setError(null)

    try {
      const { error: deleteError } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', entry.id)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      onDelete()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry')
      setIsDeleting(false)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setDate(entry.date)
    setActivity(entry.activity)
    setStartTime(entry.start_time || '')
    setEndTime(entry.end_time || '')
    setDuration(String(entry.duration_minutes))
    setDescription(entry.description || '')
    setError(null)
  }

  // Confirm a pending entry - runs AI categorization and commentary
  const handleConfirmEntry = async () => {
    setIsConfirming(true)
    setError(null)

    try {
      // Get category from AI
      const categoryResponse = await fetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity: entry.activity }),
      })

      if (!categoryResponse.ok) {
        throw new Error('Failed to categorize activity')
      }

      const { category } = await categoryResponse.json()

      // Update entry with confirmed status and category
      const { error: updateError } = await supabase
        .from('time_entries')
        .update({ status: 'confirmed', category })
        .eq('id', entry.id)

      if (updateError) {
        throw new Error(updateError.message)
      }

      // Generate commentary
      let generatedCommentary: string | null = null
      try {
        // Fetch nearby entries for context (±2 entries to reduce tokens)
        const { data: dayEntries } = await supabase
          .from('time_entries')
          .select('*')
          .eq('date', entry.date)
          .eq('user_id', entry.user_id)
          .order('start_time', { ascending: true })

        // Filter to nearby entries only (reduce context tokens)
        const allEntries = dayEntries || []
        const entryIndex = allEntries.findIndex(e => e.id === entry.id)
        const nearbyEntries = allEntries.filter((_, i) =>
          Math.abs(i - entryIndex) <= 2 || entryIndex === -1
        )

        const commentaryResponse = await fetch('/api/commentary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entry: { ...entry, category, status: 'confirmed' },
            dayEntries: nearbyEntries,
          }),
        })

        if (commentaryResponse.ok) {
          const { commentary } = await commentaryResponse.json()
          generatedCommentary = commentary

          await supabase
            .from('time_entries')
            .update({ commentary })
            .eq('id', entry.id)
        } else {
          generatedCommentary = null
        }
      } catch {
        generatedCommentary = null
      }

      onUpdate()
      onClose()
      // Show different toast based on whether commentary generated
      if (generatedCommentary) {
        onShowToast?.(generatedCommentary)
      } else {
        onShowToast?.('Entry confirmed! (AI commentary unavailable)')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm entry')
    } finally {
      setIsConfirming(false)
    }
  }

  const getDialogTitle = () => {
    if (isEditing) return 'Edit Entry'
    if (isReadyToConfirm) return 'Confirm Entry'
    if (isPending) return 'Planned Entry'
    return 'Entry Details'
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPending && <Clock className="h-5 w-5 text-amber-500" />}
            {getDialogTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {isEditing ? (
            <div className="space-y-4">
              {/* Add Times Prompt */}
              {showTimesPrompt && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                  <div className="flex items-start gap-2">
                    <Clock className="h-5 w-5 text-amber-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-300">
                        Add start and end times?
                      </p>
                      <p className="mt-0.5 text-xs text-amber-400/80">
                        This entry was placed on the timeline using estimated times. Add actual times for more accurate tracking.
                      </p>
                      <button
                        onClick={() => setShowTimesPrompt(false)}
                        className="mt-2 text-xs text-amber-400 hover:text-amber-300"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="edit-date">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              {/* Activity */}
              <div className="space-y-2">
                <Label htmlFor="edit-activity">Activity</Label>
                <Input
                  id="edit-activity"
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                />
              </div>

              {/* Start & End Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-start">Start Time</Label>
                  <Input
                    id="edit-start"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-end">End Time</Label>
                  <Input
                    id="edit-end"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label htmlFor="edit-duration">
                  Duration (minutes)
                  {isDurationAutoCalculated && (
                    <span className="ml-2 text-xs text-blue-400">Auto-calculated</span>
                  )}
                </Label>
                <Input
                  id="edit-duration"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  min="1"
                  disabled={isDurationAutoCalculated}
                  className={isDurationAutoCalculated ? 'opacity-60 cursor-not-allowed' : ''}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <textarea
                  id="edit-notes"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pending Entry Prompt */}
              {isPending && (
                <div className={`rounded-lg border p-4 ${
                  isReadyToConfirm
                    ? 'border-amber-500/30 bg-amber-500/10'
                    : 'border-zinc-500/30 bg-zinc-500/10'
                }`}>
                  {isReadyToConfirm ? (
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-amber-400">Did this happen as planned?</p>
                        <p className="mt-1 text-sm text-amber-500/80">
                          Confirm this entry to finalize it with AI categorization and commentary.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-zinc-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-zinc-300">This entry hasn&apos;t happened yet</p>
                        <p className="mt-1 text-sm text-zinc-400">
                          You can confirm it after {formatTime(entry.end_time)}.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Activity & Category */}
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  {entry.activity}
                </h3>
                {!isPending && entry.category && (
                  <span className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium ${CATEGORY_COLORS[entry.category]}`}>
                    {CATEGORY_LABELS[entry.category]}
                  </span>
                )}
                {(isPending || !entry.category) && (
                  <span className="mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium bg-zinc-500/20 text-zinc-400">
                    Pending
                  </span>
                )}
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Date
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {formatDate(entry.date)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Duration
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {formatDuration(entry.duration_minutes)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Start Time
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {formatTime(entry.start_time)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    End Time
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {formatTime(entry.end_time)}
                  </p>
                </div>
              </div>

              {/* Notes */}
              {entry.description && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Notes
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {entry.description}
                  </p>
                </div>
              )}

              {/* AI Commentary - only for confirmed entries */}
              {!isPending && entry.commentary && (
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Commentary
                  </p>
                  <p className="mt-2 text-sm italic text-muted-foreground">
                    "{entry.commentary}"
                  </p>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="mt-4 text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {isEditing ? (
            <div className="flex w-full items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSaving}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          ) : showDeleteConfirm ? (
            <div className="flex w-full items-center justify-between">
              <p className="text-sm text-muted-foreground">Delete this entry?</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Yes, delete'
                  )}
                </Button>
              </div>
            </div>
          ) : isReadyToConfirm ? (
            /* Pending entry ready to confirm */
            <div className="flex w-full items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  onClick={handleConfirmEntry}
                  disabled={isConfirming}
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Confirm
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : isPending ? (
            /* Pending entry not yet ready to confirm */
            <div className="flex w-full items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
              <Button onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </div>
          ) : (
            /* Confirmed entry */
            <div className="flex w-full items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
              <Button onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
