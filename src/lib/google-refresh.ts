/**
 * Ask Google for a new access token, given a refresh token.
 *
 * This is the only place the app does it. The sign-in (`lib/auth.ts`) and
 * the token lookup (`lib/google-token.ts`) each carried their own copy, and
 * the copies disagreed about what a failure meant.
 *
 * "refused" is kept narrow on purpose: it is Google's `invalid_grant`, which
 * means the refresh token is dead for good and only signing in again helps.
 * Everything else — a network blip, a 5xx, a 429 — is "unavailable", because
 * telling someone to sign in again when Google was merely unreachable is the
 * bug this file exists to end.
 *
 * Read-only in spirit: a refresh changes nothing of the person's at Google.
 * No `next-auth` and no database here, so both callers can use it.
 */

export type GoogleRefreshResult =
  | { ok: true; accessToken: string; expiresAt: number | null; refreshToken?: string }
  | { ok: false; reason: 'refused' | 'unavailable' }

export async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleRefreshResult> {
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
    const body = await response.json().catch(() => null)

    if (response.ok && typeof body?.access_token === 'string') {
      return {
        ok: true,
        accessToken: body.access_token,
        expiresAt: body.expires_in ? Date.now() + body.expires_in * 1000 : null,
        refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : undefined,
      }
    }

    console.error('[Google token] Refresh failed:', body?.error ?? response.status)
    return { ok: false, reason: body?.error === 'invalid_grant' ? 'refused' : 'unavailable' }
  } catch (error) {
    console.error('[Google token] Refresh threw:', error)
    return { ok: false, reason: 'unavailable' }
  }
}
