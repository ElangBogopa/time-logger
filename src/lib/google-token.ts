import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { supabase } from './supabase-server'
import type { AppSession } from './session'

/**
 * A Google access token to read someone's calendar and tasks with.
 *
 * There are two places one can come from: the sign-in itself, when the
 * person signed in with Google, or `calendar_connections`, when they linked
 * a Google account separately. Routes ask here and never look in either
 * place themselves, so the sign-in provider can change without them.
 *
 * Read-only by design: nothing here, or anywhere, writes to Google.
 */

export type GoogleTokenSource = 'session' | 'connection'

export interface GoogleAccessToken {
  accessToken: string | null
  source: GoogleTokenSource | null
}

/** The tokens the Google sign-in left in the session, if it was one. */
export async function getSignInGoogleTokens(
  request: NextRequest
): Promise<{ accessToken?: string; refreshToken?: string }> {
  const jwt = await getToken({ req: request }).catch(() => null)
  return { accessToken: jwt?.accessToken, refreshToken: jwt?.refreshToken }
}

export async function getGoogleAccessToken(
  request: NextRequest,
  session: AppSession
): Promise<GoogleAccessToken> {
  if (session.authProvider === 'google') {
    const { accessToken } = await getSignInGoogleTokens(request)
    if (accessToken) return { accessToken, source: 'session' }
  }

  const userId = session.user.id
  if (!userId) return { accessToken: null, source: null }

  const { data: connection } = await supabase
    .from('calendar_connections')
    .select('google_access_token, google_refresh_token, token_expires_at')
    .eq('user_id', userId)
    .single()

  if (!connection) return { accessToken: null, source: null }

  const isExpired = connection.token_expires_at && new Date(connection.token_expires_at) < new Date()
  if (isExpired && connection.google_refresh_token) {
    const refreshed = await refreshConnectionToken(userId, connection.google_refresh_token)
    if (refreshed) return { accessToken: refreshed, source: 'connection' }
  }

  return { accessToken: connection.google_access_token, source: 'connection' }
}

async function refreshConnectionToken(userId: string, refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })
    const tokens = await response.json()
    if (!response.ok || !tokens.access_token) {
      console.error('[Google token] Refresh failed:', tokens?.error ?? response.status)
      return null
    }

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null
    await supabase
      .from('calendar_connections')
      .update({ google_access_token: tokens.access_token, token_expires_at: expiresAt })
      .eq('user_id', userId)

    return tokens.access_token
  } catch (error) {
    console.error('[Google token] Refresh threw:', error)
    return null
  }
}
