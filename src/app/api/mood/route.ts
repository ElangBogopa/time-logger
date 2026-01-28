import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { MoodLevel, MoodCheckin, TimePeriod, getUserToday } from '@/lib/types'

// GET /api/mood - Get mood check-in for a specific date and period
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || getUserToday()
    const period = searchParams.get('period') as TimePeriod | null

    // If period is specified, get that specific check-in
    if (period) {
      if (!['morning', 'afternoon', 'evening'].includes(period)) {
        return NextResponse.json({ error: 'Invalid period value' }, { status: 400 })
      }

      const { data, error } = await supabase
        .from('mood_checkins')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('date', date)
        .eq('period', period)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching mood check-in:', error)
        return NextResponse.json({ error: 'Failed to fetch mood check-in' }, { status: 500 })
      }

      return NextResponse.json({ checkin: data as MoodCheckin | null })
    }

    // If no period specified, get all check-ins for the date
    const { data, error } = await supabase
      .from('mood_checkins')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('date', date)
      .order('created_at')

    if (error) {
      console.error('Error fetching mood check-ins:', error)
      return NextResponse.json({ error: 'Failed to fetch mood check-ins' }, { status: 500 })
    }

    return NextResponse.json({ checkins: data as MoodCheckin[] })
  } catch (error) {
    console.error('Error in GET /api/mood:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/mood - Create or update a mood check-in for a specific period
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { mood, period, date } = body as { mood: MoodLevel; period: TimePeriod; date?: string }

    // Validate mood
    if (!mood || !['low', 'okay', 'great'].includes(mood)) {
      return NextResponse.json({ error: 'Invalid mood value' }, { status: 400 })
    }

    // Validate period
    if (!period || !['morning', 'afternoon', 'evening'].includes(period)) {
      return NextResponse.json({ error: 'Invalid or missing period value' }, { status: 400 })
    }

    const checkInDate = date || getUserToday()

    // Upsert the mood check-in (one per day per user per period)
    const { data, error } = await supabase
      .from('mood_checkins')
      .upsert({
        user_id: session.user.id,
        date: checkInDate,
        period,
        mood,
      }, {
        onConflict: 'user_id,date,period',
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving mood check-in:', error)
      return NextResponse.json({ error: 'Failed to save mood check-in' }, { status: 500 })
    }

    return NextResponse.json({ checkin: data as MoodCheckin })
  } catch (error) {
    console.error('Error in POST /api/mood:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
