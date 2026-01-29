import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { getUserToday } from '@/lib/types'
import {
  EntryRow,
  FOCUS_WEIGHTS,
  FOCUS_TARGET,
  FOCUS_THRESHOLDS,
  BALANCE_THRESHOLDS,
  RHYTHM_THRESHOLDS,
  ESSENTIALS,
  getStatusColor,
  getDateNDaysAgo,
  getDayLabel,
  calcFocus,
  calcBalance,
  calcRhythm,
  calcFocusDetails,
  calcBalanceDetails,
  calcEssentialsDetail,
  getStatusLabel,
  getNudge,
} from '@/lib/metrics-calc'

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
        focusColor: getStatusColor(focusVal, FOCUS_THRESHOLDS),
        balanceColor: getStatusColor(balanceVal, BALANCE_THRESHOLDS),
        rhythmColor: getStatusColor(rhythmVal, RHYTHM_THRESHOLDS),
      })
    }

    // Today's data (last element in trend)
    const todayData = trend[trend.length - 1]
    const todayEntries = entries.filter(e => e.date === today)

    // ── Focus details ──
    const focusDetails = calcFocusDetails(todayEntries)

    // ── Balance details ──
    const balanceDetails = calcBalanceDetails(todayEntries)

    // ── Rhythm details ──
    const essentialsDetail = calcEssentialsDetail(todayEntries)

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

    let vsLastWeek: { focus: number | null; balance: number | null; rhythm: number | null }

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
      // Only 7 days — fetch last week's data separately for comparison
      const lastWeekEnd = getDateNDaysAgo(today, 7)
      const lastWeekStart = getDateNDaysAgo(today, 13)
      // W3 fix: For rhythm comparison, we need entries from 20 days ago
      // (last week's rhythm rolling window goes back 7 days before lastWeekStart)
      const rhythmLookbackStart = getDateNDaysAgo(today, 20)

      // W2 fix: Handle Supabase error on vsLastWeek query
      const { data: lastWeekEntries, error: lwError } = await supabase
        .from('time_entries')
        .select('category, duration_minutes, date')
        .eq('user_id', session.user.id)
        .eq('status', 'confirmed')
        .gte('date', rhythmLookbackStart)
        .lte('date', lastWeekEnd)

      if (lwError) {
        // W2 fix: On error, set all deltas to null instead of fake zeros
        console.error('vsLastWeek query failed:', lwError)
        vsLastWeek = { focus: null, balance: null, rhythm: null }
      } else {
        const lwEntries = (lastWeekEntries || []) as EntryRow[]
        const lwDates: string[] = []
        for (let i = 6; i >= 0; i--) {
          lwDates.push(getDateNDaysAgo(lastWeekEnd, i))
        }

        // Calculate last week averages
        let lwFocusSum = 0, lwBalanceSum = 0
        let lwCount = 0
        for (const date of lwDates) {
          const dayEntries = lwEntries.filter(e => e.date === date)
          lwFocusSum += calcFocus(dayEntries)
          lwBalanceSum += calcBalance(dayEntries)
          lwCount++
        }

        // W3 fix: Use calcRhythm() with 7-day rolling window for last week,
        // same as how this week's rhythm is calculated in the trend array
        const lwRhythmAvg = calcRhythm(lwEntries, lwDates)

        const lwFocusAvg = lwCount > 0 ? Math.round(lwFocusSum / lwCount) : 0
        const lwBalanceAvg = lwCount > 0 ? Math.round(lwBalanceSum / lwCount) : 0

        const thisWeekFocusAvg = Math.round(trend.reduce((s, d) => s + d.focus, 0) / trend.length)
        const thisWeekBalanceAvg = Math.round(trend.reduce((s, d) => s + d.balance, 0) / trend.length)
        const thisWeekRhythmAvg = Math.round(trend.reduce((s, d) => s + d.rhythm, 0) / trend.length)

        vsLastWeek = {
          focus: thisWeekFocusAvg - lwFocusAvg,
          balance: thisWeekBalanceAvg - lwBalanceAvg,
          rhythm: thisWeekRhythmAvg - lwRhythmAvg,
        }
      }
    }

    // ── Labels & Nudge ──
    const focusLabel = getStatusLabel('focus', todayData.focus)
    const balanceLabel = getStatusLabel('balance', todayData.balance)
    const rhythmLabel = getStatusLabel('rhythm', todayData.rhythm)

    const nudge = getNudge(
      todayData.focus, todayData.focusColor,
      todayData.balance, todayData.balanceColor,
      todayData.rhythm, todayData.rhythmColor,
    )

    // Averages
    const focusAvg = Math.round(trend.reduce((s, d) => s + d.focus, 0) / trend.length)
    const balanceAvg = Math.round(trend.reduce((s, d) => s + d.balance, 0) / trend.length)
    const rhythmAvg = Math.round(trend.reduce((s, d) => s + d.rhythm, 0) / trend.length)

    // Helper to build vsLastWeek response (handles null for W2)
    function buildVsLastWeek(change: number | null) {
      if (change === null) return null
      return { change, direction: change > 0 ? 'up' : change < 0 ? 'down' : 'same' }
    }

    return NextResponse.json({
      focus: {
        current: todayData.focus,
        color: todayData.focusColor,
        label: focusLabel,
        average: focusAvg,
        trend: trend.map(d => ({ date: d.date, label: d.label, value: d.focus, color: d.focusColor })),
        personalBest: focusBest,
        vsLastWeek: buildVsLastWeek(vsLastWeek.focus),
        details: {
          weightedMinutes: focusDetails.weightedMinutes,
          target: FOCUS_TARGET,
          breakdown: focusDetails.breakdown,
        },
      },
      balance: {
        current: todayData.balance,
        color: todayData.balanceColor,
        label: balanceLabel,
        average: balanceAvg,
        trend: trend.map(d => ({ date: d.date, label: d.label, value: d.balance, color: d.balanceColor })),
        personalBest: balanceBest,
        vsLastWeek: buildVsLastWeek(vsLastWeek.balance),
        details: {
          body: balanceDetails.body,
          mind: balanceDetails.mind,
          connection: balanceDetails.connection,
          bodyMinutes: balanceDetails.bodyMinutes,
          mindMinutes: balanceDetails.mindMinutes,
          connectionMinutes: balanceDetails.connectionMinutes,
        },
      },
      rhythm: {
        current: todayData.rhythm,
        color: todayData.rhythmColor,
        label: rhythmLabel,
        average: rhythmAvg,
        trend: trend.map(d => ({ date: d.date, label: d.label, value: d.rhythm, color: d.rhythmColor })),
        personalBest: rhythmBest,
        vsLastWeek: buildVsLastWeek(vsLastWeek.rhythm),
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
