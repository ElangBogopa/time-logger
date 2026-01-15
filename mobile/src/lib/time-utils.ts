/**
 * Time and duration utility functions for mobile app
 * Mirrors the web app utilities in /src/lib/time-utils.ts
 */

/**
 * Convert a time string (HH:MM) to total minutes from midnight
 * Handles "24:00" as 1440 minutes (end-of-day midnight)
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Convert total minutes to a time string (HH:MM)
 * Handles 1440 (24*60) as "24:00" for end-of-day midnight
 */
export function minutesToTime(minutes: number): string {
  if (minutes === 24 * 60) {
    return '24:00'
  }
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Format a duration in minutes to a human-readable string
 */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

/**
 * Format time for display in 12-hour format
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
 */
export function formatHour(hour: number): string {
  if (hour === 0) return '12am'
  if (hour === 12) return '12pm'
  if (hour < 12) return `${hour}am`
  return `${hour - 12}pm`
}

/**
 * Calculate duration between two time strings in minutes
 */
export function calculateDuration(start: string, end: string): number {
  if (!start || !end) return 0
  const startMinutes = timeToMinutes(start)
  let endMinutes = timeToMinutes(end)

  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60
  }

  return endMinutes - startMinutes
}

/**
 * Round a Date to the nearest 15-minute interval
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
