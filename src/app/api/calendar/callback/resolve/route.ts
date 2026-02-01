import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { pending_id, action } = await request.json()

    if (!pending_id) {
      return NextResponse.json({ error: 'Missing pending_id' }, { status: 400 })
    }

    if (!['calendar_only', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Call the Postgres function — runs as a single transaction
    const { data, error } = await supabase.rpc('resolve_calendar_connection', {
      p_user_id: session.user.id,
      p_pending_id: pending_id,
      p_action: action,
    })

    if (error) {
      console.error('[Resolve] Transaction failed:', error)

      // Handle specific error messages
      if (error.message?.includes('expired')) {
        return NextResponse.json(
          { error: 'Connection request has expired. Please try again.' },
          { status: 410 }
        )
      }
      if (error.message?.includes('not found')) {
        return NextResponse.json(
          { error: 'Connection request expired or not found' },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to resolve calendar connection' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[Resolve] Error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
