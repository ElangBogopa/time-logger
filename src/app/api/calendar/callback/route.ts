import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface StateData {
  userId: string
  redirect: string
}

function parseState(state: string): StateData | null {
  try {
    const decoded = Buffer.from(state, 'base64').toString('utf-8')
    return JSON.parse(decoded)
  } catch {
    // Fallback for old format (just userId string)
    return { userId: state, redirect: '/' }
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Default redirect path
    let redirectPath = '/settings/connections'

    if (error) {
      console.error('[Calendar Callback] OAuth error:', error)
      return NextResponse.redirect(new URL(`${redirectPath}?error=calendar_auth_denied`, process.env.NEXTAUTH_URL))
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL(`${redirectPath}?error=calendar_invalid_response`, process.env.NEXTAUTH_URL))
    }

    // Parse state to get user ID and redirect path
    const stateData = parseState(state)
    if (!stateData) {
      return NextResponse.redirect(new URL(`${redirectPath}?error=calendar_invalid_response`, process.env.NEXTAUTH_URL))
    }

    redirectPath = stateData.redirect || '/settings/connections'

    // Verify user is still logged in
    const session = await getServerSession(authOptions)
    console.log('[Calendar Callback] Session user.id:', session?.user?.id, 'State userId:', stateData.userId, 'Match:', session?.user?.id === stateData.userId)

    if (!session?.user?.id || session.user.id !== stateData.userId) {
      console.log('[Calendar Callback] User ID mismatch or missing, redirecting to login')
      return NextResponse.redirect(new URL('/login', process.env.NEXTAUTH_URL))
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/calendar/callback`,
      }),
    })

    const tokens = await tokenResponse.json()

    if (!tokenResponse.ok || !tokens.access_token) {
      console.error('[Calendar Callback] Token exchange failed:', tokens)
      return NextResponse.redirect(new URL(`${redirectPath}?error=calendar_token_failed`, process.env.NEXTAUTH_URL))
    }

    // Get the Google user's email
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })

    const googleUser = await userInfoResponse.json()
    const googleEmail = googleUser.email

    if (!googleEmail) {
      return NextResponse.redirect(new URL(`${redirectPath}?error=calendar_email_failed`, process.env.NEXTAUTH_URL))
    }

    // Check if this Google email is already registered as a different user
    const { data: existingGoogleUser } = await supabase
      .from('users')
      .select('id, email, auth_provider')
      .eq('email', googleEmail.toLowerCase())
      .single()

    // If Google email belongs to a different user, show conflict
    if (existingGoogleUser && existingGoogleUser.id !== session.user.id) {
      console.log('[Calendar Callback] Account conflict detected:', googleEmail, 'belongs to user:', existingGoogleUser.id, 'current user:', session.user.id)

      // Calculate token expiration
      const tokenExpiresAt = tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null

      // Store the tokens temporarily in pending_calendar_connections
      const { data: pendingConnection, error: pendingError } = await supabase
        .from('pending_calendar_connections')
        .insert({
          user_id: session.user.id,
          google_email: googleEmail,
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token,
          token_expires_at: tokenExpiresAt,
        })
        .select('id')
        .single()

      if (pendingError || !pendingConnection) {
        console.error('[Calendar Callback] Failed to store pending connection:', pendingError)
        return NextResponse.redirect(new URL(`${redirectPath}?error=calendar_save_failed`, process.env.NEXTAUTH_URL))
      }

      // Redirect with pending ID and conflict email
      const conflictParams = new URLSearchParams({
        conflict_email: googleEmail,
        pending_id: pendingConnection.id,
      })
      return NextResponse.redirect(new URL(`${redirectPath}?${conflictParams.toString()}`, process.env.NEXTAUTH_URL))
    }

    // No conflict - save the connection
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null

    console.log('[Calendar Callback] Saving connection for user_id:', session.user.id, 'google_email:', googleEmail)
    const { error: upsertError } = await supabase
      .from('calendar_connections')
      .upsert({
        user_id: session.user.id,
        google_email: googleEmail,
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
      }, {
        onConflict: 'user_id',
      })

    if (upsertError) {
      console.error('[Calendar Callback] Failed to save calendar connection:', upsertError)
      return NextResponse.redirect(new URL(`${redirectPath}?error=calendar_save_failed`, process.env.NEXTAUTH_URL))
    }

    console.log('[Calendar Callback] Successfully saved calendar connection')

    // Success - redirect with success message
    return NextResponse.redirect(new URL(`${redirectPath}?success=true`, process.env.NEXTAUTH_URL))
  } catch (error) {
    console.error('[Calendar Callback] Error:', error)
    return NextResponse.redirect(new URL('/settings/connections?error=calendar_callback_failed', process.env.NEXTAUTH_URL))
  }
}
