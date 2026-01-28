import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'

// GET /api/entries - Fetch time entries with flexible filters
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const status = searchParams.get('status')
    const fields = searchParams.get('fields') // e.g. "id,start_time,end_time,activity"
    const orderBy = searchParams.get('orderBy') || 'created_at'
    const orderAsc = searchParams.get('orderAsc') === 'true'

    let query = supabase
      .from('time_entries')
      .select(fields || '*')
      .eq('user_id', session.user.id)

    if (date) {
      query = query.eq('date', date)
    }
    if (dateFrom) {
      query = query.gte('date', dateFrom)
    }
    if (dateTo) {
      query = query.lte('date', dateTo)
    }
    if (status) {
      query = query.eq('status', status)
    }

    query = query.order(orderBy, { ascending: orderAsc })

    const { data, error } = await query

    if (error) {
      console.error('Error fetching entries:', error)
      return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Error in GET /api/entries:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/entries - Create a new time entry
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const entry = {
      user_id: session.user.id,
      date: body.date,
      activity: body.activity,
      category: body.category ?? null,
      duration_minutes: body.duration_minutes,
      start_time: body.start_time || null,
      end_time: body.end_time || null,
      description: body.description || null,
      commentary: body.commentary || null,
      status: body.status || 'confirmed',
    }

    if (!entry.date || !entry.activity || !entry.duration_minutes) {
      return NextResponse.json({ error: 'Missing required fields: date, activity, duration_minutes' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('time_entries')
      .insert(entry)
      .select()
      .single()

    if (error) {
      console.error('Error creating entry:', error)
      return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error in POST /api/entries:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
