import { NextRequest, NextResponse } from 'next/server'
import { getAppSession } from '@/lib/session'
import OpenAI from 'openai'
import { buildDayReviewPrompt, DAY_REVIEW_PARAMS, type DayReviewPromptInput } from '@/lib/prompts'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

type DayData = DayReviewPromptInput

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

  try {
    const body: DayData = await request.json()
    // `hours` is request input that goes into a prompt: keep only well-formed
    // entries, cap the count and the label length.
    const hours = (Array.isArray(body.hours) ? body.hours : [])
      .filter(
        (c) =>
          c &&
          typeof c.label === 'string' &&
          typeof c.minutes === 'number' &&
          Number.isFinite(c.minutes) &&
          c.minutes > 0
      )
      .slice(0, 19)
      .map((c) => ({ label: c.label.slice(0, 40), minutes: c.minutes }))
    const dayData: DayData = { ...body, hours }

    const prompt = buildDayReviewPrompt(dayData)

    const completion = await openai.chat.completions.create({
      ...DAY_REVIEW_PARAMS,
      messages: [{ role: 'user', content: prompt }],
    })

    const commentary = completion.choices[0]?.message?.content?.trim() || ''

    return NextResponse.json({ commentary })
  } catch (error) {
    console.error('Error generating day commentary:', error)
    return NextResponse.json({ error: 'Failed to generate commentary' }, { status: 500 })
  }
}
