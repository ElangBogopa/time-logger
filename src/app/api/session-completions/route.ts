import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'

// GET /api/session-completions - Fetch session completions
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const period = searchParams.get('period')

    let query = supabase
      .from('session_completions')
      .select('*')
      .eq('user_id', session.user.id)

    if (date) {
      query = query.eq('date', date)
    }
    if (period) {
      query = query.eq('period', period)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching session completions:', error)
      return NextResponse.json({ error: 'Failed to fetch session completions' }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Error in GET /api/session-completions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/session-completions - Create or upsert a session completion
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { date, period, entry_count, total_minutes, skipped } = body

    if (!date || !period) {
      return NextResponse.json({ error: 'Missing required fields: date, period' }, { status: 400 })
    }

    if (!['morning', 'afternoon', 'evening'].includes(period)) {
      return NextResponse.json({ error: 'Invalid period' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('session_completions')
      .upsert({
        user_id: session.user.id,
        date,
        period,
        entry_count: entry_count ?? 0,
        total_minutes: total_minutes ?? 0,
        skipped: skipped ?? false,
      }, {
        onConflict: 'user_id,date,period',
      })
      .select()
      .single()

    if (error) {
      console.error('Error upserting session completion:', error)
      return NextResponse.json({ error: 'Failed to save session completion' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error in POST /api/session-completions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
