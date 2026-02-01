import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { getUserToday, getRealToday } from '@/lib/types'

export interface MorningCheckinData {
  sleep_quality: 'poor' | 'okay' | 'good'
  energy_level: 'low' | 'medium' | 'high'
  priority_text: string | null
  date: string
}

// GET /api/morning-checkin - Check if today's check-in exists
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || getUserToday()

    // Try Supabase first
    try {
      const { data, error } = await supabase
        .from('morning_checkins')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('date', date)
        .single()

      if (error && error.code !== 'PGRST116') {
        // Table might not exist — return null so client falls back to localStorage
        console.warn('morning_checkins table query failed:', error.message)
        return NextResponse.json({ checkin: null, storage: 'localStorage' })
      }

      return NextResponse.json({ checkin: data || null, storage: 'supabase' })
    } catch {
      // Table doesn't exist — signal client to use localStorage
      return NextResponse.json({ checkin: null, storage: 'localStorage' })
    }
  } catch (error) {
    console.error('Error in GET /api/morning-checkin:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/morning-checkin - Save morning check-in data
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sleep_quality, energy_level, priority_text, date } = body as MorningCheckinData

    // Validate
    if (!sleep_quality || !['poor', 'okay', 'good'].includes(sleep_quality)) {
      return NextResponse.json({ error: 'Invalid sleep_quality' }, { status: 400 })
    }
    if (!energy_level || !['low', 'medium', 'high'].includes(energy_level)) {
      return NextResponse.json({ error: 'Invalid energy_level' }, { status: 400 })
    }

    const checkinDate = date || getRealToday()

    // Try Supabase first
    try {
      const { data, error } = await supabase
        .from('morning_checkins')
        .upsert({
          user_id: session.user.id,
          date: checkinDate,
          sleep_quality,
          energy_level,
          priority_text: priority_text || null,
        }, {
          onConflict: 'user_id,date',
        })
        .select()
        .single()

      if (error) {
        // Table might not exist — signal client to use localStorage fallback
        console.warn('morning_checkins upsert failed:', error.message)
        return NextResponse.json({
          checkin: {
            sleep_quality,
            energy_level,
            priority_text: priority_text || null,
            date: checkinDate,
          },
          storage: 'localStorage',
        })
      }

      return NextResponse.json({ checkin: data, storage: 'supabase' })
    } catch {
      // Table doesn't exist — return the data for localStorage storage
      return NextResponse.json({
        checkin: {
          sleep_quality,
          energy_level,
          priority_text: priority_text || null,
          date: checkinDate,
        },
        storage: 'localStorage',
      })
    }
  } catch (error) {
    console.error('Error in POST /api/morning-checkin:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
