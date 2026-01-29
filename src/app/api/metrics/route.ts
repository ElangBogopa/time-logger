import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { getUserToday } from '@/lib/types'
import {
  EntryRow,
  FOCUS_WEIGHTS,
  BODY_CATS,
  MIND_CATS,
  CONNECTION_CATS,
  FOCUS_TARGET,
  BODY_TARGET,
  MIND_TARGET,
  CONNECTION_TARGET,
  ESSENTIALS,
  FOCUS_THRESHOLDS,
  BALANCE_THRESHOLDS,
  RHYTHM_THRESHOLDS,
  getStatusColor,
  getDateNDaysAgo,
  getNudge,
} from '@/lib/metrics-calc'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = getUserToday()
    const weekAgo = getDateNDaysAgo(today, 6) // 7 days including today

    // Fetch all confirmed entries for the past 7 days
    const { data: allEntries } = await supabase
      .from('time_entries')
      .select('category, duration_minutes, date')
      .eq('user_id', session.user.id)
      .eq('status', 'confirmed')
      .gte('date', weekAgo)
      .lte('date', today)

    const entries = (allEntries || []) as EntryRow[]

    // Split today's entries vs all entries
    const todayEntries = entries.filter(e => e.date === today)

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
    // ⚖️ BALANCE — body + mind + connection
    // ═══════════════════════════════════════
    const sumMinutes = (cats: string[]) =>
      todayEntries.filter(e => cats.includes(e.category)).reduce((s, e) => s + e.duration_minutes, 0)

    const bodyMinutes = sumMinutes(BODY_CATS)
    const mindMinutes = sumMinutes(MIND_CATS)
    const connectionMinutes = sumMinutes(CONNECTION_CATS)

    const bodyScore = Math.round(Math.min(100, (bodyMinutes / BODY_TARGET) * 100))
    const mindScore = Math.round(Math.min(100, (mindMinutes / MIND_TARGET) * 100))
    const connectionScore = Math.round(Math.min(100, (connectionMinutes / CONNECTION_TARGET) * 100))

    const balanceValue = Math.round((bodyScore + mindScore + connectionScore) / 3)
    const balanceColor = getStatusColor(balanceValue, BALANCE_THRESHOLDS)
    const balanceLabel = balanceValue >= 70 ? 'Recharged' : balanceValue >= 40 ? 'Running low' : 'Running on fumes'

    // ═══════════════════════════════════════
    // 🔄 RHYTHM — 7-day essential consistency
    // ═══════════════════════════════════════
    const dailyScores: { date: string; essentialsHit: number; total: number; pct: number }[] = []

    for (let i = 6; i >= 0; i--) {
      const date = getDateNDaysAgo(today, i)
      const dayEntries = entries.filter(e => e.date === date)

      let essentialsHit = 0
      for (const essential of ESSENTIALS) {
        const mins = dayEntries
          .filter(e => essential.categories.includes(e.category))
          .reduce((s, e) => s + e.duration_minutes, 0)
        if (mins >= essential.threshold) essentialsHit++
      }

      dailyScores.push({
        date,
        essentialsHit,
        total: ESSENTIALS.length,
        pct: Math.round((essentialsHit / ESSENTIALS.length) * 100),
      })
    }

    const rhythmValue = Math.round(dailyScores.reduce((s, d) => s + d.pct, 0) / dailyScores.length)
    const rhythmColor = getStatusColor(rhythmValue, RHYTHM_THRESHOLDS)
    const rhythmLabel = rhythmValue >= 75 ? 'Dialed in' : rhythmValue >= 45 ? 'Getting there' : 'Off track'

    // Today's essentials for detail view
    const todayScore = dailyScores[dailyScores.length - 1]
    const essentialsDetail = ESSENTIALS.map(essential => {
      const mins = todayEntries
        .filter(e => essential.categories.includes(e.category))
        .reduce((s, e) => s + e.duration_minutes, 0)
      return {
        name: essential.name,
        minutes: mins,
        threshold: essential.threshold,
        hit: mins >= essential.threshold,
      }
    })

    // ═══════════════════════════════════════
    // 💡 NUDGE — actionable insight
    // ═══════════════════════════════════════
    const nudge = getNudge(focusValue, focusColor, balanceValue, balanceColor, rhythmValue, rhythmColor)

    return NextResponse.json({
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
      balance: {
        value: balanceValue,
        color: balanceColor,
        label: balanceLabel,
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
        value: rhythmValue,
        color: rhythmColor,
        label: rhythmLabel,
        details: {
          essentialsToday: todayScore.essentialsHit,
          totalEssentials: ESSENTIALS.length,
          dailyScores,
          essentials: essentialsDetail,
        },
      },
      nudge,
    })
  } catch (error) {
    console.error('Metrics API error:', error)
    return NextResponse.json({ error: 'Failed to calculate metrics' }, { status: 500 })
  }
}
