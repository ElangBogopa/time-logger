import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { getUserToday, getLocalDateString } from '@/lib/types'

// ── Category weights for Focus ──
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
const FOCUS_TARGET = 240 // 4 hours weighted
const BODY_TARGET = 90   // 90 min
const MIND_TARGET = 30   // 30 min
const CONNECTION_TARGET = 30 // 30 min

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

interface EntryRow {
  category: string
  duration_minutes: number
  date: string
}

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
    const focusColor = getColor(focusValue, { green: 80, yellow: 50 })
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
    const balanceColor = getColor(balanceValue, { green: 70, yellow: 40 })
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
    const rhythmColor = getColor(rhythmValue, { green: 75, yellow: 45 })
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
    let nudge = ''
    const metrics = [
      { name: 'Focus', value: focusValue, color: focusColor },
      { name: 'Balance', value: balanceValue, color: balanceColor },
      { name: 'Rhythm', value: rhythmValue, color: rhythmColor },
    ]
    const lowest = metrics.reduce((a, b) => a.value < b.value ? a : b)

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
