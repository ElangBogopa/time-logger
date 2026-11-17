'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { roundToNearest15, addMinutesToTime, calculateDuration, formatDuration, formatTimeDisplay } from '@/lib/time-utils'
import { TIME_SLOTS, MAX_RANGE_MINUTES, endSlotsAfter, defaultEndAfter, endScrollTarget, normalizeEnd } from '@/lib/time-slots'

interface TimeRangePickerProps {
  startTime: string
  endTime: string
  onStartTimeChange: (time: string) => void
  onEndTimeChange: (time: string) => void
  onDurationChange?: (minutes: number) => void
  variant?: 'default' | 'quicklog'
}

interface TimeColumnProps {
  value: string
  onChange: (time: string) => void
  label: string
  slots: string[]
  /** The slot the column opens at, as its top row. */
  scrollTarget: string
  testId: string
}

function TimeColumn({ value, onChange, label, slots, scrollTarget, testId }: TimeColumnProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const itemHeight = 48

  // Position the column at its target, on mount and whenever it changes
  useEffect(() => {
    if (!scrollRef.current) return
    const index = slots.indexOf(scrollTarget)
    if (index >= 0) {
      scrollRef.current.scrollTo({ top: index * itemHeight, behavior: 'auto' })
    }
  }, [scrollTarget, slots])

  const handleSelect = (slot: string) => {
    onChange(slot)
    const index = slots.indexOf(slot)
    if (index >= 0) {
      scrollRef.current?.scrollTo({ top: index * itemHeight, behavior: 'smooth' })
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div
        ref={scrollRef}
        data-testid={testId}
        className="h-[288px] overflow-y-auto overscroll-contain rounded-lg border bg-muted/30"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {slots.map((slot) => {
          const isSelected = slot === normalizeEnd(value)

          return (
            <button
              key={slot}
              type="button"
              onClick={() => handleSelect(slot)}
              style={{ scrollSnapAlign: 'start' }}
              className={`flex h-12 w-full items-center justify-center text-base font-medium transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-accent'
              }`}
            >
              {formatTimeDisplay(slot)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function TimeRangePicker({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  onDurationChange,
  variant = 'default',
}: TimeRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempStart, setTempStart] = useState('')
  const [tempEnd, setTempEnd] = useState('')

  // Check if end time is valid (after start time, or crossing midnight with reasonable duration)
  const duration = calculateDuration(tempStart, tempEnd)
  // Allow midnight crossing (e.g. 23:00 → 00:00 = 1h) — only invalid if duration is 0 or too long
  const isEndBeforeStart = tempStart && tempEnd && duration <= 0
  const isValidRange = tempStart && tempEnd && duration > 0 && duration <= MAX_RANGE_MINUTES // Max 16 hours

  const endSlots = useMemo(() => (tempStart ? endSlotsAfter(tempStart) : TIME_SLOTS), [tempStart])

  // Handle start time change - auto-snap end time to start + 30 minutes
  const handleStartChange = useCallback((time: string) => {
    setTempStart(time)
    setTempEnd(addMinutesToTime(time, 30))
  }, [])

  // Initialize with smart defaults when opening
  const handleOpen = () => {
    if (startTime && endTime) {
      // Use existing values
      setTempStart(startTime)
      setTempEnd(endTime)
    } else if (startTime) {
      // Have start, default end to an hour after it
      setTempStart(startTime)
      setTempEnd(defaultEndAfter(startTime))
    } else {
      // Smart defaults: current time rounded to 15min, end an hour later
      const defaultStart = roundToNearest15()
      setTempStart(defaultStart)
      setTempEnd(defaultEndAfter(defaultStart))
    }
    setIsOpen(true)
  }

  // Handle confirm
  const handleConfirm = () => {
    if (!isValidRange) return
    onStartTimeChange(tempStart)
    onEndTimeChange(tempEnd)
    onDurationChange?.(duration)
    setIsOpen(false)
  }

  const displayDuration = calculateDuration(startTime, endTime)

  return (
    <div className="relative">
      {/* Trigger buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleOpen}
          className={`flex-1 rounded-md border px-3 py-2.5 text-left text-sm font-medium transition-all ${
            startTime
              ? 'border-input bg-background text-foreground hover:border-ring'
              : 'border-dashed border-input bg-muted/30 text-muted-foreground hover:border-ring hover:bg-background'
          }`}
        >
          <span className="block field-label">
            Start
          </span>
          <span className="mt-0.5 block">
            {startTime ? formatTimeDisplay(startTime) : 'Set time'}
          </span>
        </button>

        {/* Duration badge */}
        {displayDuration > 0 && (
          <div className="flex flex-col items-center px-1">
            <div className="h-px w-4 bg-border" />
            <span className="my-1 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
              {formatDuration(displayDuration)}
            </span>
            <div className="h-px w-4 bg-border" />
          </div>
        )}

        <button
          type="button"
          onClick={handleOpen}
          className={`flex-1 rounded-md border px-3 py-2.5 text-left text-sm font-medium transition-all ${
            endTime
              ? 'border-input bg-background text-foreground hover:border-ring'
              : 'border-dashed border-input bg-muted/30 text-muted-foreground hover:border-ring hover:bg-background'
          }`}
        >
          <span className="block field-label">
            End
          </span>
          <span className="mt-0.5 block">
            {endTime ? formatTimeDisplay(endTime) : 'Set time'}
          </span>
        </button>
      </div>

      {/* Picker modal using shadcn Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <DialogTitle className="text-sm font-semibold">
              Select Time Range
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          {/* Time pickers */}
          <div className="flex gap-3 py-2">
            <TimeColumn
              value={tempStart}
              onChange={handleStartChange}
              label="Start"
              slots={TIME_SLOTS}
              scrollTarget={tempStart}
              testId="time-column-start"
            />

            <TimeColumn
              value={tempEnd}
              onChange={setTempEnd}
              label="End"
              slots={endSlots}
              scrollTarget={tempStart ? endScrollTarget(tempStart, tempEnd) : tempEnd}
              testId="time-column-end"
            />
          </div>

          {/* Duration display and error */}
          <div className="py-2">
            {isEndBeforeStart ? (
              <p className="text-center text-sm text-[#B5A07A]">
                End time must be after start time
              </p>
            ) : duration > 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                Duration: <span className="font-semibold text-foreground">{formatDuration(duration)}</span>
              </p>
            ) : null}
          </div>

          {/* Confirm button */}
          <DialogFooter>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!isValidRange}
              className={`w-full ${
                variant === 'quicklog'
                  ? 'bg-gradient-to-r from-[#B5A07A] to-[#B5A07A] hover:from-[#B5A07A] hover:to-[#B5A07A] text-white'
                  : ''
              }`}
            >
              {isValidRange ? `Confirm ${formatDuration(duration)}` : 'Select times'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
