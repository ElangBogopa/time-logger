export type TimeCategory =
  | 'deep_work'
  | 'meetings'
  | 'admin'
  | 'learning'
  | 'exercise'
  | 'rest'
  | 'meals'
  | 'self_care'
  | 'relationships'
  | 'distraction'
  | 'other'

export type EntryStatus = 'confirmed' | 'pending'

export interface TimeEntry {
  id: string
  user_id: string
  date: string
  activity: string
  category: TimeCategory | null  // null for pending entries until confirmed
  duration_minutes: number
  start_time: string | null
  end_time: string | null
  description: string | null
  commentary: string | null
  status: EntryStatus
  created_at: string
}

// Static commentary messages for pending entries
export const PENDING_COMMENTARY = {
  planned: 'Planned - confirm after it happens',
  calendar: 'Imported from calendar - confirm to categorize',
}

export const CATEGORY_LABELS: Record<TimeCategory, string> = {
  deep_work: 'Deep Work',
  meetings: 'Meetings',
  admin: 'Admin',
  learning: 'Learning',
  exercise: 'Exercise',
  rest: 'Rest',
  meals: 'Meals',
  self_care: 'Self Care',
  relationships: 'Relationships',
  distraction: 'Distraction',
  other: 'Other',
}

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as TimeCategory[]

/**
 * Returns a date string in YYYY-MM-DD format using the user's local timezone.
 * This ensures "today" is based on the browser's local time, not UTC.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Checks if a given date + end time is in the future.
 * Used to determine if an entry should be marked as "pending".
 */
export function isEntryInFuture(date: string, endTime: string | null): boolean {
  if (!endTime) return false

  const now = new Date()
  const [hours, minutes] = endTime.split(':').map(Number)
  const entryEnd = new Date(date + 'T00:00:00')
  entryEnd.setHours(hours, minutes, 0, 0)

  return entryEnd > now
}

/**
 * Checks if a pending entry's end time has passed and is ready to confirm.
 */
export function isPendingEntryReadyToConfirm(entry: TimeEntry): boolean {
  if (entry.status !== 'pending') return false
  if (!entry.end_time) return false

  return !isEntryInFuture(entry.date, entry.end_time)
}
