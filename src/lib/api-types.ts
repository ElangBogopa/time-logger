/**
 * TypeScript types for API request/response payloads
 * Provides type safety for client-server communication
 */

import { TimeCategory, TimeEntry, WeeklyTarget } from './types'

// ============================================================================
// Categorize API
// ============================================================================

export interface CategorizeRequest {
  activity: string
}

export interface CategorizeResponse {
  category: TimeCategory
}

export interface CategorizeError {
  error: string
}

// ============================================================================
// Commentary API
// ============================================================================

export interface CommentaryRequest {
  entry: TimeEntry
  dayEntries: TimeEntry[]
}

export interface CommentaryResponse {
  commentary: string
}

export interface CommentaryError {
  error: string
}

// ============================================================================
// Calendar Events API
// ============================================================================

export interface CalendarEventsParams {
  start?: string  // YYYY-MM-DD
  end?: string    // YYYY-MM-DD
  timezone?: string
}

export interface CalendarEventResponse {
  id: string
  title: string
  startTime: string  // HH:MM
  endTime: string    // HH:MM
  date: string       // YYYY-MM-DD
  isAllDay: boolean
}

export interface CalendarEventsResponse {
  events: CalendarEventResponse[]
}

export interface CalendarEventsError {
  error: string
  code?: 'NO_CALENDAR' | 'SCOPE_INSUFFICIENT' | 'TOKEN_EXPIRED'
  scopes?: string[]
}

// ============================================================================
// Calendar Status API
// ============================================================================

export interface CalendarStatusResponse {
  connected: boolean
  source: 'google_oauth' | 'calendar_connection' | null
  googleEmail: string | null
}

// ============================================================================
// User Preferences API
// ============================================================================

export interface UserPreferencesResponse {
  theme: 'light' | 'dark' | 'system'
  timezone: string
  weekStartsOn: 0 | 1 | 6  // Sunday, Monday, Saturday
}

export interface UpdatePreferencesRequest {
  theme?: 'light' | 'dark' | 'system'
  timezone?: string
  weekStartsOn?: 0 | 1 | 6
}

// ============================================================================
// Auth Check Email API
// ============================================================================

export interface CheckEmailRequest {
  email: string
}

export interface CheckEmailResponse {
  exists: boolean
  hasPassword: boolean
  authProvider: 'google' | 'email' | 'credentials' | null
}

// ============================================================================
// Weekly Review API
// ============================================================================

export interface WeeklyReviewResponse {
  weekStart: string
  weekEnd: string
  totalMinutes: number
  categoryBreakdown: Record<TimeCategory, number>
  dailyTotals: Record<string, number>
  targets: Array<{
    target: WeeklyTarget
    actualMinutes: number
    targetMinutes: number | null
    percentComplete: number | null
  }>
}

// ============================================================================
// Generic API Error
// ============================================================================

export interface ApiError {
  error: string
  code?: string
  details?: unknown
}

// ============================================================================
// Rate Limit Headers
// ============================================================================

export interface RateLimitInfo {
  remaining: number
  resetTime: number  // Unix timestamp
}
