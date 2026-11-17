import { NextRequest, NextResponse } from 'next/server'
import { getAppSession } from '@/lib/session'
import { supabase } from '@/lib/supabase-server'
import { planOvernightSave } from '@/lib/overnight'

/** HH:MM of a stored or sent time, for telling whether a save moves it. */
function clock(time: unknown): string | null {
  return typeof time === 'string' && time ? time.slice(0, 5) : null
}

// PUT /api/entries/[id] - Update a time entry
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAppSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Only allow updating specific fields
    const allowedFields = [
      'date', 'activity', 'category', 'duration_minutes',
      'start_time', 'end_time', 'description', 'commentary', 'status',
    ]
    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Ensure user owns this entry
    const { data: stored, error: readError } = await supabase
      .from('time_entries')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (readError) {
      console.error('Error reading entry:', readError)
      return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
    }
    if (!stored) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    // Across midnight (lib/overnight.ts), only when this save moves the
    // times. A save of the category, status, date or words alone is written
    // as it is: it neither splits nor rejoins, and confirming a plan changes
    // nothing about its times. `overnight_sleep` says a planned (category
    // null) entry is a sleep; it is never written.
    const timesChange =
      ('start_time' in updates && clock(updates.start_time) !== clock(stored.start_time)) ||
      ('end_time' in updates && clock(updates.end_time) !== clock(stored.end_time))

    let inserted: { id: string } | null = null
    if (timesChange) {
      const merged = { ...stored, ...updates }
      const isSleep =
        merged.category === 'sleep' || (merged.category == null && body.overnight_sleep === true)
      const pieces = planOvernightSave(merged, isSleep)
      const [first, second] = pieces

      updates.start_time = first.start_time
      updates.end_time = first.end_time
      updates.duration_minutes = first.duration_minutes

      if (second) {
        const { data: secondRow, error: insertError } = await supabase
          .from('time_entries')
          .insert({
            user_id: session.user.id,
            date: second.date,
            activity: merged.activity,
            category: merged.category ?? null,
            duration_minutes: second.duration_minutes,
            start_time: second.start_time,
            end_time: second.end_time,
            description: merged.description ?? null,
            commentary: merged.commentary ?? null,
            status: merged.status,
          })
          .select()
          .single()

        if (insertError || !secondRow) {
          console.error('Error inserting second piece:', insertError)
          return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
        }
        inserted = secondRow
      }
    }

    const { data, error } = await supabase
      .from('time_entries')
      .update(updates)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (error || !data) {
      // The second piece must not outlive a first piece that never moved.
      if (inserted) {
        await supabase
          .from('time_entries')
          .delete()
          .eq('id', inserted.id)
          .eq('user_id', session.user.id)
      }
      if (error || inserted) {
        console.error('Error updating entry:', error)
        return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
      }
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error in PUT /api/entries/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/entries/[id] - Delete a time entry
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAppSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Ensure user owns this entry
    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (error) {
      console.error('Error deleting entry:', error)
      return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/entries/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
