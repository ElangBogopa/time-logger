import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { supabase } from './supabase-server'
import type { AppSession } from './session'
import { refreshGoogleAccessToken, type GoogleRefreshResult } from './google-refresh'

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
  /** Why there is no token although a Google account is connected.
   *  'reconnect': Google refused the grant; only signing in again fixes it.
   *  'unavailable': Google could not be reached; trying later may work. */
  problem?: 'reconnect' | 'unavailable'
}

/** A token this close to its expiry is treated as already expired. */
const EXPIRY_MARGIN_MS = 60_000

/** The decoded sign-in cookie, or null when it cannot be read. */
function readSignInJwt(request: NextRequest) {
  return getToken({ req: request }).catch(() => null)
}

/** The tokens the Google sign-in left in the session, if it was one. */
export async function getSignInGoogleTokens(
  request: NextRequest
): Promise<{ accessToken?: string; refreshToken?: string }> {
  const jwt = await readSignInJwt(request)
  return { accessToken: jwt?.accessToken, refreshToken: jwt?.refreshToken }
}

/**
 * A token that is good now, or none and the reason why.
 *
 * It never returns a token past its expiry: it renews it, or answers with
 * no token and a `problem`. Only 'reconnect' means the person must sign in
 * again.
 */
export async function getGoogleAccessToken(
  request: NextRequest,
  session: AppSession
): Promise<GoogleAccessToken> {
  let problem: GoogleAccessToken['problem']
  const none = (): GoogleAccessToken =>
    problem ? { accessToken: null, source: null, problem } : { accessToken: null, source: null }
  const fail = (result: Extract<GoogleRefreshResult, { ok: false }>) => {
    problem ??= result.reason === 'refused' ? 'reconnect' : 'unavailable'
  }

  if (session.authProvider === 'google') {
    const jwt = await readSignInJwt(request)
    if (jwt?.accessToken) {
      const expires = jwt.accessTokenExpires
      if (!expires || Date.now() < expires - EXPIRY_MARGIN_MS) {
        return { accessToken: jwt.accessToken, source: 'session' }
      }
      if (jwt.refreshToken) {
        const renewed = await refreshGoogleAccessToken(jwt.refreshToken)
        // Not stored anywhere: a route handler cannot write the sign-in
        // cookie. The browser's next /api/auth/session call does that.
        if (renewed.ok) return { accessToken: renewed.accessToken, source: 'session' }
        fail(renewed)
      } else {
        problem = 'reconnect'
      }
    }
  }

  const userId = session.user.id
  if (!userId) return none()

  const { data: connection } = await supabase
    .from('calendar_connections')
    .select('google_access_token, google_refresh_token, token_expires_at')
    .eq('user_id', userId)
    .single()

  if (!connection) return none()

  const isExpired = connection.token_expires_at && new Date(connection.token_expires_at) < new Date()
  if (!isExpired) return { accessToken: connection.google_access_token, source: 'connection' }

  if (!connection.google_refresh_token) {
    problem ??= 'reconnect'
    return none()
  }

  const renewed = await refreshConnectionToken(userId, connection.google_refresh_token)
  if (renewed.ok) return { accessToken: renewed.accessToken, source: 'connection' }
  fail(renewed)
  return none()
}

async function refreshConnectionToken(userId: string, refreshToken: string): Promise<GoogleRefreshResult> {
  const result = await refreshGoogleAccessToken(refreshToken)
  if (result.ok) {
    await supabase
      .from('calendar_connections')
      .update({
        google_access_token: result.accessToken,
        token_expires_at: result.expiresAt ? new Date(result.expiresAt).toISOString() : null,
      })
      .eq('user_id', userId)
  }
  return result
}
