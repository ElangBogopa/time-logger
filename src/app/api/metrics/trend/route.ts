import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { getUserToday, getLocalDateString } from '@/lib/types'

// ── Category weights for Focus (same as /api/metrics) ──
const FOCUS_WEIGHTS: Record<string, number> = {
  deep_work: 1.0,
  learning: 0.9,
  creating: 0.8,
  shallow_work: 0.3,
}

// ── Balance category groups ──
const BODY_CATS = ['exercise', 'movement', 'meals']
const MIND_CATS = ['rest', 'self_care']
const CONNECTION_CATS = ['social', 'calls']

// ── Default targets ──
const FOCUS_TARGET = 240
const BODY_TARGET = 90
const MIND_TARGET = 30
const CONNECTION_TARGET = 30

// ── Rhythm essentials ──
const ESSENTIALS = [
  { name: 'Deep Work', categories: ['deep_work', 'learning', 'creating'], threshold: 60 },
  { name: 'Movement', categories: ['exercise', 'movement'], threshold: 30 },
  { name: 'Recharge', categories: ['rest', 'self_care', 'meals'], threshold: 20 },
  { name: 'Connect', categories: ['social', 'calls'], threshold: 15 },
]

// ── Helpers ──
function getColor(value: number, thresholds: { green: number; yellow: number }): 'green' | 'yellow' | 'red' {
  if (value >= thresholds.green) return 'green'
  if (value >= thresholds.yellow) return 'yellow'
  return 'red'
}

function getDateNDaysAgo(baseDate: string, n: number): string {
  const d = new Date(baseDate + 'T12:00:00')
  d.setDate(d.getDate() - n)
  return getLocalDateString(d)
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

interface EntryRow {
  category: string
  duration_minutes: number
  date: string
}

/** Calculate Focus value for a set of entries on a single day */
function calcFocus(dayEntries: EntryRow[]): number {
  let weightedMinutes = 0
  for (const entry of dayEntries) {
    const weight = FOCUS_WEIGHTS[entry.category]
    if (weight) {
      weightedMinutes += entry.duration_minutes * weight
    }
  }
  return Math.round(Math.min(100, (weightedMinutes / FOCUS_TARGET) * 100))
}

/** Calculate Balance value for a set of entries on a single day */
function calcBalance(dayEntries: EntryRow[]): number {
  const sumMinutes = (cats: string[]) =>
    dayEntries.filter(e => cats.includes(e.category)).reduce((s, e) => s + e.duration_minutes, 0)

  const bodyScore = Math.round(Math.min(100, (sumMinutes(BODY_CATS) / BODY_TARGET) * 100))
  const mindScore = Math.round(Math.min(100, (sumMinutes(MIND_CATS) / MIND_TARGET) * 100))
  const connectionScore = Math.round(Math.min(100, (sumMinutes(CONNECTION_CATS) / CONNECTION_TARGET) * 100))

  return Math.round((bodyScore + mindScore + connectionScore) / 3)
}

/** Calculate Rhythm value — needs 7 days of entries, returns rolling average */
function calcRhythm(entries: EntryRow[], dates: string[]): number {
  const dailyScores: number[] = []

  for (const date of dates) {
    const dayEntries = entries.filter(e => e.date === date)
    let essentialsHit = 0
    for (const essential of ESSENTIALS) {
      const mins = dayEntries
        .filter(e => essential.categories.includes(e.category))
        .reduce((s, e) => s + e.duration_minutes, 0)
      if (mins >= essential.threshold) essentialsHit++
    }
    dailyScores.push(Math.round((essentialsHit / ESSENTIALS.length) * 100))
  }

  if (dailyScores.length === 0) return 0
  return Math.round(dailyScores.reduce((s, d) => s + d, 0) / dailyScores.length)
}

/** Calculate daily rhythm score (single-day essentials percentage) */
function calcDailyRhythm(dayEntries: EntryRow[]): number {
  let essentialsHit = 0
  for (const essential of ESSENTIALS) {
    const mins = dayEntries
      .filter(e => essential.categories.includes(e.category))
      .reduce((s, e) => s + e.duration_minutes, 0)
    if (mins >= essential.threshold) essentialsHit++
  }
  return Math.round((essentialsHit / ESSENTIALS.length) * 100)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse period — default 7d
    const searchParams = request.nextUrl.searchParams
    const periodParam = searchParams.get('period') || '7d'
    const days = periodParam === '30d' ? 30 : 7

    const today = getUserToday()
    // For rhythm, we need 7 days lookback for each day, so fetch extra
    const fetchFrom = getDateNDaysAgo(today, days + 6)

    // Fetch all confirmed entries for the range
    const { data: allEntries, error } = await supabase
      .from('time_entries')
      .select('category, duration_minutes, date')
      .eq('user_id', session.user.id)
      .eq('status', 'confirmed')
      .gte('date', fetchFrom)
      .lte('date', today)

    if (error) {
      console.error('Trend API Supabase error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const entries = (allEntries || []) as EntryRow[]

    // Build date range for the requested period
    const trendDates: string[] = []
    for (let i = days - 1; i >= 0; i--) {
      trendDates.push(getDateNDaysAgo(today, i))
    }

    // Calculate per-day metrics
    const trend: Array<{
      date: string
      label: string
      focus: number
      balance: number
      rhythm: number
      focusColor: string
      balanceColor: string
      rhythmColor: string
    }> = []

    for (const date of trendDates) {
      const dayEntries = entries.filter(e => e.date === date)

      const focusVal = calcFocus(dayEntries)
      const balanceVal = calcBalance(dayEntries)

      // Rhythm needs 7-day rolling window ending on this date
      const rhythmWindowDates: string[] = []
      for (let r = 6; r >= 0; r--) {
        rhythmWindowDates.push(getDateNDaysAgo(date, r))
      }
      const rhythmVal = calcRhythm(entries, rhythmWindowDates)

      trend.push({
        date,
        label: days <= 7 ? getDayLabel(date) : date.slice(8), // 'Mon' or '28'
        focus: focusVal,
        balance: balanceVal,
        rhythm: rhythmVal,
        focusColor: getColor(focusVal, { green: 80, yellow: 50 }),
        balanceColor: getColor(balanceVal, { green: 70, yellow: 40 }),
        rhythmColor: getColor(rhythmVal, { green: 75, yellow: 45 }),
      })
    }

    // Today's data (last element in trend)
    const todayData = trend[trend.length - 1]
    const todayEntries = entries.filter(e => e.date === today)

    // ── Focus details (same as /api/metrics) ──
    let weightedMinutes = 0
    const focusBreakdown: Record<string, number> = {}
    for (const entry of todayEntries) {
      const weight = FOCUS_WEIGHTS[entry.category]
      if (weight) {
        weightedMinutes += entry.duration_minutes * weight
        focusBreakdown[entry.category] = (focusBreakdown[entry.category] || 0) + entry.duration_minutes
      }
    }

    // ── Balance details ──
    const sumMinutes = (cats: string[]) =>
      todayEntries.filter(e => cats.includes(e.category)).reduce((s, e) => s + e.duration_minutes, 0)
    const bodyMinutes = sumMinutes(BODY_CATS)
    const mindMinutes = sumMinutes(MIND_CATS)
    const connectionMinutes = sumMinutes(CONNECTION_CATS)
    const bodyScore = Math.round(Math.min(100, (bodyMinutes / BODY_TARGET) * 100))
    const mindScore = Math.round(Math.min(100, (mindMinutes / MIND_TARGET) * 100))
    const connectionScore = Math.round(Math.min(100, (connectionMinutes / CONNECTION_TARGET) * 100))

    // ── Rhythm details ──
    const essentialsDetail = ESSENTIALS.map(essential => {
      const mins = todayEntries
        .filter(e => essential.categories.includes(e.category))
        .reduce((s, e) => s + e.duration_minutes, 0)
      return { name: essential.name, minutes: mins, threshold: essential.threshold, hit: mins >= essential.threshold }
    })

    // ── Personal bests ──
    const focusBest = trend.reduce((best, d) => d.focus > (best?.value ?? 0) ? { value: d.focus, date: d.date } : best, null as { value: number; date: string } | null)
    const balanceBest = trend.reduce((best, d) => d.balance > (best?.value ?? 0) ? { value: d.balance, date: d.date } : best, null as { value: number; date: string } | null)
    const rhythmBest = trend.reduce((best, d) => d.rhythm > (best?.value ?? 0) ? { value: d.rhythm, date: d.date } : best, null as { value: number; date: string } | null)

    // ── vs Last Week (7-day comparison) ──
    function calcWeekAvg(metric: 'focus' | 'balance' | 'rhythm', startIdx: number, count: number): number {
      const slice = trend.slice(startIdx, startIdx + count)
      if (slice.length === 0) return 0
      return Math.round(slice.reduce((s, d) => s + d[metric], 0) / slice.length)
    }

    let vsLastWeek: { focus: number; balance: number; rhythm: number }

    if (days >= 14) {
      // We have 2+ weeks — compare last 7 vs previous 7
      const thisWeekAvgFocus = calcWeekAvg('focus', days - 7, 7)
      const lastWeekAvgFocus = calcWeekAvg('focus', days - 14, 7)
      const thisWeekAvgBalance = calcWeekAvg('balance', days - 7, 7)
      const lastWeekAvgBalance = calcWeekAvg('balance', days - 14, 7)
      const thisWeekAvgRhythm = calcWeekAvg('rhythm', days - 7, 7)
      const lastWeekAvgRhythm = calcWeekAvg('rhythm', days - 14, 7)
      vsLastWeek = {
        focus: thisWeekAvgFocus - lastWeekAvgFocus,
        balance: thisWeekAvgBalance - lastWeekAvgBalance,
        rhythm: thisWeekAvgRhythm - lastWeekAvgRhythm,
      }
    } else {
      // Only 7 days — compute delta vs the earliest available data
      // Fetch last week's data separately for comparison
      const lastWeekEnd = getDateNDaysAgo(today, 7)
      const lastWeekStart = getDateNDaysAgo(today, 13)

      const { data: lastWeekEntries } = await supabase
        .from('time_entries')
        .select('category, duration_minutes, date')
        .eq('user_id', session.user.id)
        .eq('status', 'confirmed')
        .gte('date', lastWeekStart)
        .lte('date', lastWeekEnd)

      const lwEntries = (lastWeekEntries || []) as EntryRow[]
      const lwDates: string[] = []
      for (let i = 6; i >= 0; i--) {
        lwDates.push(getDateNDaysAgo(lastWeekEnd, i))
      }

      // Calculate last week averages
      let lwFocusSum = 0, lwBalanceSum = 0, lwRhythmSum = 0
      let lwCount = 0
      for (const date of lwDates) {
        const dayEntries = lwEntries.filter(e => e.date === date)
        lwFocusSum += calcFocus(dayEntries)
        lwBalanceSum += calcBalance(dayEntries)
        lwRhythmSum += calcDailyRhythm(dayEntries)
        lwCount++
      }

      const lwFocusAvg = lwCount > 0 ? Math.round(lwFocusSum / lwCount) : 0
      const lwBalanceAvg = lwCount > 0 ? Math.round(lwBalanceSum / lwCount) : 0
      const lwRhythmAvg = lwCount > 0 ? Math.round(lwRhythmSum / lwCount) : 0

      const thisWeekFocusAvg = Math.round(trend.reduce((s, d) => s + d.focus, 0) / trend.length)
      const thisWeekBalanceAvg = Math.round(trend.reduce((s, d) => s + d.balance, 0) / trend.length)
      const thisWeekRhythmAvg = Math.round(trend.reduce((s, d) => s + d.rhythm, 0) / trend.length)

      vsLastWeek = {
        focus: thisWeekFocusAvg - lwFocusAvg,
        balance: thisWeekBalanceAvg - lwBalanceAvg,
        rhythm: thisWeekRhythmAvg - lwRhythmAvg,
      }
    }

    // ── Nudge (same logic as /api/metrics) ──
    const focusLabel = todayData.focus >= 80 ? 'Locked in' : todayData.focus >= 50 ? 'Building' : 'Scattered'
    const balanceLabel = todayData.balance >= 70 ? 'Recharged' : todayData.balance >= 40 ? 'Running low' : 'Running on fumes'
    const rhythmLabel = todayData.rhythm >= 75 ? 'Dialed in' : todayData.rhythm >= 45 ? 'Getting there' : 'Off track'

    const metrics = [
      { name: 'Focus', value: todayData.focus, color: todayData.focusColor },
      { name: 'Balance', value: todayData.balance, color: todayData.balanceColor },
      { name: 'Rhythm', value: todayData.rhythm, color: todayData.rhythmColor },
    ]
    const lowest = metrics.reduce((a, b) => a.value < b.value ? a : b)

    let nudge = ''
    if (lowest.color === 'red') {
      if (lowest.name === 'Focus') nudge = 'Start a deep work block to get Focus moving.'
      else if (lowest.name === 'Balance') nudge = 'Take a break — your body and mind need it.'
      else nudge = 'Log your essentials to build Rhythm back up.'
    } else if (lowest.color === 'yellow') {
      if (lowest.name === 'Focus') nudge = 'One more focus session pushes you to green.'
      else if (lowest.name === 'Balance') nudge = 'A quick walk or call would boost Balance.'
      else nudge = 'Keep showing up — Rhythm builds day by day.'
    } else {
      nudge = 'All metrics looking strong. Keep it up! 🔥'
    }

    // Averages
    const focusAvg = Math.round(trend.reduce((s, d) => s + d.focus, 0) / trend.length)
    const balanceAvg = Math.round(trend.reduce((s, d) => s + d.balance, 0) / trend.length)
    const rhythmAvg = Math.round(trend.reduce((s, d) => s + d.rhythm, 0) / trend.length)

    return NextResponse.json({
      focus: {
        current: todayData.focus,
        color: todayData.focusColor,
        label: focusLabel,
        average: focusAvg,
        trend: trend.map(d => ({ date: d.date, label: d.label, value: d.focus, color: d.focusColor })),
        personalBest: focusBest,
        vsLastWeek: { change: vsLastWeek.focus, direction: vsLastWeek.focus > 0 ? 'up' : vsLastWeek.focus < 0 ? 'down' : 'same' },
        details: {
          weightedMinutes: Math.round(weightedMinutes),
          target: FOCUS_TARGET,
          breakdown: focusBreakdown,
        },
      },
      balance: {
        current: todayData.balance,
        color: todayData.balanceColor,
        label: balanceLabel,
        average: balanceAvg,
        trend: trend.map(d => ({ date: d.date, label: d.label, value: d.balance, color: d.balanceColor })),
        personalBest: balanceBest,
        vsLastWeek: { change: vsLastWeek.balance, direction: vsLastWeek.balance > 0 ? 'up' : vsLastWeek.balance < 0 ? 'down' : 'same' },
        details: {
          body: bodyScore,
          mind: mindScore,
          connection: connectionScore,
          bodyMinutes,
          mindMinutes,
          connectionMinutes,
        },
      },
      rhythm: {
        current: todayData.rhythm,
        color: todayData.rhythmColor,
        label: rhythmLabel,
        average: rhythmAvg,
        trend: trend.map(d => ({ date: d.date, label: d.label, value: d.rhythm, color: d.rhythmColor })),
        personalBest: rhythmBest,
        vsLastWeek: { change: vsLastWeek.rhythm, direction: vsLastWeek.rhythm > 0 ? 'up' : vsLastWeek.rhythm < 0 ? 'down' : 'same' },
        details: {
          essentials: essentialsDetail,
        },
      },
      nudge,
      period: periodParam,
    })
  } catch (error) {
    console.error('Trend API error:', error)
    return NextResponse.json({ error: 'Failed to calculate trend metrics' }, { status: 500 })
  }
}
