import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { IntentionType } from '@/lib/types'

// PUT /api/intentions/[id] - Update single intention
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
    const {
      intention_type,
      custom_text,
      weekly_target_minutes,
      priority,
      active
    } = body as {
      intention_type?: IntentionType
      custom_text?: string | null
      weekly_target_minutes?: number | null
      priority?: number
      active?: boolean
    }

    // Verify intention belongs to user
    const { data: existing } = await supabase
      .from('user_intentions')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: 'Intention not found' },
        { status: 404 }
      )
    }

    // Build update object
    const updates: Record<string, unknown> = {}
    if (intention_type !== undefined) updates.intention_type = intention_type
    if (custom_text !== undefined) updates.custom_text = custom_text
    if (weekly_target_minutes !== undefined) updates.weekly_target_minutes = weekly_target_minutes
    if (priority !== undefined) updates.priority = priority
    if (active !== undefined) updates.active = active

    const { data: updated, error: updateError } = await supabase
      .from('user_intentions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating intention:', updateError)
      return NextResponse.json(
        { error: 'Failed to update intention' },
        { status: 500 }
      )
    }

    return NextResponse.json({ intention: updated })
  } catch (error) {
    console.error('Intention update error:', error)
    return NextResponse.json(
      { error: 'Failed to update intention' },
      { status: 500 }
    )
  }
}

// DELETE /api/intentions/[id] - Remove intention (soft delete by setting active=false)
export async function DELETE(
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

    // Verify intention belongs to user and soft delete
    const { error: deleteError } = await supabase
      .from('user_intentions')
      .update({ active: false })
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (deleteError) {
      console.error('Error deleting intention:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete intention' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Intention removed' })
  } catch (error) {
    console.error('Intention delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete intention' },
      { status: 500 }
    )
  }
}
