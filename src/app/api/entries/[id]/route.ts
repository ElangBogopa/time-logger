import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'

// PUT /api/entries/[id] - Update a time entry
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
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
    const { data, error } = await supabase
      .from('time_entries')
      .update(updates)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating entry:', error)
      return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
    }

    if (!data) {
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
    const session = await getServerSession(authOptions)
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
