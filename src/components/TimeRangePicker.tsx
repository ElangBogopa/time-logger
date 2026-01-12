'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface TimeRangePickerProps {
  startTime: string
  endTime: string
  onStartTimeChange: (time: string) => void
  onEndTimeChange: (time: string) => void
  onDurationChange?: (minutes: number) => void
  variant?: 'default' | 'quicklog'
}

// Generate time slots in 15-minute increments (00:00 to 23:45)
function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
    }
  }
  return slots
}

const TIME_SLOTS = generateTimeSlots()

// Round time to nearest 15-minute interval
function roundToNearest15(date: Date = new Date()): string {
  const minutes = date.getMinutes()
  const roundedMinutes = Math.round(minutes / 15) * 15

  let hours = date.getHours()
  let mins = roundedMinutes

  if (mins >= 60) {
    mins = 0
    hours = (hours + 1) % 24
  }

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

// Add minutes to a time string
function addMinutes(time: string, minutesToAdd: number): string {
  const [hours, minutes] = time.split(':').map(Number)
  const totalMinutes = hours * 60 + minutes + minutesToAdd
  const newHours = Math.floor(totalMinutes / 60) % 24
  const newMinutes = totalMinutes % 60
  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`
}

// Calculate duration between two times in minutes
function calculateDuration(start: string, end: string): number {
  if (!start || !end) return 0
  const [startH, startM] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)
  const startTotal = startH * 60 + startM
  let endTotal = endH * 60 + endM
  if (endTotal <= startTotal) endTotal += 24 * 60 // Handle crossing midnight
  return endTotal - startTotal
}

// Format duration for display
function formatDuration(minutes: number): string {
  if (minutes <= 0) return ''
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

// Format time for display (12-hour format)
function formatTimeDisplay(time: string): string {
  if (!time) return '--:--'
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`
}

interface TimeColumnProps {
  value: string
  onChange: (time: string) => void
  label: string
}

function TimeColumn({ value, onChange, label }: TimeColumnProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const itemHeight = 48

  // Scroll to selected value
  const scrollToTime = useCallback((time: string, smooth = true) => {
    if (!scrollRef.current) return
    const index = TIME_SLOTS.indexOf(time)
    if (index >= 0) {
      const scrollTop = index * itemHeight
      scrollRef.current.scrollTo({
        top: scrollTop,
        behavior: smooth ? 'smooth' : 'auto'
      })
    }
  }, [])

  // On mount or when value changes externally, scroll to it
  useEffect(() => {
    if (value) {
      scrollToTime(value, false)
    }
  }, [value, scrollToTime])

  const handleSelect = (slot: string) => {
    onChange(slot)
    scrollToTime(slot, true)
  }

  return (
    <div className="flex flex-1 flex-col">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div
        ref={scrollRef}
        className="h-[288px] overflow-y-auto overscroll-contain rounded-lg border bg-muted/30"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {TIME_SLOTS.map((slot) => {
          const isSelected = slot === value

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
  const isEndBeforeStart = tempStart && tempEnd && tempEnd <= tempStart
  const duration = calculateDuration(tempStart, tempEnd)
  const isValidRange = tempStart && tempEnd && duration > 0 && duration <= 16 * 60 // Max 16 hours

  // Handle start time change - auto-snap end time to start + 30 minutes
  const handleStartChange = useCallback((time: string) => {
    setTempStart(time)
    setTempEnd(addMinutes(time, 30))
  }, [])

  // Initialize with smart defaults when opening
  const handleOpen = () => {
    if (startTime && endTime) {
      // Use existing values
      setTempStart(startTime)
      setTempEnd(endTime)
    } else if (startTime) {
      // Have start, default end to start + 30min
      setTempStart(startTime)
      setTempEnd(addMinutes(startTime, 30))
    } else {
      // Smart defaults: current time rounded to 15min, end 30min later
      const defaultStart = roundToNearest15()
      setTempStart(defaultStart)
      setTempEnd(addMinutes(defaultStart, 30))
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
          <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
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
          <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            End
          </span>
          <span className="mt-0.5 block">
            {endTime ? formatTimeDisplay(endTime) : 'Set time'}
          </span>
        </button>
      </div>

      {/* Picker modal using shadcn Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
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
            />

            <TimeColumn
              value={tempEnd}
              onChange={setTempEnd}
              label="End"
            />
          </div>

          {/* Duration display and error */}
          <div className="py-2">
            {isEndBeforeStart ? (
              <p className="text-center text-sm text-amber-500">
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
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
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
