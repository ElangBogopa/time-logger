import { NextRequest, NextResponse } from 'next/server'
import { getAppSession } from '@/lib/session'
import OpenAI from 'openai'
import { buildReadSystemPrompt, describeRead, DAY_REVIEW_PARAMS } from '@/lib/prompts'
import { sanitiseRead } from '@/lib/review-read'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * The words for the day review's read. The client has chosen the read by
 * fixed rules (lib/review-read.ts) and sends only its kind and its fact
 * sentences; nothing else from the request reaches the prompt.
 */
export async function POST(request: NextRequest) {
  const session = await getAppSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit by user ID (authenticated) with IP fallback
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const rateLimitKey = `day-commentary:${session.user.id || ip}`
  const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.ai)

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    )
  }

  let read: ReturnType<typeof sanitiseRead> = null
  try {
    const body = await request.json()
    read = sanitiseRead(body?.read)
  } catch {
    read = null
  }
  if (!read) {
    return NextResponse.json({ error: 'A read with a kind and one to six facts is required' }, { status: 400 })
  }

  try {
    const completion = await openai.chat.completions.create({
      ...DAY_REVIEW_PARAMS,
      messages: [
        { role: 'system', content: buildReadSystemPrompt('day', read.kind) },
        { role: 'user', content: describeRead(read) },
      ],
    })

    const commentary = completion.choices[0]?.message?.content?.trim() || ''

    return NextResponse.json({ commentary })
  } catch (error) {
    console.error('Error generating day commentary:', error)
    return NextResponse.json({ error: 'Failed to generate commentary' }, { status: 500 })
  }
}
