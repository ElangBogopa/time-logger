import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'

// GET /api/streaks - Fetch user streaks
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', session.user.id)

    if (error) {
      console.error('Error fetching streaks:', error)
      return NextResponse.json({ error: 'Failed to fetch streaks' }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Error in GET /api/streaks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/streaks - Upsert a user streak
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      streak_type,
      personal_best_days,
      personal_best_achieved_at,
      current_streak_days,
      current_streak_start_date,
    } = body

    if (!streak_type) {
      return NextResponse.json({ error: 'Missing required field: streak_type' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('user_streaks')
      .upsert({
        user_id: session.user.id,
        streak_type,
        personal_best_days: personal_best_days ?? 0,
        personal_best_achieved_at: personal_best_achieved_at || null,
        current_streak_days: current_streak_days ?? 0,
        current_streak_start_date: current_streak_start_date || null,
        last_calculated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,streak_type',
      })
      .select()
      .single()

    if (error) {
      console.error('Error upserting streak:', error)
      return NextResponse.json({ error: 'Failed to save streak' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error in POST /api/streaks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
