import { NextRequest, NextResponse } from 'next/server'
import { getAppSession } from '@/lib/session'
import OpenAI from 'openai'
import { TimeEntry } from '@/lib/types'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'
import { buildEntryFacts, CoachEntry } from '@/lib/coach-facts'
import {
  ENTRY_REMARK_PARAMS,
  buildEntryRemarkSystemPrompt,
  describeEntryFacts,
} from '@/lib/prompts'

interface CommentaryRequest {
  entry: TimeEntry
  dayEntries: TimeEntry[]
}

const toCoachEntry = (e: TimeEntry): CoachEntry => ({
  id: e.id,
  activity: String(e.activity ?? '').slice(0, 80),
  category: e.category ?? null,
  duration_minutes: e.duration_minutes,
  start_time: e.start_time ?? null,
  end_time: e.end_time ?? null,
  description: e.description ?? null,
})

export async function POST(request: NextRequest) {
  try {
    // Authentication check — prevent unauthorized OpenAI credit burn
    const session = await getAppSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit by user ID (authenticated) with IP fallback
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const rateLimitKey = `commentary:${session.user.id || ip}`
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.ai)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }

    const { entry, dayEntries }: CommentaryRequest = await request.json()

    if (!entry) {
      return NextResponse.json({ error: 'Entry is required' }, { status: 400 })
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000, // 30 second timeout
    })

    // Confirmed entries only: a pending plan has no category and no place in the rings.
    const day = (Array.isArray(dayEntries) ? dayEntries : [])
      .filter((e) => e && e.status !== 'pending')
      .slice(0, 120)
      .map(toCoachEntry)
    const facts = buildEntryFacts({ entry: toCoachEntry(entry), dayEntries: day })

    const completion = await openai.chat.completions.create({
      ...ENTRY_REMARK_PARAMS,
      messages: [
        { role: 'system', content: buildEntryRemarkSystemPrompt() },
        { role: 'user', content: describeEntryFacts(facts) },
      ],
    })

    const commentary = completion.choices[0]?.message?.content?.trim() || ''

    return NextResponse.json({ commentary })
  } catch (error) {
    console.error('Commentary generation error:', error)

    // Handle specific error types
    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        return NextResponse.json({ error: 'AI service is busy. Please try again in a moment.' }, { status: 503 })
      }
      if (error.status === 401) {
        return NextResponse.json({ error: 'AI service configuration error.' }, { status: 500 })
      }
    }

    // Handle timeout
    if (error instanceof Error && error.message.includes('timeout')) {
      return NextResponse.json({ error: 'Request timed out. Please try again.' }, { status: 504 })
    }

    return NextResponse.json({ error: 'Failed to generate commentary' }, { status: 500 })
  }
}
