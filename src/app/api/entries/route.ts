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
    // Whitelist allowed select fields to prevent injection
    const ALLOWED_FIELDS = ['id', 'user_id', 'date', 'activity', 'category', 'duration_minutes', 'start_time', 'end_time', 'description', 'commentary', 'status', 'created_at', 'updated_at', 'mood', 'energy', 'deleted_at']
    const rawFields = searchParams.get('fields') // e.g. "id,start_time,end_time,activity"
    const fields = rawFields
      ? rawFields.split(',').filter(f => ALLOWED_FIELDS.includes(f.trim())).join(',') || '*'
      : '*'
    const orderAsc = searchParams.get('orderAsc') === 'true'

    // Whitelist allowed orderBy columns to prevent SQL injection
    const ALLOWED_ORDER_COLUMNS = ['created_at', 'start_time', 'end_time', 'date', 'duration_minutes', 'activity', 'category']
    const requestedOrderBy = searchParams.get('orderBy') || 'created_at'
    const orderBy = ALLOWED_ORDER_COLUMNS.includes(requestedOrderBy) ? requestedOrderBy : 'created_at'

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
// A batch is one person's session, not an import.
const MAX_BATCH = 25

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Batch form: { entries: [...] } → one insert, all or nothing. Repeating
    // a session or confirming a set of calendar events used to be one request
    // per entry, so a half-failed set left the day in pieces.
    const isBatch = Array.isArray(body.entries)
    const input: Record<string, unknown>[] = isBatch ? body.entries : [body]

    if (input.length === 0 || input.length > MAX_BATCH) {
      return NextResponse.json(
        { error: `Between 1 and ${MAX_BATCH} entries are required` },
        { status: 400 }
      )
    }

    const rows = input.map((item) => ({
      user_id: session.user!.id,
      date: item.date,
      activity: item.activity,
      category: item.category ?? null,
      duration_minutes: item.duration_minutes,
      start_time: item.start_time || null,
      end_time: item.end_time || null,
      description: item.description || null,
      commentary: item.commentary || null,
      status: item.status || 'confirmed',
    }))

    if (rows.some((row) => !row.date || !row.activity || !row.duration_minutes)) {
      return NextResponse.json({ error: 'Missing required fields: date, activity, duration_minutes' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('time_entries')
      .insert(rows)
      .select()

    if (error) {
      console.error('Error creating entry:', error)
      return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
    }

    // The single form keeps returning a single object: every existing caller
    // reads `data.id`.
    return NextResponse.json({ data: isBatch ? data : data?.[0] })
  } catch (error) {
    console.error('Error in POST /api/entries:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
