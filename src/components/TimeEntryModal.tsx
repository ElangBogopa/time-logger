'use client'

import { useState, useEffect } from 'react'
import { fetchEntries, updateEntry, deleteEntry, csrfFetch } from '@/lib/api'
import { TimeEntry, TimeCategory, CATEGORY_LABELS, getAggregatedCategory, isPendingEntryReadyToConfirm } from '@/lib/types'
import { AGGREGATED_CLASSES } from '@/lib/palette'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Pencil, Trash2, Clock, CheckCircle2, ChevronDown } from 'lucide-react'
import CategoryPicker from '@/components/CategoryPicker'
import { toast } from 'sonner'

interface TimeEntryModalProps {
  entry: TimeEntry
  onClose: () => void
  onUpdate: () => void
  onDelete: () => void
  promptAddTimes?: boolean
  onShowToast?: (message: string) => void
}

/**
 * The category chips, from the one palette by way of each category's
 * bucket. This was a seventh private copy of the colours — twenty entries
 * of raw hex, at category granularity, so deep work was blue-500 here and
 * slate blue everywhere else. Raw hex is how it survived the sweep that
 * removed the Tailwind utilities.
 */
const CATEGORY_COLORS = Object.fromEntries(
  (Object.keys(CATEGORY_LABELS) as TimeCategory[]).map((category) => {
    const classes = AGGREGATED_CLASSES[getAggregatedCategory(category)]
    return [category, `${classes.tint} ${classes.text}`]
  })
) as Record<TimeCategory, string>

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
  const [category, setCategory] = useState<TimeCategory | null>(entry.category)
  const [isPickingCategory, setIsPickingCategory] = useState(false)
  const [isSavingCategory, setIsSavingCategory] = useState(false)

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

  /** Correct the category from the detail view: one tap, saved at once. */
  const handleChangeCategory = async (next: TimeCategory) => {
    if (next === entry.category) {
      setIsPickingCategory(false)
      return
    }
    setError(null)
    setIsSavingCategory(true)
    try {
      await updateEntry(entry.id, { category: next })
      toast.success(`Now counted as ${CATEGORY_LABELS[next]}`)
      onUpdate()
    } catch {
      setError('Could not change the category. Please try again.')
    } finally {
      setIsSavingCategory(false)
    }
  }

  const handleSave = async () => {
    setError(null)
    setIsSaving(true)

    try {
      const activityChanged = activity !== entry.activity
      const descriptionChanged = description !== (entry.description || '')
      const needsCommentaryUpdate = activityChanged || descriptionChanged

      // A category chosen by hand stands. Only when the wording changed and
      // the category was left alone does the model get another look — it
      // used to re-categorise on every reword, which was also the only way
      // to change a category at all.
      const categoryChosenByHand = category !== entry.category
      let newCategory = category
      if (activityChanged && !categoryChosenByHand) {
        try {
          const categoryResponse = await csrfFetch('/api/categorize', {
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

      await updateEntry(entry.id, updatedEntry)

      // Only regenerate commentary if activity or description changed
      // This saves ~1790 tokens per edit that only changes time/duration
      if (needsCommentaryUpdate) {
        // Fetch nearby entries for context (±2 entries instead of full day)
        const dayEntries = await fetchEntries({ date, orderBy: 'start_time', orderAsc: true })

        // Filter to nearby entries only (reduce context tokens)
        const entryIndex = dayEntries.findIndex(e => e.id === entry.id)
        const nearbyEntries = dayEntries.filter((_, i) =>
          Math.abs(i - entryIndex) <= 2 || entryIndex === -1
        )

        try {
          const commentaryResponse = await csrfFetch('/api/commentary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entry: { ...entry, ...updatedEntry },
              dayEntries: nearbyEntries,
            }),
          })

          if (commentaryResponse.ok) {
            const { commentary } = await commentaryResponse.json()

            await updateEntry(entry.id, { commentary })
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

  const handleDelete = () => {
    const entryName = entry.activity || 'Entry'
    
    // Close the modal immediately
    onClose()
    
    // Show toast with undo button - soft delete pattern
    toast(`"${entryName}" deleted`, {
      action: {
        label: 'Undo',
        onClick: () => {
          // If user clicks undo, just show a message since entry was never actually deleted
          onShowToast?.('Delete cancelled')
        },
      },
      duration: 5000,
      onDismiss: async () => {
        // Only actually delete when toast expires/is dismissed without undo
        try {
          await deleteEntry(entry.id)
          onDelete() // Refresh the parent component
        } catch (err) {
          console.error('Failed to delete entry:', err)
          onShowToast?.('Failed to delete entry')
        }
      },
      onAutoClose: async () => {
        // Only actually delete when toast expires/is dismissed without undo
        try {
          await deleteEntry(entry.id)
          onDelete() // Refresh the parent component
        } catch (err) {
          console.error('Failed to delete entry:', err)
          onShowToast?.('Failed to delete entry')
        }
      },
    })
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
      const categoryResponse = await csrfFetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity: entry.activity }),
      })

      if (!categoryResponse.ok) {
        throw new Error('Failed to categorize activity')
      }

      const { category } = await categoryResponse.json()

      // Update entry with confirmed status and category
      await updateEntry(entry.id, { status: 'confirmed', category })

      // Generate commentary
      let generatedCommentary: string | null = null
      try {
        // Fetch nearby entries for context (±2 entries to reduce tokens)
        const dayEntries = await fetchEntries({ date: entry.date, orderBy: 'start_time', orderAsc: true })

        // Filter to nearby entries only (reduce context tokens)
        const entryIndex = dayEntries.findIndex(e => e.id === entry.id)
        const nearbyEntries = dayEntries.filter((_, i) =>
          Math.abs(i - entryIndex) <= 2 || entryIndex === -1
        )

        const commentaryResponse = await csrfFetch('/api/commentary', {
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

          await updateEntry(entry.id, { commentary })
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
      <DialogContent className="flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPending && <Clock className="h-5 w-5 text-[#B5A07A]" />}
            {getDialogTitle()}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEditing
              ? 'Edit your time entry details, duration, and notes'
              : isReadyToConfirm
                ? 'Confirm that this planned activity happened as scheduled'
                : isPending
                  ? 'View details of this planned activity'
                  : 'View and edit details of this logged activity'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {isEditing ? (
            <div className="space-y-4">
              {/* Add Times Prompt */}
              {showTimesPrompt && (
                <div className="rounded-lg border border-[#B5A07A]/20 bg-[#B5A07A]/10 p-3">
                  <div className="flex items-start gap-2">
                    <Clock className="h-5 w-5 text-[#CBB894] mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-[#CBB894]">
                        Add start and end times?
                      </p>
                      <p className="mt-0.5 text-xs text-[#CBB894]/80">
                        This entry was placed on the timeline using estimated times. Add actual times for more accurate tracking.
                      </p>
                      <button
                        onClick={() => setShowTimesPrompt(false)}
                        className="mt-2 text-xs text-[#CBB894] hover:text-[#CBB894]"
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
                    <span className="ml-2 text-xs text-[#93AEC9]">Auto-calculated</span>
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

              {/* Category — only once the entry has one */}
              {!isPending && category && (
                <div className="space-y-2">
                  <Label>Category</Label>
                  <CategoryPicker value={category} onChange={setCategory} disabled={isSaving} />
                </div>
              )}

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
                    ? 'border-[#B5A07A]/30 bg-[#B5A07A]/10'
                    : 'border-zinc-500/30 bg-zinc-500/10'
                }`}>
                  {isReadyToConfirm ? (
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-[#B5A07A] mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-[#CBB894]">Did this happen as planned?</p>
                        <p className="mt-1 text-sm text-[#B5A07A]/80">
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
                  <>
                    <button
                      type="button"
                      onClick={() => setIsPickingCategory((open) => !open)}
                      aria-expanded={isPickingCategory}
                      aria-label={`Category: ${CATEGORY_LABELS[entry.category]}. Change category`}
                      className={`mt-2 inline-flex min-h-9 items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition-all duration-150 active:scale-[0.97] ${CATEGORY_COLORS[entry.category]}`}
                    >
                      {CATEGORY_LABELS[entry.category]}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isPickingCategory ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                    {isPickingCategory && (
                      <div className="mt-3">
                        <p className="field-label mb-2">Count this as</p>
                        <CategoryPicker
                          value={entry.category}
                          onChange={handleChangeCategory}
                          disabled={isSavingCategory}
                        />
                      </div>
                    )}
                  </>
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
                  <p className="field-label">
                    Date
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {formatDate(entry.date)}
                  </p>
                </div>
                <div>
                  <p className="field-label">
                    Duration
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {formatDuration(entry.duration_minutes)}
                  </p>
                </div>
                <div>
                  <p className="field-label">
                    Start Time
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {formatTime(entry.start_time)}
                  </p>
                </div>
                <div>
                  <p className="field-label">
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
                  <p className="field-label">
                    Notes
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {entry.description}
                  </p>
                </div>
              )}

              {/* AI Commentary removed — unnecessary clutter */}
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
                  className="bg-[#B5A07A] hover:bg-[#B5A07A] text-white"
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
