import { NextResponse } from 'next/server'
import { getAppSession } from '@/lib/session'
import { supabase } from '@/lib/supabase-server'

// GET /api/goals - Fetch user's active goals.
//
// Goals are no longer shown or created. This stays only so an older account
// with a saved goal but no set-up flag is still recognised as set up
// (useDashboardState). The user_goals rows are kept, and are still exported
// and deleted with the account.
export async function GET() {
  try {
    const session = await getAppSession()
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
