export type TimeCategory =
  | 'deep_work'
  | 'meetings'
  | 'admin'
  | 'learning'
  | 'exercise'
  | 'rest'
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
  relationships: 'Relationships',
  distraction: 'Distraction',
  other: 'Other',
}

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as TimeCategory[]
