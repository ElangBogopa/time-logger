import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { calculateDailyScore, calculateWeeklyScore, PlanItem } from '@/lib/productivity-score'

/**
 * GET /api/productivity-score?date=YYYY-MM-DD
 *   → Returns daily score for that date
 *
 * GET /api/productivity-score?date=YYYY-MM-DD&period=7d
 *   → Returns daily scores for the last 7 days + weekly summary
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const date = request.nextUrl.searchParams.get('date')
    const period = request.nextUrl.searchParams.get('period')

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Valid date param required (YYYY-MM-DD)' }, { status: 400 })
    }

    if (period === '7d') {
      // Fetch last 7 days of plans
      const startDate = getDateNDaysAgo(date, 6)

      const { data: plans, error } = await supabase
        .from('daily_plans')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('date', startDate)
        .lte('date', date)
        .order('date', { ascending: true })
        .order('sort_order', { ascending: true })

      if (error) {
        console.error('Error fetching plans for period:', error)
        return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 })
      }

      // Group plans by date
      const plansByDate = new Map<string, PlanItem[]>()
      for (const plan of (plans || []) as PlanItem[]) {
        const existing = plansByDate.get(plan.date) || []
        existing.push(plan)
        plansByDate.set(plan.date, existing)
      }

      // Calculate daily scores for each of the 7 days
      const dailyScores = []
      for (let i = 6; i >= 0; i--) {
        const d = getDateNDaysAgo(date, i)
        const dayPlans = plansByDate.get(d) || []
        const score = calculateDailyScore(dayPlans)
        score.date = d
        dailyScores.push(score)
      }

      const weekly = calculateWeeklyScore(dailyScores)

      return NextResponse.json({
        daily: dailyScores,
        weekly,
      })
    }

    // Single day
    const { data: plans, error } = await supabase
      .from('daily_plans')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('date', date)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching plans:', error)
      return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 })
    }

    const score = calculateDailyScore((plans || []) as PlanItem[])
    score.date = date

    return NextResponse.json(score)
  } catch (error) {
    console.error('Productivity score error:', error)
    return NextResponse.json({ error: 'Failed to calculate score' }, { status: 500 })
  }
}

function getDateNDaysAgo(fromDate: string, n: number): string {
  const d = new Date(fromDate + 'T12:00:00')
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}
