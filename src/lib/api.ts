/**
 * Client-side API helper for all database operations.
 * Replaces direct Supabase client usage to enforce server-side auth and RLS.
 * All requests go through Next.js API routes which use the service role key.
 */

import { TimeEntry, TimeCategory, WeeklyTarget, WeeklyTargetType } from './types'
import { CorrelationsResponse } from './correlation-types'

export function getCsrfToken(): string {
  const match = document.cookie.match(/csrf-token=([^;]+)/)
  return match ? match[1] : ''
}

/**
 * Drop-in fetch replacement that auto-injects CSRF token on mutating requests.
 * Use this instead of raw fetch() for any POST/PUT/DELETE to API routes.
 */
export async function csrfFetch(url: string, options?: RequestInit): Promise<Response> {
  const method = options?.method?.toUpperCase() || 'GET'
  const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  
  const headers = new Headers(options?.headers)
  
  if (needsCsrf) {
    const csrfToken = getCsrfToken()
    if (csrfToken) {
      headers.set('x-csrf-token', csrfToken)
    }
  }
  
  return fetch(url, { ...options, headers })
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  // Add CSRF token header for mutating requests
  const method = options?.method?.toUpperCase() || 'GET'
  const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  
  const headers = new Headers(options?.headers)
  
  if (needsCsrf) {
    const csrfToken = getCsrfToken()
    if (csrfToken) {
      headers.set('x-csrf-token', csrfToken)
    }
  }
  
  const res = await fetch(url, {
    ...options,
    headers,
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// ============================================================
// TIME ENTRIES
// ============================================================

interface FetchEntriesParams {
  date?: string
  dateFrom?: string
  dateTo?: string
  status?: string
  fields?: string
  orderBy?: string
  orderAsc?: boolean
}

export async function fetchEntries(params: FetchEntriesParams = {}): Promise<TimeEntry[]> {
  const searchParams = new URLSearchParams()
  if (params.date) searchParams.set('date', params.date)
  if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom)
  if (params.dateTo) searchParams.set('dateTo', params.dateTo)
  if (params.status) searchParams.set('status', params.status)
  if (params.fields) searchParams.set('fields', params.fields)
  if (params.orderBy) searchParams.set('orderBy', params.orderBy)
  if (params.orderAsc !== undefined) searchParams.set('orderAsc', String(params.orderAsc))

  const { data } = await fetchJSON<{ data: TimeEntry[] }>(`/api/entries?${searchParams}`)
  return data
}

interface CreateEntryParams {
  date: string
  activity: string
  category?: TimeCategory | null
  duration_minutes: number
  start_time?: string | null
  end_time?: string | null
  description?: string | null
  commentary?: string | null
  status?: 'pending' | 'confirmed'
}

export async function createEntry(params: CreateEntryParams): Promise<TimeEntry> {
  const { data } = await fetchJSON<{ data: TimeEntry }>('/api/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return data
}

export async function updateEntry(id: string, updates: Partial<TimeEntry>): Promise<TimeEntry> {
  const { data } = await fetchJSON<{ data: TimeEntry }>(`/api/entries/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  return data
}

export async function deleteEntry(id: string): Promise<void> {
  await fetchJSON(`/api/entries/${id}`, { method: 'DELETE' })
}

// ============================================================
// SESSION COMPLETIONS
// ============================================================

interface SessionCompletionData {
  id: string
  user_id: string
  date: string
  period: string
  entry_count: number
  total_minutes: number
  skipped: boolean
  completed_at: string
  created_at: string
}

interface FetchSessionCompletionsParams {
  date?: string
  period?: string
}

export async function fetchSessionCompletions(
  params: FetchSessionCompletionsParams = {}
): Promise<SessionCompletionData[]> {
  const searchParams = new URLSearchParams()
  if (params.date) searchParams.set('date', params.date)
  if (params.period) searchParams.set('period', params.period)

  const { data } = await fetchJSON<{ data: SessionCompletionData[] }>(
    `/api/session-completions?${searchParams}`
  )
  return data
}

interface UpsertSessionCompletionParams {
  date: string
  period: string
  entry_count?: number
  total_minutes?: number
  skipped?: boolean
}

export async function upsertSessionCompletion(
  params: UpsertSessionCompletionParams
): Promise<SessionCompletionData> {
  const { data } = await fetchJSON<{ data: SessionCompletionData }>('/api/session-completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return data
}

// ============================================================
// STREAKS
// ============================================================

interface UserStreak {
  id: string
  user_id: string
  streak_type: string
  personal_best_days: number
  personal_best_achieved_at: string | null
  current_streak_days: number
  current_streak_start_date: string | null
  last_calculated_at: string
}

export async function fetchStreaks(): Promise<UserStreak[]> {
  const { data } = await fetchJSON<{ data: UserStreak[] }>('/api/streaks')
  return data
}

interface UpsertStreakParams {
  streak_type: string
  personal_best_days?: number
  personal_best_achieved_at?: string | null
  current_streak_days?: number
  current_streak_start_date?: string | null
}

export async function upsertStreak(params: UpsertStreakParams): Promise<UserStreak> {
  const { data } = await fetchJSON<{ data: UserStreak }>('/api/streaks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return data
}

// ============================================================
// WEEKLY TARGETS
// ============================================================

export async function fetchWeeklyTargets(): Promise<WeeklyTarget[]> {
  const { targets } = await fetchJSON<{ targets: WeeklyTarget[] }>('/api/targets')
  return targets
}

export async function createWeeklyTargets(
  targets: Array<{ target_type: WeeklyTargetType; weekly_target_minutes: number }>
): Promise<WeeklyTarget[]> {
  const { targets: created } = await fetchJSON<{ targets: WeeklyTarget[] }>('/api/targets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targets }),
  })
  return created
}

export async function updateWeeklyTarget(
  id: string,
  updates: { weekly_target_minutes?: number; sort_order?: number; active?: boolean }
): Promise<WeeklyTarget> {
  const { target } = await fetchJSON<{ target: WeeklyTarget }>(`/api/targets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  return target
}

export async function deleteWeeklyTarget(id: string): Promise<void> {
  await fetchJSON(`/api/targets/${id}`, { method: 'DELETE' })
}

// ============================================================
// CORRELATIONS / INSIGHTS
// ============================================================

export async function fetchCorrelations(): Promise<CorrelationsResponse> {
  return fetchJSON<CorrelationsResponse>('/api/correlations')
}
