import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { getUserToday } from '@/lib/types'

/**
 * GET /api/streaks-productivity
 *
 * Returns two streak counts:
 * 1. Planning streak — consecutive days (up to today) where user set a plan
 * 2. Execution streak — consecutive days where user completed the priority task
 *
 * Grace rule (per Lally's research): 1 missed day per 7 doesn't break the streak.
 * Simplified for v1: no grace — pure consecutive days. Add grace later.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const dateParam = request.nextUrl.searchParams.get('date')
    const today = dateParam || getUserToday()

    // Fetch the last 90 days of plans to calculate streaks
    const startDate = getDateNDaysAgo(today, 89)

    const { data: plans, error } = await supabase
      .from('daily_plans')
      .select('date, completed, sort_order')
      .eq('user_id', session.user.id)
      .gte('date', startDate)
      .lte('date', today)
      .order('date', { ascending: false })
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching plans for streaks:', error)
      return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 })
    }

    // Group plans by date
    const plansByDate = new Map<string, { hasPlans: boolean; priorityCompleted: boolean; completedCount: number }>()
    for (const plan of (plans || [])) {
      const existing = plansByDate.get(plan.date)
      if (!existing) {
        plansByDate.set(plan.date, {
          hasPlans: true,
          priorityCompleted: plan.sort_order === 0 ? plan.completed : false,
          completedCount: plan.completed ? 1 : 0,
        })
      } else {
        if (plan.sort_order === 0) {
          existing.priorityCompleted = plan.completed
        }
        if (plan.completed) {
          existing.completedCount++
        }
      }
    }

    // Walk backwards from today to calculate streaks
    // 1. Productive Day streak: completed #1 priority task
    // 2. Crushing It streak: completed 3+ tasks
    let productiveStreak = 0
    let crushingStreak = 0
    let productiveActive = true
    let crushingActive = true

    for (let i = 0; i < 90; i++) {
      const date = getDateNDaysAgo(today, i)
      const dayData = plansByDate.get(date)

      // Productive Day: completed the #1 priority task
      if (productiveActive) {
        if (dayData?.hasPlans && dayData?.priorityCompleted) {
          productiveStreak++
        } else if (dayData?.hasPlans && !dayData?.priorityCompleted) {
          productiveActive = false
        } else if (!dayData?.hasPlans) {
          // No plan = skip (don't penalize unplanned days)
          if (productiveStreak === 0 && i > 0) productiveActive = false
        }
      }

      // Crushing It: completed 3+ tasks
      if (crushingActive) {
        if (dayData?.hasPlans && dayData.completedCount >= 3) {
          crushingStreak++
        } else if (dayData?.hasPlans) {
          crushingActive = false
        } else if (!dayData?.hasPlans) {
          if (crushingStreak === 0 && i > 0) crushingActive = false
        }
      }

      if (!productiveActive && !crushingActive) break
    }

    // Best streaks (all time from 90-day window)
    let bestProductiveStreak = 0
    let bestCrushingStreak = 0
    let curProductive = 0
    let curCrushing = 0

    for (let i = 89; i >= 0; i--) {
      const date = getDateNDaysAgo(today, i)
      const dayData = plansByDate.get(date)

      if (dayData?.hasPlans && dayData?.priorityCompleted) {
        curProductive++
        bestProductiveStreak = Math.max(bestProductiveStreak, curProductive)
      } else if (dayData?.hasPlans) {
        curProductive = 0
      }

      if (dayData?.hasPlans && dayData.completedCount >= 3) {
        curCrushing++
        bestCrushingStreak = Math.max(bestCrushingStreak, curCrushing)
      } else if (dayData?.hasPlans) {
        curCrushing = 0
      }
    }

    return NextResponse.json({
      // Keep "planning" key for backwards compat but repurpose as "crushing it"
      planning: {
        current: crushingStreak,
        best: bestCrushingStreak,
        label: crushingStreak === 0 ? 'Complete 3+ tasks' : `${crushingStreak} day${crushingStreak !== 1 ? 's' : ''}`,
      },
      execution: {
        current: productiveStreak,
        best: bestProductiveStreak,
        label: productiveStreak === 0 ? 'Complete your #1 task' : `${productiveStreak} day${productiveStreak !== 1 ? 's' : ''}`,
      },
    })
  } catch (error) {
    console.error('Streaks error:', error)
    return NextResponse.json({ error: 'Failed to calculate streaks' }, { status: 500 })
  }
}

function getDateNDaysAgo(fromDate: string, n: number): string {
  const d = new Date(fromDate + 'T12:00:00')
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}
