import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { collectAccountData, entriesToCsv } from '@/lib/account-data'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'

/**
 * GET /api/account/export — everything held about the signed-in person.
 *
 * `?format=csv` gives the log alone as a spreadsheet; anything else gives
 * the whole account as JSON.
 *
 * It lives under /api/account and not /api/user because the service worker
 * caches every /api/user response for offline use, and a copy of someone's
 * entire history should not be left in a browser cache.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limit = checkRateLimit(`account-export:${session.user.id}`, RATE_LIMITS.auth)
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Too many exports at once. Try again in a minute.' },
        { status: 429, headers: getRateLimitHeaders(limit) }
      )
    }

    const data = await collectAccountData(session.user.id)
    const csv = new URL(request.url).searchParams.get('format') === 'csv'

    const body = csv
      ? entriesToCsv((data.entries as Record<string, unknown>[] | undefined) ?? [])
      : JSON.stringify(data, null, 2)

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': csv ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="better-export.${csv ? 'csv' : 'json'}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[Account] Export failed:', error)
    return NextResponse.json({ error: 'Your data could not be exported. Try again.' }, { status: 500 })
  }
}
