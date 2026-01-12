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

export interface TimeEntry {
  id: string
  user_id: string
  date: string
  activity: string
  category: TimeCategory
  duration_minutes: number
  start_time: string | null
  end_time: string | null
  description: string | null
  commentary: string | null
  created_at: string
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
