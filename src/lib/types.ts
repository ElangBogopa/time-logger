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

// Intention types for user goals
export type IntentionType =
  | 'deep_work'
  | 'less_distraction'
  | 'work_life_balance'
  | 'exercise'
  | 'self_care'
  | 'relationships'
  | 'learning'
  | 'custom'

export interface UserIntention {
  id: string
  user_id: string
  intention_type: IntentionType
  custom_text: string | null
  weekly_target_minutes: number | null
  priority: number // 1-3
  active: boolean
  created_at: string
}

// Reminder time configuration
export interface ReminderTime {
  id: string
  label: string
  time: string // HH:MM format
  enabled: boolean
}

// User preferences
export interface UserPreferences {
  id: string
  user_id: string
  reminder_enabled: boolean
  reminder_times: ReminderTime[]
  created_at: string
  updated_at: string
}

// Default reminder times
export const DEFAULT_REMINDER_TIMES: ReminderTime[] = [
  { id: 'midday', label: 'Midday check-in', time: '12:00', enabled: true },
  { id: 'evening', label: 'Evening check-in', time: '18:00', enabled: true },
  { id: 'night', label: 'Night check-in', time: '21:00', enabled: true },
]

export const INTENTION_LABELS: Record<IntentionType, string> = {
  deep_work: 'Deep focused work',
  less_distraction: 'Less scrolling & distractions',
  work_life_balance: 'Better work-life balance',
  exercise: 'Consistent exercise',
  self_care: 'More rest & self-care',
  relationships: 'Quality time with people',
  learning: 'More learning',
  custom: 'Custom goal',
}

export const INTENTION_DESCRIPTIONS: Record<IntentionType, string> = {
  deep_work: 'Spend more time in focused, uninterrupted work sessions',
  less_distraction: 'Reduce time spent on social media and aimless browsing',
  work_life_balance: 'Create clearer boundaries between work and personal time',
  exercise: 'Build a regular exercise habit and stay active',
  self_care: 'Prioritize rest, recovery, and taking care of yourself',
  relationships: 'Make time for friends, family, and meaningful connections',
  learning: 'Dedicate time to learning new skills and knowledge',
  custom: 'Set your own personalized goal',
}

// Map intentions to relevant time categories for tracking
export const INTENTION_CATEGORY_MAP: Record<IntentionType, TimeCategory[]> = {
  deep_work: ['deep_work'],
  less_distraction: ['distraction'], // Track to minimize
  work_life_balance: ['rest', 'relationships', 'self_care'],
  exercise: ['exercise'],
  self_care: ['self_care', 'rest'],
  relationships: ['relationships'],
  learning: ['learning'],
  custom: [], // User defines what to track
}

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
 * Maximum number of days in the past that users can log new entries.
 * Today = 0, yesterday = 1, 2 days ago = 2
 */
export const MAX_DAYS_BACK_FOR_LOGGING = 2

/**
 * Checks if a date is within the loggable range (today, yesterday, or 2 days ago).
 * Returns true if the date is loggable, false if it's too far in the past.
 */
export function isDateLoggable(dateStr: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const targetDate = new Date(dateStr + 'T00:00:00')
  targetDate.setHours(0, 0, 0, 0)

  // Calculate days difference
  const diffTime = today.getTime() - targetDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  // Allow today (0), yesterday (1), and 2 days ago (2)
  // Also allow future dates (diffDays < 0)
  return diffDays <= MAX_DAYS_BACK_FOR_LOGGING
}

/**
 * Returns a human-readable message explaining why logging is disabled.
 */
export const LOGGING_DISABLED_MESSAGE = "You can only log activities from the past 2 days. Try to log closer to when things happen!"

/**
 * Returns a message for the viewing-only state.
 */
export const VIEWING_PAST_MESSAGE = "You're viewing past entries. Logging is only available for the last 2 days."

/**
 * Checks if a pending entry's end time has passed and is ready to confirm.
 */
export function isPendingEntryReadyToConfirm(entry: TimeEntry): boolean {
  if (entry.status !== 'pending') return false
  if (!entry.end_time) return false

  return !isEntryInFuture(entry.date, entry.end_time)
}
