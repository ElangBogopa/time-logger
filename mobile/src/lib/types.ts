/**
 * Shared types for Time Logger mobile app
 * Mirrors the web app types in /src/lib/types.ts
 */

// Time category enum - matches Supabase enum
export type TimeCategory =
  | 'deep_work'
  | 'learning'
  | 'meetings'
  | 'admin'
  | 'exercise'
  | 'rest'
  | 'meals'
  | 'self_care'
  | 'relationships'
  | 'distraction'
  | 'other'

// Entry status
export type EntryStatus = 'pending' | 'confirmed'

// Main time entry type
export interface TimeEntry {
  id: string
  user_id: string
  date: string // YYYY-MM-DD format
  activity: string
  category: TimeCategory | null
  duration_minutes: number
  start_time: string | null // HH:MM format
  end_time: string | null // HH:MM format
  description: string | null
  commentary: string | null
  status: EntryStatus
  created_at: string
  source?: 'manual' | 'calendar' | null
  calendar_event_id?: string | null
}

// Intention types
export type IntentionType =
  | 'deep_work'
  | 'exercise'
  | 'less_distraction'
  | 'learning'
  | 'relationships'

export interface UserIntention {
  id: string
  user_id: string
  intention_type: IntentionType
  weekly_target_minutes: number | null
  active: boolean
  created_at: string
}

// Streak types
export type StreakType =
  | 'deep_work'
  | 'exercise'
  | 'focus'
  | 'learning'
  | 'relationships'

export interface StreakConfig {
  label: string
  emoji: string
  description: string
  categories: TimeCategory[]
  defaultThresholdMinutes: number
  milestones: number[]
}

export interface UserStreak {
  id: string
  user_id: string
  streak_type: StreakType
  current_streak_days: number
  personal_best_days: number
  personal_best_achieved_at: string | null
  current_streak_start_date: string | null
  last_calculated_at: string
}

// Category display config
export interface CategoryConfig {
  label: string
  color: string
  darkColor: string
  bgColor: string
  darkBgColor: string
}

export const CATEGORY_COLORS: Record<TimeCategory, CategoryConfig> = {
  deep_work: {
    label: 'Deep Work',
    color: '#6366f1',
    darkColor: '#818cf8',
    bgColor: '#eef2ff',
    darkBgColor: '#312e81',
  },
  learning: {
    label: 'Learning',
    color: '#8b5cf6',
    darkColor: '#a78bfa',
    bgColor: '#f3e8ff',
    darkBgColor: '#3b0764',
  },
  meetings: {
    label: 'Meetings',
    color: '#06b6d4',
    darkColor: '#22d3ee',
    bgColor: '#ecfeff',
    darkBgColor: '#083344',
  },
  admin: {
    label: 'Admin',
    color: '#64748b',
    darkColor: '#94a3b8',
    bgColor: '#f8fafc',
    darkBgColor: '#1e293b',
  },
  exercise: {
    label: 'Exercise',
    color: '#22c55e',
    darkColor: '#4ade80',
    bgColor: '#f0fdf4',
    darkBgColor: '#14532d',
  },
  rest: {
    label: 'Rest',
    color: '#f59e0b',
    darkColor: '#fbbf24',
    bgColor: '#fffbeb',
    darkBgColor: '#451a03',
  },
  meals: {
    label: 'Meals',
    color: '#f97316',
    darkColor: '#fb923c',
    bgColor: '#fff7ed',
    darkBgColor: '#431407',
  },
  self_care: {
    label: 'Self Care',
    color: '#ec4899',
    darkColor: '#f472b6',
    bgColor: '#fdf2f8',
    darkBgColor: '#500724',
  },
  relationships: {
    label: 'Relationships',
    color: '#ef4444',
    darkColor: '#f87171',
    bgColor: '#fef2f2',
    darkBgColor: '#450a0a',
  },
  distraction: {
    label: 'Distraction',
    color: '#a3a3a3',
    darkColor: '#d4d4d4',
    bgColor: '#fafafa',
    darkBgColor: '#262626',
  },
  other: {
    label: 'Other',
    color: '#78716c',
    darkColor: '#a8a29e',
    bgColor: '#fafaf9',
    darkBgColor: '#292524',
  },
}

// Helper to get local date string (YYYY-MM-DD)
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Parse date string to Date object (in local timezone)
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}
