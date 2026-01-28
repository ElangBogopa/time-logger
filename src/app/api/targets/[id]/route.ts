import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'

// PUT /api/targets/[id] - Update a single target
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { weekly_target_minutes, sort_order, active } = body as {
      weekly_target_minutes?: number
      sort_order?: number
      active?: boolean
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {}
    if (weekly_target_minutes !== undefined) {
      if (weekly_target_minutes <= 0) {
        return NextResponse.json(
          { error: 'Target minutes must be positive' },
          { status: 400 }
        )
      }
      updates.weekly_target_minutes = weekly_target_minutes
    }
    if (sort_order !== undefined) updates.sort_order = sort_order
    if (active !== undefined) updates.active = active

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    const { data: target, error } = await supabase
      .from('weekly_targets')
      .update(updates)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating target:', error)
      return NextResponse.json(
        { error: 'Failed to update target' },
        { status: 500 }
      )
    }

    if (!target) {
      return NextResponse.json(
        { error: 'Target not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ target })
  } catch (error) {
    console.error('Target update error:', error)
    return NextResponse.json(
      { error: 'Failed to update target' },
      { status: 500 }
    )
  }
}

// DELETE /api/targets/[id] - Soft delete (deactivate) a target
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { id } = await params

    const { error } = await supabase
      .from('weekly_targets')
      .update({ active: false })
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (error) {
      console.error('Error deleting target:', error)
      return NextResponse.json(
        { error: 'Failed to delete target' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Target deleted' })
  } catch (error) {
    console.error('Target delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete target' },
      { status: 500 }
    )
  }
}
