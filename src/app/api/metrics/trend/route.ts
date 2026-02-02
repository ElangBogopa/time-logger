import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { getUserToday } from '@/lib/types'
import {
  EntryRow,
  FOCUS_TARGET,
  BODY_TARGET,
  SOCIAL_TARGET,
  FOCUS_THRESHOLDS,
  BODY_THRESHOLDS,
  SOCIAL_THRESHOLDS,
  getStatusColor,
  getDateNDaysAgo,
  getDayLabel,
  calcFocus,
  calcBody,
  calcSocial,
  calcFocusDetails,
  calcBodyDetails,
  calcSocialDetails,
  getStatusLabel,
  getNudge,
} from '@/lib/metrics-calc'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const periodParam = searchParams.get('period') || '7d'
    const days = periodParam === '30d' ? 30 : periodParam === '14d' ? 14 : 7

    const dateParam = searchParams.get('date')
    const today = dateParam || getUserToday()
    const fetchFrom = getDateNDaysAgo(today, days - 1)

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

    // Build date range
    const trendDates: string[] = []
    for (let i = days - 1; i >= 0; i--) {
      trendDates.push(getDateNDaysAgo(today, i))
    }

    // Calculate per-day metrics
    const trend: Array<{
      date: string
      label: string
      body: number
      focus: number
      social: number
      bodyColor: string
      focusColor: string
      socialColor: string
    }> = []

    for (const date of trendDates) {
      const dayEntries = entries.filter(e => e.date === date)
      const bodyVal = calcBody(dayEntries)
      const focusVal = calcFocus(dayEntries)
      const socialVal = calcSocial(dayEntries)

      trend.push({
        date,
        label: days <= 7 ? getDayLabel(date) : date.slice(8),
        body: bodyVal,
        focus: focusVal,
        social: socialVal,
        bodyColor: getStatusColor(bodyVal, BODY_THRESHOLDS),
        focusColor: getStatusColor(focusVal, FOCUS_THRESHOLDS),
        socialColor: getStatusColor(socialVal, SOCIAL_THRESHOLDS),
      })
    }

    const todayData = trend[trend.length - 1]
    const todayEntries = entries.filter(e => e.date === today)

    // Details
    const bodyDetails = calcBodyDetails(todayEntries)
    const focusDetails = calcFocusDetails(todayEntries)
    const socialDetails = calcSocialDetails(todayEntries)

    // Personal bests
    const bodyBest = trend.reduce((best, d) => d.body > (best?.value ?? 0) ? { value: d.body, date: d.date } : best, null as { value: number; date: string } | null)
    const focusBest = trend.reduce((best, d) => d.focus > (best?.value ?? 0) ? { value: d.focus, date: d.date } : best, null as { value: number; date: string } | null)
    const socialBest = trend.reduce((best, d) => d.social > (best?.value ?? 0) ? { value: d.social, date: d.date } : best, null as { value: number; date: string } | null)

    // vs Last Week
    let vsLastWeek: { body: number | null; focus: number | null; social: number | null }

    if (days >= 14) {
      const calcAvg = (metric: 'body' | 'focus' | 'social', startIdx: number, count: number) => {
        const slice = trend.slice(startIdx, startIdx + count)
        if (slice.length === 0) return 0
        return Math.round(slice.reduce((s, d) => s + d[metric], 0) / slice.length)
      }
      vsLastWeek = {
        body: calcAvg('body', days - 7, 7) - calcAvg('body', days - 14, 7),
        focus: calcAvg('focus', days - 7, 7) - calcAvg('focus', days - 14, 7),
        social: calcAvg('social', days - 7, 7) - calcAvg('social', days - 14, 7),
      }
    } else {
      const lastWeekEnd = getDateNDaysAgo(today, 7)
      const lastWeekStart = getDateNDaysAgo(today, 13)

      const { data: lastWeekEntries, error: lwError } = await supabase
        .from('time_entries')
        .select('category, duration_minutes, date')
        .eq('user_id', session.user.id)
        .eq('status', 'confirmed')
        .gte('date', lastWeekStart)
        .lte('date', lastWeekEnd)

      if (lwError) {
        console.error('vsLastWeek query failed:', lwError)
        vsLastWeek = { body: null, focus: null, social: null }
      } else {
        const lwEntries = (lastWeekEntries || []) as EntryRow[]
        const lwDates: string[] = []
        for (let i = 6; i >= 0; i--) {
          lwDates.push(getDateNDaysAgo(lastWeekEnd, i))
        }

        let lwBodySum = 0, lwFocusSum = 0, lwSocialSum = 0, lwCount = 0
        for (const date of lwDates) {
          const dayEntries = lwEntries.filter(e => e.date === date)
          lwBodySum += calcBody(dayEntries)
          lwFocusSum += calcFocus(dayEntries)
          lwSocialSum += calcSocial(dayEntries)
          lwCount++
        }

        const lwBodyAvg = lwCount > 0 ? Math.round(lwBodySum / lwCount) : 0
        const lwFocusAvg = lwCount > 0 ? Math.round(lwFocusSum / lwCount) : 0
        const lwSocialAvg = lwCount > 0 ? Math.round(lwSocialSum / lwCount) : 0

        const thisWeekBodyAvg = Math.round(trend.reduce((s, d) => s + d.body, 0) / trend.length)
        const thisWeekFocusAvg = Math.round(trend.reduce((s, d) => s + d.focus, 0) / trend.length)
        const thisWeekSocialAvg = Math.round(trend.reduce((s, d) => s + d.social, 0) / trend.length)

        vsLastWeek = {
          body: thisWeekBodyAvg - lwBodyAvg,
          focus: thisWeekFocusAvg - lwFocusAvg,
          social: thisWeekSocialAvg - lwSocialAvg,
        }
      }
    }

    // Labels & Nudge
    const bodyLabel = getStatusLabel('body', todayData.body)
    const focusLabel = getStatusLabel('focus', todayData.focus)
    const socialLabel = getStatusLabel('social', todayData.social)

    const nudge = getNudge(
      todayData.body, todayData.bodyColor,
      todayData.focus, todayData.focusColor,
      todayData.social, todayData.socialColor,
    )

    // Averages
    const bodyAvg = Math.round(trend.reduce((s, d) => s + d.body, 0) / trend.length)
    const focusAvg = Math.round(trend.reduce((s, d) => s + d.focus, 0) / trend.length)
    const socialAvg = Math.round(trend.reduce((s, d) => s + d.social, 0) / trend.length)

    function buildVsLastWeek(change: number | null) {
      if (change === null) return null
      return { change, direction: change > 0 ? 'up' : change < 0 ? 'down' : 'same' }
    }

    return NextResponse.json({
      body: {
        current: todayData.body,
        color: todayData.bodyColor,
        label: bodyLabel,
        average: bodyAvg,
        trend: trend.map(d => ({ date: d.date, label: d.label, value: d.body, color: d.bodyColor })),
        personalBest: bodyBest,
        vsLastWeek: buildVsLastWeek(vsLastWeek.body),
        details: {
          totalMinutes: bodyDetails.totalMinutes,
          target: BODY_TARGET,
          breakdown: bodyDetails.breakdown,
        },
      },
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
      social: {
        current: todayData.social,
        color: todayData.socialColor,
        label: socialLabel,
        average: socialAvg,
        trend: trend.map(d => ({ date: d.date, label: d.label, value: d.social, color: d.socialColor })),
        personalBest: socialBest,
        vsLastWeek: buildVsLastWeek(vsLastWeek.social),
        details: {
          totalMinutes: socialDetails.totalMinutes,
          target: SOCIAL_TARGET,
          breakdown: socialDetails.breakdown,
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
