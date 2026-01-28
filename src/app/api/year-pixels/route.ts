import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import {
  TimeEntry,
  WeeklyTarget,
  WeeklyTargetType,
  WEEKLY_TARGET_CONFIGS,
  calculateTargetProgress,
  SessionCompletion,
} from '@/lib/types'

interface DayPixel {
  date: string
  score: number | null // null = no data
  entryCount: number
  totalMinutes: number
}

/**
 * GET /api/year-pixels?year=2025
 * Returns day-by-day score data for the entire year.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const url = new URL(request.url)
  const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()))

  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  try {
    // Fetch all confirmed entries for the year
    const [entriesResult, targetsResult, completionsResult] = await Promise.all([
      supabase
        .from('time_entries')
        .select('date, category, duration_minutes, status')
        .eq('user_id', userId)
        .eq('status', 'confirmed')
        .gte('date', yearStart)
        .lte('date', yearEnd)
        .order('date'),

      supabase
        .from('weekly_targets')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('sort_order'),

      supabase
        .from('session_completions')
        .select('date, skipped')
        .eq('user_id', userId)
        .gte('date', yearStart)
        .lte('date', yearEnd),
    ])

    const entries = (entriesResult.data || []) as Pick<TimeEntry, 'date' | 'category' | 'duration_minutes' | 'status'>[]
    const targets = (targetsResult.data || []) as WeeklyTarget[]
    const completions = (completionsResult.data || []) as Pick<SessionCompletion, 'date' | 'skipped'>[]

    // Group entries by date
    const entriesByDate = new Map<string, typeof entries>()
    for (const entry of entries) {
      const existing = entriesByDate.get(entry.date) || []
      existing.push(entry)
      entriesByDate.set(entry.date, existing)
    }

    // Group completions by date
    const completionsByDate = new Map<string, number>()
    for (const c of completions) {
      if (!c.skipped) {
        completionsByDate.set(c.date, (completionsByDate.get(c.date) || 0) + 1)
      }
    }

    // Calculate score for each day
    const pixels: DayPixel[] = []
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    // Iterate through each day of the year
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31)

    for (let d = new Date(startDate); d <= endDate && d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      const dayEntries = entriesByDate.get(dateStr) || []
      const entryCount = dayEntries.length
      const totalMinutes = dayEntries.reduce((sum, e) => sum + e.duration_minutes, 0)

      if (entryCount === 0) {
        pixels.push({ date: dateStr, score: null, entryCount: 0, totalMinutes: 0 })
        continue
      }

      // Calculate score similar to day-summary
      const sessionsLogged = completionsByDate.get(dateStr) || 0

      // Calculate target progress for the day
      if (targets.length > 0) {
        const targetProgressValues: number[] = []

        for (const target of targets) {
          const config = WEEKLY_TARGET_CONFIGS[target.target_type as WeeklyTargetType]
          if (!config) continue

          const categories = config.categories
          const dailyTarget = Math.round(target.weekly_target_minutes / 7)

          const todayMinutes = dayEntries
            .filter(e => e.category && categories.includes(e.category as never))
            .reduce((sum, e) => sum + e.duration_minutes, 0)

          const progress = calculateTargetProgress(
            todayMinutes,
            dailyTarget,
            target.direction as 'at_least' | 'at_most'
          )
          targetProgressValues.push(progress)
        }

        if (targetProgressValues.length > 0) {
          const avgTargetProgress = targetProgressValues.reduce((sum, p) => sum + p, 0) / targetProgressValues.length
          const sessionScore = (sessionsLogged / Math.max(3, 1)) * 100
          const score = Math.round(avgTargetProgress * 0.7 + sessionScore * 0.3)
          pixels.push({ date: dateStr, score: Math.min(100, score), entryCount, totalMinutes })
        } else {
          // Fallback: score based on session logging
          const score = Math.round((sessionsLogged / 3) * 100)
          pixels.push({ date: dateStr, score: Math.min(100, Math.max(score, entryCount > 0 ? 30 : 0)), entryCount, totalMinutes })
        }
      } else {
        // No targets: score based on activity level
        // 0 entries = null, 1-3 entries = 30-50, 4-6 = 50-70, 7+ = 70-100
        let score: number
        if (entryCount <= 3) {
          score = 20 + entryCount * 10
        } else if (entryCount <= 6) {
          score = 40 + (entryCount - 3) * 10
        } else {
          score = Math.min(100, 60 + (entryCount - 6) * 5)
        }

        // Boost by session completions
        if (sessionsLogged > 0) {
          score = Math.min(100, score + sessionsLogged * 10)
        }

        pixels.push({ date: dateStr, score, entryCount, totalMinutes })
      }
    }

    return NextResponse.json({ year, pixels })
  } catch (error) {
    console.error('Error fetching year pixels:', error)
    return NextResponse.json({ error: 'Failed to fetch year pixels' }, { status: 500 })
  }
}
