/**
 * Shared time and duration utility functions
 * Consolidates duplicated logic from multiple components
 */

/**
 * Convert a time string (HH:MM) to total minutes from midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Convert total minutes to a time string (HH:MM)
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Format a duration in minutes to a human-readable string
 * @example formatDuration(90) => "1h 30m"
 * @example formatDuration(45) => "45m"
 * @example formatDuration(120) => "2h"
 */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

/**
 * Format a duration with full words (for accessibility/speech)
 * @example formatDurationLong(90) => "1 hour 30 minutes"
 */
export function formatDurationLong(minutes: number): string {
  if (minutes <= 0) return '0 minutes'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  const hourStr = `${hours} hour${hours === 1 ? '' : 's'}`
  if (mins === 0) return hourStr
  return `${hourStr} ${mins} minute${mins === 1 ? '' : 's'}`
}

/**
 * Format time for display in 12-hour format
 * @example formatTimeDisplay("14:30") => "2:30 PM"
 */
export function formatTimeDisplay(time: string): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`
}

/**
 * Format hour for timeline display
 * @example formatHour(0) => "12am"
 * @example formatHour(13) => "1pm"
 */
export function formatHour(hour: number): string {
  if (hour === 0) return '12am'
  if (hour === 12) return '12pm'
  if (hour < 12) return `${hour}am`
  return `${hour - 12}pm`
}

/**
 * Calculate duration between two time strings in minutes
 * Handles crossing midnight (e.g., 23:00 to 01:00 = 2 hours)
 */
export function calculateDuration(start: string, end: string): number {
  if (!start || !end) return 0
  const startMinutes = timeToMinutes(start)
  let endMinutes = timeToMinutes(end)

  // Handle crossing midnight
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60
  }

  return endMinutes - startMinutes
}

/**
 * Add minutes to a time string
 * @example addMinutesToTime("14:30", 45) => "15:15"
 */
export function addMinutesToTime(time: string, minutesToAdd: number): string {
  const totalMinutes = timeToMinutes(time) + minutesToAdd
  return minutesToTime(totalMinutes)
}

/**
 * Round a Date to the nearest 15-minute interval
 * @example roundToNearest15(new Date("2024-01-01 14:37")) => "14:45"
 */
export function roundToNearest15(date: Date = new Date()): string {
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

/**
 * Get the current time as a HH:MM string
 */
export function getCurrentTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/**
 * Check if a time is within a range (inclusive)
 */
export function isTimeInRange(time: string, rangeStart: string, rangeEnd: string): boolean {
  const t = timeToMinutes(time)
  const start = timeToMinutes(rangeStart)
  let end = timeToMinutes(rangeEnd)

  // Handle ranges crossing midnight
  if (end < start) {
    return t >= start || t <= end
  }

  return t >= start && t <= end
}

/**
 * Get time of day description from a time string
 */
export function getTimeOfDay(time: string | null): string {
  if (!time) return 'sometime today'
  const hour = parseInt(time.split(':')[0], 10)
  if (hour < 6) return 'early morning'
  if (hour < 9) return 'morning'
  if (hour < 12) return 'late morning'
  if (hour < 14) return 'around midday'
  if (hour < 17) return 'afternoon'
  if (hour < 20) return 'evening'
  return 'night'
}

/**
 * Format hours for stats display
 * @example formatHours(150) => "2h 30m"
 */
export function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}
