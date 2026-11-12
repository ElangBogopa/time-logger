import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '@/lib/auth'
import { deleteAccountData, revokeGoogleAccess, storedGoogleToken } from '@/lib/account-data'
import { DELETE_CONFIRMATION } from '@/lib/account-shared'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'

/** The sign-in cookie, with or without the secure prefix, whole or in numbered chunks. */
const SESSION_COOKIE = /^(__Secure-)?next-auth\.session-token(\.\d+)?$/

/**
 * DELETE /api/account — remove the signed-in person's account and everything in it.
 *
 * It acts on the session's own user id and takes no id from the request:
 * there is no way to ask it for someone else's account.
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const limit = checkRateLimit(`account-delete:${userId}`, RATE_LIMITS.auth)
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again in a minute.' },
        { status: 429, headers: getRateLimitHeaders(limit) }
      )
    }

    const body = await request.json().catch(() => null)
    if (body?.confirm !== DELETE_CONFIRMATION) {
      return NextResponse.json({ error: 'Confirmation missing' }, { status: 400 })
    }

    // Read the Google tokens before the rows that hold one are gone, and
    // use them only after: if the delete fails the person is still a user,
    // and should still have a calendar.
    const jwt = await getToken({ req: request }).catch(() => null)
    const tokens = [
      jwt?.refreshToken as string | undefined,
      await storedGoogleToken(userId),
      jwt?.accessToken as string | undefined,
    ]

    const result = await deleteAccountData(userId, session.user.email ?? null)
    if (!result.ok) {
      return NextResponse.json(
        {
          error: 'Not everything could be deleted, so your account is still here. Try again.',
          failed: result.failed,
        },
        { status: 500 }
      )
    }

    const googleAccessRevoked = await revokeGoogleAccess(tokens)

    const response = NextResponse.json({ deleted: true, googleAccessRevoked })
    // The sign-in cookie still names the account that has just gone. The
    // screen signs out too, but a request that never hears the answer
    // should not leave a session behind that can write under a dead id.
    for (const cookie of request.cookies.getAll()) {
      if (!SESSION_COOKIE.test(cookie.name)) continue
      response.cookies.set(cookie.name, '', {
        maxAge: 0,
        path: '/',
        secure: cookie.name.startsWith('__'),
        httpOnly: true,
        sameSite: 'lax',
      })
    }
    return response
  } catch (error) {
    console.error('[Account] Delete failed:', error)
    return NextResponse.json(
      { error: 'Something went wrong, and your account has not been deleted. Try again.' },
      { status: 500 }
    )
  }
}
