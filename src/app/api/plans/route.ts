import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { isTaskCompletable } from '@/lib/types'

// GET /api/plans?date=YYYY-MM-DD - Fetch user's plan items for a date
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const date = request.nextUrl.searchParams.get('date')
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Valid date param required (YYYY-MM-DD)' }, { status: 400 })
    }

    const { data: plans, error } = await supabase
      .from('daily_plans')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('date', date)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching plans:', error)
      return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 })
    }

    return NextResponse.json({ plans: plans || [] })
  } catch (error) {
    console.error('Plans fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 })
  }
}

// POST /api/plans - Create a plan item
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { date, title, goal_id } = body

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Valid date required (YYYY-MM-DD)' }, { status: 400 })
    }
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Get current max sort_order for this date
    const { data: existing } = await supabase
      .from('daily_plans')
      .select('sort_order')
      .eq('user_id', session.user.id)
      .eq('date', date)
      .order('sort_order', { ascending: false })
      .limit(1)

    const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

    const { data: plan, error } = await supabase
      .from('daily_plans')
      .insert({
        user_id: session.user.id,
        date,
        title: title.trim(),
        goal_id: goal_id || null,
        sort_order: nextOrder,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating plan:', error)
      return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 })
    }

    return NextResponse.json({ plan }, { status: 201 })
  } catch (error) {
    console.error('Plan create error:', error)
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 })
  }
}

// PATCH /api/plans - Update a plan item (toggle completed, edit title)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { id, completed, title, committed_start, committed_end } = body

    if (!id) {
      return NextResponse.json({ error: 'Plan id required' }, { status: 400 })
    }

    // If toggling completion, enforce date restriction (today + yesterday only)
    if (typeof completed === 'boolean') {
      const { data: existingPlan } = await supabase
        .from('daily_plans')
        .select('date')
        .eq('id', id)
        .eq('user_id', session.user.id)
        .single()

      if (existingPlan && !isTaskCompletable(existingPlan.date)) {
        return NextResponse.json(
          { error: 'Tasks can only be checked off for today and yesterday' },
          { status: 403 }
        )
      }
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof completed === 'boolean') updates.completed = completed
    if (typeof title === 'string' && title.trim()) updates.title = title.trim()
    // Time commitment (HH:MM format or null to clear)
    if (committed_start !== undefined) updates.committed_start = committed_start
    if (committed_end !== undefined) updates.committed_end = committed_end

    const { data: plan, error } = await supabase
      .from('daily_plans')
      .update(updates)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating plan:', error)
      return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
    }

    return NextResponse.json({ plan })
  } catch (error) {
    console.error('Plan update error:', error)
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
  }
}

// DELETE /api/plans?id=xxx - Delete a plan item
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Plan id required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('daily_plans')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (error) {
      console.error('Error deleting plan:', error)
      return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Plan delete error:', error)
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 })
  }
}
