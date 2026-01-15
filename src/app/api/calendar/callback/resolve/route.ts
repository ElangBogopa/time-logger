import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    console.log('[Resolve] Starting resolution, session.user.id:', session?.user?.id)

    if (!session?.user?.id) {
      console.log('[Resolve] No session user ID')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { pending_id, action } = await request.json()
    console.log('[Resolve] Request:', { pending_id, action })

    if (!pending_id) {
      return NextResponse.json({ error: 'Missing pending_id' }, { status: 400 })
    }

    // Get the pending connection
    const { data: pending, error: fetchError } = await supabase
      .from('pending_calendar_connections')
      .select('*')
      .eq('id', pending_id)
      .eq('user_id', session.user.id) // Ensure it belongs to this user
      .single()

    console.log('[Resolve] Pending lookup result:', { found: !!pending, error: fetchError?.message })

    if (fetchError || !pending) {
      console.error('[Resolve] Pending connection not found:', fetchError)
      return NextResponse.json(
        { error: 'Connection request expired or not found' },
        { status: 404 }
      )
    }

    // Check if the pending connection has expired
    if (new Date(pending.expires_at) < new Date()) {
      // Clean up expired record
      await supabase
        .from('pending_calendar_connections')
        .delete()
        .eq('id', pending_id)

      return NextResponse.json(
        { error: 'Connection request has expired. Please try again.' },
        { status: 410 }
      )
    }

    if (action === 'calendar_only') {
      // User chose to connect calendar only - save to calendar_connections
      console.log('[Resolve] Saving calendar connection for user:', session.user.id, 'email:', pending.google_email)
      const { error: upsertError } = await supabase
        .from('calendar_connections')
        .upsert({
          user_id: session.user.id,
          google_email: pending.google_email,
          google_access_token: pending.google_access_token,
          google_refresh_token: pending.google_refresh_token,
          token_expires_at: pending.token_expires_at,
        }, {
          onConflict: 'user_id',
        })

      if (upsertError) {
        console.error('[Resolve] Failed to save calendar connection:', upsertError)
        return NextResponse.json(
          { error: 'Failed to save calendar connection' },
          { status: 500 }
        )
      }

      console.log('[Resolve] Successfully saved calendar connection')

      // Clean up the pending record
      await supabase
        .from('pending_calendar_connections')
        .delete()
        .eq('id', pending_id)

      console.log('[Resolve] Cleaned up pending record')
      return NextResponse.json({ success: true })
    } else if (action === 'cancel') {
      // User cancelled - just clean up the pending record
      await supabase
        .from('pending_calendar_connections')
        .delete()
        .eq('id', pending_id)

      return NextResponse.json({ success: true, cancelled: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[Resolve] Error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
