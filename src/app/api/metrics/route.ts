import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { getUserToday } from '@/lib/types'
import {
  EntryRow,
  FOCUS_WEIGHTS,
  BODY_CATS,
  SOCIAL_CATS,
  FOCUS_TARGET,
  BODY_TARGET,
  SOCIAL_TARGET,
  FOCUS_THRESHOLDS,
  BODY_THRESHOLDS,
  SOCIAL_THRESHOLDS,
  getStatusColor,
  getDateNDaysAgo,
  getNudge,
} from '@/lib/metrics-calc'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dateParam = request.nextUrl.searchParams.get('date')
    const today = dateParam || getUserToday()

    // Fetch today's confirmed entries
    const { data: allEntries } = await supabase
      .from('time_entries')
      .select('category, duration_minutes, date')
      .eq('user_id', session.user.id)
      .eq('status', 'confirmed')
      .eq('date', today)

    const todayEntries = (allEntries || []) as EntryRow[]

    // ═══════════════════════════════════════
    // 💪 BODY — physical self-care
    // ═══════════════════════════════════════
    const bodyMinutes = todayEntries
      .filter(e => BODY_CATS.includes(e.category))
      .reduce((s, e) => s + e.duration_minutes, 0)

    const bodyBreakdown: Record<string, number> = {}
    for (const entry of todayEntries) {
      if (BODY_CATS.includes(entry.category)) {
        bodyBreakdown[entry.category] = (bodyBreakdown[entry.category] || 0) + entry.duration_minutes
      }
    }

    const bodyValue = Math.round(Math.min(100, (bodyMinutes / BODY_TARGET) * 100))
    const bodyColor = getStatusColor(bodyValue, BODY_THRESHOLDS)
    const bodyLabel = bodyValue >= 70 ? 'Fueled up' : bodyValue >= 40 ? 'Running low' : 'Running on empty'

    // ═══════════════════════════════════════
    // ⚡ FOCUS — weighted deep work output
    // ═══════════════════════════════════════
    let weightedMinutes = 0
    const focusBreakdown: Record<string, number> = {}

    for (const entry of todayEntries) {
      const weight = FOCUS_WEIGHTS[entry.category]
      if (weight) {
        weightedMinutes += entry.duration_minutes * weight
        focusBreakdown[entry.category] = (focusBreakdown[entry.category] || 0) + entry.duration_minutes
      }
    }

    const focusValue = Math.round(Math.min(100, (weightedMinutes / FOCUS_TARGET) * 100))
    const focusColor = getStatusColor(focusValue, FOCUS_THRESHOLDS)
    const focusLabel = focusValue >= 80 ? 'Locked in' : focusValue >= 50 ? 'Building' : 'Scattered'

    // ═══════════════════════════════════════
    // 👥 SOCIAL — connection time
    // ═══════════════════════════════════════
    const socialMinutes = todayEntries
      .filter(e => SOCIAL_CATS.includes(e.category))
      .reduce((s, e) => s + e.duration_minutes, 0)

    const socialBreakdown: Record<string, number> = {}
    for (const entry of todayEntries) {
      if (SOCIAL_CATS.includes(entry.category)) {
        socialBreakdown[entry.category] = (socialBreakdown[entry.category] || 0) + entry.duration_minutes
      }
    }

    const socialValue = Math.round(Math.min(100, (socialMinutes / SOCIAL_TARGET) * 100))
    const socialColor = getStatusColor(socialValue, SOCIAL_THRESHOLDS)
    const socialLabel = socialValue >= 70 ? 'Connected' : socialValue >= 35 ? 'Reaching out' : 'Isolated'

    // ═══════════════════════════════════════
    // 💡 NUDGE — actionable insight
    // ═══════════════════════════════════════
    const nudge = getNudge(bodyValue, bodyColor, focusValue, focusColor, socialValue, socialColor)

    return NextResponse.json({
      body: {
        value: bodyValue,
        color: bodyColor,
        label: bodyLabel,
        details: {
          totalMinutes: bodyMinutes,
          target: BODY_TARGET,
          breakdown: bodyBreakdown,
        },
      },
      focus: {
        value: focusValue,
        color: focusColor,
        label: focusLabel,
        details: {
          weightedMinutes: Math.round(weightedMinutes),
          target: FOCUS_TARGET,
          breakdown: focusBreakdown,
        },
      },
      social: {
        value: socialValue,
        color: socialColor,
        label: socialLabel,
        details: {
          totalMinutes: socialMinutes,
          target: SOCIAL_TARGET,
          breakdown: socialBreakdown,
        },
      },
      nudge,
    })
  } catch (error) {
    console.error('Metrics API error:', error)
    return NextResponse.json({ error: 'Failed to calculate metrics' }, { status: 500 })
  }
}
