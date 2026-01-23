import {
  TimePeriod,
  TimeEntry,
  SessionState,
  SessionCompletion,
  SessionInfo,
  PERIOD_TIME_RANGES,
  getCurrentPeriod,
  TimeCategory,
  getUserToday,
  getLocalDateString,
  DAY_ROLLOVER_HOUR,
} from './types'
import { timeToMinutes } from './time-utils'

/**
 * Determine the session state based on current time, entries, and completions
 */
export function getSessionState(
  period: TimePeriod,
  entries: TimeEntry[],
  completions: SessionCompletion[],
  currentHour: number = new Date().getHours()
): SessionState {
  const currentPeriod = getCurrentPeriod(currentHour)
  const completion = completions.find(c => c.period === period)

  // Check if session was explicitly completed or skipped
  if (completion) {
    return completion.skipped ? 'skipped' : 'logged'
  }

  // Check if there are entries in this period (auto-logged state)
  const periodEntries = getEntriesForPeriod(entries, period)
  if (periodEntries.length > 0) {
    return 'logged'
  }

  // Determine if upcoming or active based on current time
  const periodOrder: TimePeriod[] = ['morning', 'afternoon', 'evening']
  const currentIndex = periodOrder.indexOf(currentPeriod)
  const periodIndex = periodOrder.indexOf(period)

  if (periodIndex < currentIndex) {
    // Past period with no entries - still show as active so they can log
    return 'active'
  } else if (periodIndex === currentIndex) {
    return 'active'
  } else {
    return 'upcoming'
  }
}

/**
 * Check if yesterday's evening can still be logged.
 * Returns true during morning (3am-12pm) of the new day.
 * During late night (before 3am), user is still in "today" context, so this returns false.
 */
export function canLogYesterdayEvening(currentHour: number = new Date().getHours()): boolean {
  // If it's late night (hour >= 24 means we're using getUserCurrentHour and it's before 3am),
  // user is still in yesterday's context - don't prompt for "yesterday's evening"
  if (currentHour >= 24) return false

  // Only show prompt during morning of the new day (3am - noon)
  return currentHour >= DAY_ROLLOVER_HOUR && currentHour < 12
}

/**
 * Get yesterday's date string in YYYY-MM-DD format.
 * "Yesterday" is relative to the user's current day, which accounts for late-night rollover.
 */
export function getYesterdayDateString(): string {
  const userToday = getUserToday()
  const todayDate = new Date(userToday + 'T12:00:00') // Noon to avoid timezone edge cases
  todayDate.setDate(todayDate.getDate() - 1)
  return getLocalDateString(todayDate)
}

/**
 * Filter entries to a specific period based on start_time
 */
export function getEntriesForPeriod(entries: TimeEntry[], period: TimePeriod): TimeEntry[] {
  const range = PERIOD_TIME_RANGES[period]
  return entries.filter(entry => {
    if (!entry.start_time) return false
    const hour = parseInt(entry.start_time.split(':')[0])
    return hour >= range.start && hour < range.end
  })
}

/**
 * Split an entry's duration across periods it spans
 * Returns a map of period -> minutes attributed to that period
 */
export function splitEntryByPeriod(entry: TimeEntry): Map<TimePeriod, number> {
  const result = new Map<TimePeriod, number>()

  if (!entry.start_time || !entry.end_time) {
    // No time info, attribute to current period
    const currentPeriod = getCurrentPeriod()
    result.set(currentPeriod, entry.duration_minutes)
    return result
  }

  const startMins = timeToMinutes(entry.start_time)
  const endMins = timeToMinutes(entry.end_time)

  const periods: TimePeriod[] = ['morning', 'afternoon', 'evening']

  for (const period of periods) {
    const range = PERIOD_TIME_RANGES[period]
    const periodStartMins = range.start * 60
    const periodEndMins = range.end * 60

    const overlapStart = Math.max(startMins, periodStartMins)
    const overlapEnd = Math.min(endMins, periodEndMins)

    if (overlapStart < overlapEnd) {
      result.set(period, overlapEnd - overlapStart)
    }
  }

  return result
}

/**
 * Calculate session stats (entry count, total minutes, category breakdown)
 */
export function getSessionStats(
  entries: TimeEntry[],
  period: TimePeriod
): {
  entryCount: number
  totalMinutes: number
  categories: Map<TimeCategory, number>
} {
  const periodEntries = getEntriesForPeriod(entries, period)

  let totalMinutes = 0
  const categories = new Map<TimeCategory, number>()

  for (const entry of periodEntries) {
    // Get the portion of this entry that belongs to this period
    const periodSplit = splitEntryByPeriod(entry)
    const minutesInPeriod = periodSplit.get(period) || entry.duration_minutes

    totalMinutes += minutesInPeriod

    if (entry.category) {
      const current = categories.get(entry.category) || 0
      categories.set(entry.category, current + minutesInPeriod)
    }
  }

  return {
    entryCount: periodEntries.length,
    totalMinutes,
    categories,
  }
}

/**
 * Build session info for all three periods
 */
export function buildSessionInfos(
  entries: TimeEntry[],
  completions: SessionCompletion[],
  currentHour: number = new Date().getHours()
): SessionInfo[] {
  const periods: TimePeriod[] = ['morning', 'afternoon', 'evening']

  return periods.map(period => {
    const state = getSessionState(period, entries, completions, currentHour)
    const stats = getSessionStats(entries, period)
    const completion = completions.find(c => c.period === period)

    return {
      period,
      state,
      entryCount: stats.entryCount,
      totalMinutes: stats.totalMinutes,
      completedAt: completion?.completed_at,
    }
  })
}

/**
 * Get the period start time as a display string (e.g., "6:00 AM")
 */
export function getPeriodStartTime(period: TimePeriod): string {
  const range = PERIOD_TIME_RANGES[period]
  const hour = range.start
  if (hour === 0) return '12:00 AM'
  if (hour < 12) return `${hour}:00 AM`
  if (hour === 12) return '12:00 PM'
  return `${hour - 12}:00 PM`
}

/**
 * Get the period end time as a display string (e.g., "12:00 PM")
 */
export function getPeriodEndTime(period: TimePeriod): string {
  const range = PERIOD_TIME_RANGES[period]
  const hour = range.end
  if (hour === 0 || hour === 24) return '12:00 AM'
  if (hour < 12) return `${hour}:00 AM`
  if (hour === 12) return '12:00 PM'
  return `${hour - 12}:00 PM`
}

/**
 * Get flexible time range for logging (allows some spillover)
 * Morning session can log entries starting from 6am to 2pm
 */
export function getFlexiblePeriodRange(period: TimePeriod): { start: number; end: number } {
  const base = PERIOD_TIME_RANGES[period]
  return {
    start: Math.max(0, base.start - 2),  // Allow 2 hours before
    end: Math.min(24, base.end + 2),     // Allow 2 hours after
  }
}

/**
 * Format duration as human-readable string
 */
export function formatSessionDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) {
    return `${hours}h`
  }
  return `${hours}h ${mins}m`
}

/**
 * Find the first available time gap within a session period.
 * Returns start/end times for the gap, capped at maxDurationMins.
 *
 * @param entries - All entries for the day (will be filtered to period)
 * @param period - The session period (morning, afternoon, evening)
 * @param maxDurationMins - Maximum duration for the suggested gap (default 60)
 * @param currentTimeMins - Current time in minutes from midnight (optional, for limiting to past times)
 * @returns { startTime, endTime } or null if no gap available
 */
export function findFirstGapInPeriod(
  entries: TimeEntry[],
  period: TimePeriod,
  maxDurationMins: number = 60,
  currentTimeMins?: number
): { startTime: string; endTime: string } | null {
  const periodRange = PERIOD_TIME_RANGES[period]
  const periodStartMins = periodRange.start * 60
  const periodEndMins = periodRange.end * 60

  // Determine the effective end of the searchable range
  // If current time is provided and within the period, don't suggest future times
  let effectiveEndMins = periodEndMins
  if (currentTimeMins !== undefined) {
    if (currentTimeMins >= periodStartMins && currentTimeMins < periodEndMins) {
      // Within period - limit to current time
      effectiveEndMins = currentTimeMins
    } else if (currentTimeMins < periodStartMins) {
      // Before period starts - no gap available yet
      return null
    }
    // After period ends - use full period (they're logging past activities)
  }

  // Filter entries that overlap with this period
  // An entry overlaps if its time range intersects with the period
  const overlappingEntries = entries
    .filter(e => e.start_time && e.end_time)
    .map(e => {
      const entryStart = timeToMinutes(e.start_time!)
      const entryEnd = timeToMinutes(e.end_time!)
      return { start: entryStart, end: entryEnd }
    })
    .filter(e => {
      // Entry overlaps with period if: entry.start < period.end AND entry.end > period.start
      return e.start < periodEndMins && e.end > periodStartMins
    })
    // Clamp entry times to period bounds
    .map(e => ({
      start: Math.max(e.start, periodStartMins),
      end: Math.min(e.end, periodEndMins)
    }))
    .sort((a, b) => a.start - b.start)

  // Find gaps
  // If there are entries, start searching from the first entry's start time
  // This avoids suggesting gaps before the user started logging (e.g., midnight to 8am)
  // If no entries, start from period start
  let searchStart = overlappingEntries.length > 0
    ? overlappingEntries[0].start
    : periodStartMins

  for (const entry of overlappingEntries) {
    // If there's a gap before this entry
    if (entry.start > searchStart) {
      const gapEnd = Math.min(entry.start, effectiveEndMins)
      if (gapEnd > searchStart) {
        const gapDuration = gapEnd - searchStart
        const suggestedDuration = Math.min(gapDuration, maxDurationMins)
        return {
          startTime: minsToTimeString(searchStart),
          endTime: minsToTimeString(searchStart + suggestedDuration)
        }
      }
    }
    // Move search start past this entry
    searchStart = Math.max(searchStart, entry.end)
  }

  // Check for gap after last entry
  if (searchStart < effectiveEndMins) {
    const gapDuration = effectiveEndMins - searchStart
    const suggestedDuration = Math.min(gapDuration, maxDurationMins)
    return {
      startTime: minsToTimeString(searchStart),
      endTime: minsToTimeString(searchStart + suggestedDuration)
    }
  }

  return null
}

/**
 * Convert minutes from midnight to HH:MM string
 * Handles 24:00 (1440 mins) as a special case for end of day
 */
function minsToTimeString(mins: number): string {
  // Handle 24:00 (end of day) specially
  if (mins >= 1440) {
    return '24:00'
  }
  const hours = Math.floor(mins / 60)
  const minutes = mins % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}
