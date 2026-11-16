'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronRight, Clock, Loader2 } from 'lucide-react'
import type { RepeatRow } from '@/lib/repeat-session'
import { formatTimeDisplay } from '@/lib/time-utils'
import { formatSessionDuration } from '@/lib/session-utils'

interface RepeatSessionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "yesterday", "Monday", "27 Oct" */
  label: string
  rows: RepeatRow[]
  isLogging: boolean
  /** The ticked rows' entry ids. */
  onLog: (ids: Set<string>) => void
  onPickTime: (row: RepeatRow) => void
}

function timeLine(row: RepeatRow): string {
  const { entry } = row
  const length = formatSessionDuration(entry.duration_minutes)
  const start = entry.start_time ? formatTimeDisplay(entry.start_time) : ''
  const range = entry.end_time ? `${start} – ${formatTimeDisplay(entry.end_time)}` : start
  return range ? `${range} · ${length}` : length
}

export default function RepeatSessionSheet({
  open,
  onOpenChange,
  label,
  rows,
  isLogging,
  onLog,
  onPickTime,
}: RepeatSessionSheetProps) {
  const [ticked, setTicked] = useState<Set<string>>(new Set())

  // Nothing is ticked each time the sheet opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setTicked(new Set())
  }

  const tickable = rows.filter((row) => !row.clash)
  const tickableIds = new Set(tickable.map((row) => row.entry.id))
  // Rows can drop away while the sheet is open (an entry was logged elsewhere).
  const chosen = tickable.filter((row) => ticked.has(row.entry.id))
  const allTicked = tickable.length > 0 && chosen.length === tickable.length
  const totalMinutes = chosen.reduce((sum, row) => sum + row.entry.duration_minutes, 0)

  const toggle = (id: string) => {
    setTicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setTicked(allTicked ? new Set() : new Set(tickableIds))
  }

  const handleLog = () => {
    onLog(new Set(chosen.map((row) => row.entry.id)))
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isLogging && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Same as {label}</DialogTitle>
          <DialogDescription className="sr-only">
            Choose which activities from {label} to log again.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{rows.length} left</span>
          <button
            type="button"
            className="min-h-11 px-2 text-xs font-medium text-muted-foreground disabled:opacity-50"
            onClick={toggleAll}
            disabled={tickable.length === 0 || isLogging}
          >
            {allTicked ? 'Clear' : 'Select all'}
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-border bg-card divide-y divide-border">
          {rows.map((row) =>
            row.clash ? (
              <button
                key={row.entry.id}
                type="button"
                className="flex w-full min-h-11 items-center gap-3 p-3 text-left disabled:opacity-50"
                onClick={() => onPickTime(row)}
                disabled={isLogging}
              >
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{row.entry.activity}</span>
                  <span className="block text-xs text-muted-foreground">{timeLine(row)}</span>
                  <span className="block text-xs text-muted-foreground">
                    Overlaps {row.clash.activity} · pick a time
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ) : (
              <label key={row.entry.id} className="flex min-h-11 cursor-pointer items-center gap-3 p-3">
                <Checkbox
                  checked={ticked.has(row.entry.id)}
                  onCheckedChange={() => toggle(row.entry.id)}
                  disabled={isLogging}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{row.entry.activity}</span>
                  <span className="block text-xs text-muted-foreground">{timeLine(row)}</span>
                </span>
              </label>
            )
          )}
        </div>

        <Button size="lg" className="w-full" onClick={handleLog} disabled={chosen.length === 0 || isLogging}>
          {isLogging ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : chosen.length === 0 ? (
            'Choose what to log'
          ) : (
            `Log ${chosen.length} ${chosen.length === 1 ? 'activity' : 'activities'} · ${formatSessionDuration(totalMinutes)}`
          )}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
