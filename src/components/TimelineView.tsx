'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { TimeEntry, TimeCategory } from '@/lib/types'
import TimeEntryModal from './TimeEntryModal'

export interface CalendarEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  isAllDay: boolean
}

interface TimelineViewProps {
  entries: TimeEntry[]
  calendarEvents?: CalendarEvent[]
  isLoading: boolean
  onEntryDeleted: () => void
  onGhostEntryClick?: (event: CalendarEvent) => void
  selectedDate?: string
  isToday?: boolean
}

const PIXELS_PER_MINUTE = 1.5
const HOUR_HEIGHT = 60 * PIXELS_PER_MINUTE // 90px per hour
const MIN_BLOCK_HEIGHT = 24 // Minimum height for very short entries

const CATEGORY_COLORS: Record<TimeCategory, { bg: string; border: string; text: string }> = {
  deep_work: { bg: 'bg-[#64748b]', border: 'border-[#475569]', text: 'text-white' },
  meetings: { bg: 'bg-[#8b7aa8]', border: 'border-[#6b5a88]', text: 'text-white' },
  admin: { bg: 'bg-[#9ca3af]', border: 'border-[#6b7280]', text: 'text-white' },
  learning: { bg: 'bg-[#5d9a9a]', border: 'border-[#4a7a7a]', text: 'text-white' },
  exercise: { bg: 'bg-[#6b9080]', border: 'border-[#4a6b5a]', text: 'text-white' },
  rest: { bg: 'bg-[#a8a4ce]', border: 'border-[#8884ae]', text: 'text-zinc-800' },
  meals: { bg: 'bg-[#b8a088]', border: 'border-[#98806a]', text: 'text-zinc-800' },
  self_care: { bg: 'bg-[#8fa387]', border: 'border-[#6f8367]', text: 'text-white' },
  relationships: { bg: 'bg-[#b08d8d]', border: 'border-[#906d6d]', text: 'text-white' },
  distraction: { bg: 'bg-[#c97e7e]', border: 'border-[#a95e5e]', text: 'text-white' },
  other: { bg: 'bg-[#71717a]', border: 'border-[#52525b]', text: 'text-white' },
}

interface PlacedEntry extends TimeEntry {
  placedStartTime: string
  placedEndTime: string
  isEstimated: boolean
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function formatHour(hour: number): string {
  if (hour === 0) return '12am'
  if (hour === 12) return '12pm'
  if (hour < 12) return `${hour}am`
  return `${hour - 12}pm`
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Find gaps in the timeline where untimed entries could fit
function findGaps(timedEntries: TimeEntry[], startHour: number, endHour: number): { start: number; end: number }[] {
  const gaps: { start: number; end: number }[] = []
  const startMinutes = startHour * 60
  const endMinutes = endHour * 60

  // Sort entries by start time
  const sorted = [...timedEntries]
    .filter(e => e.start_time)
    .sort((a, b) => timeToMinutes(a.start_time!) - timeToMinutes(b.start_time!))

  let lastEnd = startMinutes

  for (const entry of sorted) {
    const entryStart = timeToMinutes(entry.start_time!)
    if (entryStart > lastEnd) {
      gaps.push({ start: lastEnd, end: entryStart })
    }
    const entryEnd = entry.end_time ? timeToMinutes(entry.end_time) : entryStart + entry.duration_minutes
    lastEnd = Math.max(lastEnd, entryEnd)
  }

  // Gap at the end
  if (lastEnd < endMinutes) {
    gaps.push({ start: lastEnd, end: endMinutes })
  }

  return gaps
}

// Smart place untimed entries in gaps or at the start
function smartPlaceEntries(
  timedEntries: TimeEntry[],
  untimedEntries: TimeEntry[],
  startHour: number,
  endHour: number
): PlacedEntry[] {
  const placed: PlacedEntry[] = []

  // First, add all timed entries as-is
  for (const entry of timedEntries) {
    placed.push({
      ...entry,
      placedStartTime: entry.start_time!,
      placedEndTime: entry.end_time!,
      isEstimated: false,
    })
  }

  if (untimedEntries.length === 0) return placed

  // Find gaps in the timeline
  const gaps = findGaps(timedEntries, startHour, endHour)

  // Try to fit untimed entries in gaps, otherwise stack at the beginning
  let gapIndex = 0
  let currentGapOffset = 0

  for (const entry of untimedEntries) {
    let placedStart: number | null = null

    // Try to find a gap that fits this entry
    while (gapIndex < gaps.length) {
      const gap = gaps[gapIndex]
      const availableSpace = gap.end - gap.start - currentGapOffset

      if (availableSpace >= entry.duration_minutes) {
        placedStart = gap.start + currentGapOffset
        currentGapOffset += entry.duration_minutes
        break
      } else {
        // Move to next gap
        gapIndex++
        currentGapOffset = 0
      }
    }

    // If no gap found, place before the first timed entry
    if (placedStart === null) {
      const firstTimedStart = timedEntries.length > 0 && timedEntries[0].start_time
        ? Math.min(...timedEntries.filter(e => e.start_time).map(e => timeToMinutes(e.start_time!)))
        : startHour * 60 + 60 // Default to 1 hour after start

      // Stack untimed entries before the first timed entry
      const alreadyPlacedBefore = placed.filter(p => p.isEstimated && timeToMinutes(p.placedStartTime) < firstTimedStart)
      const usedMinutes = alreadyPlacedBefore.reduce((sum, p) => sum + p.duration_minutes, 0)

      placedStart = Math.max(startHour * 60, firstTimedStart - usedMinutes - entry.duration_minutes)
    }

    // Calculate end time based on start and duration
    const placedEnd = placedStart + entry.duration_minutes

    placed.push({
      ...entry,
      placedStartTime: minutesToTime(placedStart),
      placedEndTime: minutesToTime(placedEnd),
      isEstimated: true,
    })
  }

  return placed
}

export default function TimelineView({
  entries,
  calendarEvents = [],
  isLoading,
  onEntryDeleted,
  onGhostEntryClick,
  isToday = true
}: TimelineViewProps) {
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null)
  const [promptAddTimes, setPromptAddTimes] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const totalMinutes = entries.reduce((sum, entry) => sum + entry.duration_minutes, 0)

  // Filter out calendar events that overlap with confirmed entries (already logged)
  const ghostEvents = useMemo(() => {
    return calendarEvents.filter(event => {
      // Check if any entry has similar time range (within 15 minutes)
      const eventStart = timeToMinutes(event.startTime)
      const eventEnd = timeToMinutes(event.endTime)

      return !entries.some(entry => {
        if (!entry.start_time || !entry.end_time) return false
        const entryStart = timeToMinutes(entry.start_time)
        const entryEnd = timeToMinutes(entry.end_time)

        // Check for significant overlap (more than 50%)
        const overlapStart = Math.max(eventStart, entryStart)
        const overlapEnd = Math.min(eventEnd, entryEnd)
        const overlap = Math.max(0, overlapEnd - overlapStart)
        const eventDuration = eventEnd - eventStart

        return overlap > eventDuration * 0.5
      })
    })
  }, [calendarEvents, entries])

  // Separate entries with times from those without
  const { timedEntries, untimedEntries } = useMemo(() => {
    const timed: TimeEntry[] = []
    const untimed: TimeEntry[] = []
    entries.forEach(entry => {
      if (entry.start_time && entry.end_time) {
        timed.push(entry)
      } else {
        untimed.push(entry)
      }
    })
    return { timedEntries: timed, untimedEntries: untimed }
  }, [entries])

  // Calculate the time range for the timeline (including ghost events)
  const { startHour, endHour } = useMemo(() => {
    if (timedEntries.length === 0 && untimedEntries.length === 0 && ghostEvents.length === 0) {
      return { startHour: 6, endHour: 22 } // Default 6am to 10pm
    }

    let minMinutes = 24 * 60
    let maxMinutes = 0

    timedEntries.forEach(entry => {
      if (entry.start_time) {
        const startMins = timeToMinutes(entry.start_time)
        minMinutes = Math.min(minMinutes, startMins)
      }
      if (entry.end_time) {
        const endMins = timeToMinutes(entry.end_time)
        maxMinutes = Math.max(maxMinutes, endMins)
      }
    })

    // Include ghost events in time range
    ghostEvents.forEach(event => {
      const startMins = timeToMinutes(event.startTime)
      const endMins = timeToMinutes(event.endTime)
      minMinutes = Math.min(minMinutes, startMins)
      maxMinutes = Math.max(maxMinutes, endMins)
    })

    // If only untimed entries, show a reasonable range
    if (timedEntries.length === 0 && ghostEvents.length === 0) {
      return { startHour: 6, endHour: 22 }
    }

    // Round to nearest hour with padding
    const start = Math.max(0, Math.floor(minMinutes / 60) - 1)
    const end = Math.min(24, Math.ceil(maxMinutes / 60) + 1)

    return { startHour: start, endHour: Math.max(end, start + 4) }
  }, [timedEntries, untimedEntries, ghostEvents])

  // Smart place all entries
  const placedEntries = useMemo(() => {
    return smartPlaceEntries(timedEntries, untimedEntries, startHour, endHour)
  }, [timedEntries, untimedEntries, startHour, endHour])

  const timelineHeight = (endHour - startHour) * HOUR_HEIGHT
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i)

  // Scroll to first entry on load
  useEffect(() => {
    if (placedEntries.length > 0 && scrollContainerRef.current) {
      const firstEntry = placedEntries.reduce((earliest, entry) => {
        return timeToMinutes(entry.placedStartTime) < timeToMinutes(earliest.placedStartTime) ? entry : earliest
      }, placedEntries[0])

      const scrollTo = (timeToMinutes(firstEntry.placedStartTime) - startHour * 60) * PIXELS_PER_MINUTE - 50
      scrollContainerRef.current.scrollTop = Math.max(0, scrollTo)
    }
  }, [placedEntries, startHour])

  const handleEntryClick = (entry: PlacedEntry) => {
    if (entry.isEstimated) {
      // For estimated entries, prompt to add times first
      setSelectedEntry(entry)
      setPromptAddTimes(true)
    } else {
      setSelectedEntry(entry)
      setPromptAddTimes(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600"></div>
      </div>
    )
  }

  if (entries.length === 0 && ghostEvents.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-zinc-500 dark:text-zinc-400">
          {isToday ? "No entries for today yet." : "No entries for this day."}
        </p>
        {isToday && (
          <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
            Use Quick Log or add an entry above.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
        <span>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
        <span className="font-medium">Total: {formatDuration(totalMinutes)}</span>
      </div>

      {/* Timeline container */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <div
          ref={scrollContainerRef}
          className="max-h-[500px] overflow-y-auto"
        >
          <div className="relative flex" style={{ height: timelineHeight }}>
            {/* Hour labels */}
            <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 flex items-start justify-end pr-2"
                  style={{ top: (hour - startHour) * HOUR_HEIGHT - 8 }}
                >
                  <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                    {formatHour(hour)}
                  </span>
                </div>
              ))}
            </div>

            {/* Timeline grid and entries */}
            <div className="relative flex-1">
              {/* Hour grid lines */}
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-zinc-100 dark:border-zinc-700/50"
                  style={{ top: (hour - startHour) * HOUR_HEIGHT }}
                />
              ))}

              {/* Half-hour grid lines */}
              {hours.slice(0, -1).map((hour) => (
                <div
                  key={`${hour}-half`}
                  className="absolute left-0 right-0 border-t border-dashed border-zinc-100 dark:border-zinc-700/30"
                  style={{ top: (hour - startHour) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                />
              ))}

              {/* Entry blocks */}
              {placedEntries.map((entry) => {
                const startMinutes = timeToMinutes(entry.placedStartTime)
                const top = (startMinutes - startHour * 60) * PIXELS_PER_MINUTE
                const height = Math.max(entry.duration_minutes * PIXELS_PER_MINUTE, MIN_BLOCK_HEIGHT)
                const colors = CATEGORY_COLORS[entry.category]
                const isShort = height < 50

                return (
                  <div
                    key={entry.id}
                    onClick={() => handleEntryClick(entry)}
                    className={`absolute left-1 right-1 cursor-pointer overflow-hidden rounded-lg border-l-4 shadow-sm transition-all hover:shadow-md hover:brightness-105 ${colors.bg} ${colors.border} ${entry.isEstimated ? 'opacity-70' : ''}`}
                    style={{ top, height }}
                  >
                    <div className={`flex h-full flex-col justify-center px-2 py-1 ${colors.text}`}>
                      {isShort ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1 truncate text-xs font-medium">
                            {entry.isEstimated && <span className="opacity-70">~</span>}
                            {entry.activity}
                          </span>
                          <span className="shrink-0 text-xs opacity-80">{formatDuration(entry.duration_minutes)}</span>
                        </div>
                      ) : (
                        <>
                          <span className="flex items-center gap-1 truncate text-sm font-medium">
                            {entry.isEstimated && (
                              <span className="rounded bg-white/20 px-1 text-[10px] font-normal">est</span>
                            )}
                            {entry.activity}
                          </span>
                          <div className="mt-0.5 flex items-center gap-2 text-xs opacity-80">
                            <span>
                              {entry.isEstimated ? '~' : ''}{entry.placedStartTime} - {entry.placedEndTime}
                            </span>
                            <span>({formatDuration(entry.duration_minutes)})</span>
                          </div>
                          {entry.description && height > 70 && (
                            <span className="mt-1 truncate text-xs opacity-70">{entry.description}</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Ghost entries (from calendar) */}
              {ghostEvents.map((event) => {
                const startMinutes = timeToMinutes(event.startTime)
                const endMinutes = timeToMinutes(event.endTime)
                const durationMinutes = endMinutes - startMinutes
                const top = (startMinutes - startHour * 60) * PIXELS_PER_MINUTE
                const height = Math.max(durationMinutes * PIXELS_PER_MINUTE, MIN_BLOCK_HEIGHT)
                const isShort = height < 50

                // Check if event has ended (can be confirmed)
                const now = new Date()
                const currentMinutes = now.getHours() * 60 + now.getMinutes()
                const hasEnded = !isToday || currentMinutes >= endMinutes

                return (
                  <div
                    key={`ghost-${event.id}`}
                    onClick={() => onGhostEntryClick?.(event)}
                    className="absolute left-1 right-1 cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-blue-400/60 bg-blue-100/40 opacity-60 transition-all hover:border-blue-500 hover:opacity-80 dark:border-blue-500/40 dark:bg-blue-900/20 dark:hover:border-blue-400"
                    style={{ top, height }}
                  >
                    <div className="flex h-full flex-col justify-center px-2 py-1 text-blue-700 dark:text-blue-300">
                      {isShort ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1 truncate text-xs font-medium">
                            <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {event.title}
                          </span>
                        </div>
                      ) : (
                        <>
                          <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {event.title}
                          </span>
                          <div className="mt-0.5 flex items-center gap-2 text-xs opacity-80">
                            <span>{event.startTime} - {event.endTime}</span>
                            <span>({formatDuration(durationMinutes)})</span>
                          </div>
                          {height > 70 && (
                            <span className="mt-1 text-xs opacity-70">
                              {hasEnded ? 'Tap to confirm' : 'Pending...'}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Current time indicator */}
              {isToday && <CurrentTimeIndicator startHour={startHour} endHour={endHour} />}
            </div>
          </div>
        </div>

        {/* Legend for estimated entries */}
        {untimedEntries.length > 0 && (
          <div className="border-t border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              <span className="mr-1 rounded bg-zinc-200 px-1 dark:bg-zinc-600">est</span>
              = estimated placement (no times set). Click to add actual times.
            </p>
          </div>
        )}
      </div>

      {selectedEntry && (
        <TimeEntryModal
          entry={selectedEntry}
          onClose={() => {
            setSelectedEntry(null)
            setPromptAddTimes(false)
          }}
          onUpdate={() => {
            setSelectedEntry(null)
            setPromptAddTimes(false)
            onEntryDeleted()
          }}
          onDelete={() => {
            setSelectedEntry(null)
            setPromptAddTimes(false)
            onEntryDeleted()
          }}
          promptAddTimes={promptAddTimes}
        />
      )}
    </div>
  )
}

// Current time indicator component
function CurrentTimeIndicator({ startHour, endHour }: { startHour: number; endHour: number }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = startHour * 60
  const endMinutes = endHour * 60

  // Only show if current time is within the visible range
  if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
    return null
  }

  const top = (currentMinutes - startMinutes) * PIXELS_PER_MINUTE

  return (
    <div
      className="absolute left-0 right-0 z-20 flex items-center"
      style={{ top }}
    >
      <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
      <div className="h-0.5 flex-1 bg-red-500" />
    </div>
  )
}
