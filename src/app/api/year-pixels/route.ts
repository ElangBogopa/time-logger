import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import {
  TimeEntry,
  getLocalDateString,
} from '@/lib/types'
import { EntryRow, calcBody, calcFocus, calcSocial, countMetricsOnTarget } from '@/lib/metrics-calc'

interface DayPixel {
  date: string
  /** Body, Mind and Heart for the day, or null when nothing was logged. */
  metrics: { body: number; focus: number; social: number } | null
  /** How many of the three reached their target: the grid's colour. */
  onTarget: number
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
    // The day is scored from what was logged, so the session_completions
    // query that used to boost the score by 10 a session is gone with it.
    const entriesResult = await supabase
      .from('time_entries')
      .select('date, activity, category, duration_minutes, status')
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .gte('date', yearStart)
      .lte('date', yearEnd)
      .order('date')

    const entries = (entriesResult.data || []) as Pick<TimeEntry, 'date' | 'category' | 'duration_minutes' | 'status'>[]

    // Group entries by date
    const entriesByDate = new Map<string, typeof entries>()
    for (const entry of entries) {
      const existing = entriesByDate.get(entry.date) || []
      existing.push(entry)
      entriesByDate.set(entry.date, existing)
    }

    // Calculate score for each day
    const pixels: DayPixel[] = []
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    // Iterate through each day of the year
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31)

    for (let d = new Date(startDate); d <= endDate && d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = getLocalDateString(d)
      const dayEntries = entriesByDate.get(dateStr) || []
      const entryCount = dayEntries.length
      const totalMinutes = dayEntries.reduce((sum, e) => sum + e.duration_minutes, 0)

      if (entryCount === 0) {
        pixels.push({ date: dateStr, metrics: null, onTarget: 0, entryCount: 0, totalMinutes: 0 })
        continue
      }

      /**
       * The day's real scores. This used to be 20 + entryCount × 10, rising
       * with the number of entries and boosted by 10 for each session marked
       * done — so the grid coloured by how diligently the day was logged,
       * and six short entries beat four hours of deep work.
       */
      const rows = dayEntries as EntryRow[]
      pixels.push({
        date: dateStr,
        metrics: {
          body: calcBody(rows),
          focus: calcFocus(rows),
          social: calcSocial(rows),
        },
        onTarget: countMetricsOnTarget(rows),
        entryCount,
        totalMinutes,
      })
    }

    return NextResponse.json({ year, pixels })
  } catch (error) {
    console.error('Error fetching year pixels:', error)
    return NextResponse.json({ error: 'Failed to fetch year pixels' }, { status: 500 })
  }
}
