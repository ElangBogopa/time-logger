import { NextResponse } from 'next/server'
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
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const today = getUserToday()

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
    const plansByDate = new Map<string, { hasPlans: boolean; priorityCompleted: boolean; allCompleted: boolean }>()
    for (const plan of (plans || [])) {
      const existing = plansByDate.get(plan.date)
      if (!existing) {
        plansByDate.set(plan.date, {
          hasPlans: true,
          priorityCompleted: plan.sort_order === 0 ? plan.completed : false,
          allCompleted: plan.completed,
        })
      } else {
        // Priority task is sort_order 0
        if (plan.sort_order === 0) {
          existing.priorityCompleted = plan.completed
        }
        if (!plan.completed) {
          existing.allCompleted = false
        }
      }
    }

    // Walk backwards from today to calculate streaks
    let planningStreak = 0
    let executionStreak = 0
    let planningActive = true
    let executionActive = true

    for (let i = 0; i < 90; i++) {
      const date = getDateNDaysAgo(today, i)
      const dayData = plansByDate.get(date)

      // Planning streak: did they set a plan?
      if (planningActive) {
        if (dayData?.hasPlans) {
          planningStreak++
        } else {
          planningActive = false
        }
      }

      // Execution streak: did they complete the priority task?
      if (executionActive) {
        if (dayData?.hasPlans && dayData?.priorityCompleted) {
          executionStreak++
        } else if (dayData?.hasPlans && !dayData?.priorityCompleted) {
          // Had a plan but didn't execute — streak broken
          executionActive = false
        } else if (!dayData?.hasPlans) {
          // No plan = skip day (don't break execution streak for unplanned days)
          // But do break if we haven't seen any planned days yet
          if (executionStreak === 0 && i > 0) {
            executionActive = false
          }
          // Otherwise skip — unplanned days don't count against execution
        }
      }

      if (!planningActive && !executionActive) break
    }

    // Best streaks (all time from 90-day window)
    let bestPlanningStreak = 0
    let bestExecutionStreak = 0
    let currentPlanning = 0
    let currentExecution = 0

    for (let i = 89; i >= 0; i--) {
      const date = getDateNDaysAgo(today, i)
      const dayData = plansByDate.get(date)

      if (dayData?.hasPlans) {
        currentPlanning++
        bestPlanningStreak = Math.max(bestPlanningStreak, currentPlanning)
      } else {
        currentPlanning = 0
      }

      if (dayData?.hasPlans && dayData?.priorityCompleted) {
        currentExecution++
        bestExecutionStreak = Math.max(bestExecutionStreak, currentExecution)
      } else if (dayData?.hasPlans) {
        currentExecution = 0
      }
      // Unplanned days don't reset execution streak
    }

    return NextResponse.json({
      planning: {
        current: planningStreak,
        best: bestPlanningStreak,
        label: planningStreak === 0 ? 'Start planning' : `${planningStreak} day${planningStreak !== 1 ? 's' : ''}`,
      },
      execution: {
        current: executionStreak,
        best: bestExecutionStreak,
        label: executionStreak === 0 ? 'Complete your #1 task' : `${executionStreak} day${executionStreak !== 1 ? 's' : ''}`,
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
