import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'

// GET /api/goals - Fetch user's active goals
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: goals, error } = await supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching goals:', error)
      return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
    }

    return NextResponse.json({ goals: goals || [] })
  } catch (error) {
    console.error('Goals fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
  }
}

// POST /api/goals - Create a new goal
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Prevent duplicate goals with the same title
    const { data: duplicate } = await supabase
      .from('user_goals')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('title', title.trim())
      .eq('active', true)
      .limit(1)

    if (duplicate && duplicate.length > 0) {
      return NextResponse.json(
        { error: 'A goal with this title already exists' },
        { status: 409 }
      )
    }

    // Get current max sort_order
    const { data: existing } = await supabase
      .from('user_goals')
      .select('sort_order')
      .eq('user_id', session.user.id)
      .eq('active', true)
      .order('sort_order', { ascending: false })
      .limit(1)

    const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

    const { data: goal, error } = await supabase
      .from('user_goals')
      .insert({
        user_id: session.user.id,
        title: title.trim(),
        description: description?.trim() || null,
        sort_order: nextOrder,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating goal:', error)
      return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 })
    }

    return NextResponse.json({ goal }, { status: 201 })
  } catch (error) {
    console.error('Goal create error:', error)
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 })
  }
}
