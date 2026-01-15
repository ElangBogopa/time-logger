import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      console.log('[Calendar Status] No session.user.id')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Calendar Status] User ID:', session.user.id, 'Auth provider:', session.authProvider)

    // Google OAuth users have calendar access built-in
    if (session.authProvider === 'google' && session.accessToken) {
      return NextResponse.json({
        connected: true,
        source: 'google_oauth',
        googleEmail: session.user.email,
      })
    }

    // Email users need to check calendar_connections table
    console.log('[Calendar Status] Checking calendar_connections for user_id:', session.user.id)
    const { data: connection, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('google_email, connected_at, token_expires_at')
      .eq('user_id', session.user.id)
      .single()

    console.log('[Calendar Status] Connection query result:', connection ? 'found' : 'not found', connectionError?.message || '')

    if (connection) {
      return NextResponse.json({
        connected: true,
        source: 'calendar_connection',
        googleEmail: connection.google_email,
        connectedAt: connection.connected_at,
      })
    }

    return NextResponse.json({
      connected: false,
      source: null,
      googleEmail: null,
    })
  } catch (error) {
    console.error('Calendar status error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}

// DELETE to disconnect calendar
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Can't disconnect if using Google OAuth (calendar is tied to auth)
    if (session.authProvider === 'google') {
      return NextResponse.json(
        { error: 'Cannot disconnect calendar when signed in with Google' },
        { status: 400 }
      )
    }

    // Get the current connection to revoke the token
    const { data: connection } = await supabase
      .from('calendar_connections')
      .select('google_access_token')
      .eq('user_id', session.user.id)
      .single()

    if (connection?.google_access_token) {
      // Attempt to revoke the Google token (best effort)
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${connection.google_access_token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      } catch (revokeError) {
        console.error('Failed to revoke Google token:', revokeError)
        // Continue anyway - token will expire
      }
    }

    // Delete calendar connection
    const { error } = await supabase
      .from('calendar_connections')
      .delete()
      .eq('user_id', session.user.id)

    if (error) {
      console.error('Failed to disconnect calendar:', error)
      return NextResponse.json(
        { error: 'Failed to disconnect' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Calendar disconnect error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
