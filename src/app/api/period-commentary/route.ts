import { NextRequest, NextResponse } from 'next/server'
import { getAppSession } from '@/lib/session'
import OpenAI from 'openai'
import { CATEGORIES, TimeCategory, TimePeriod } from '@/lib/types'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'
import { buildSessionFacts, CoachEntry } from '@/lib/coach-facts'
import type { PlanRow } from '@/lib/plan-adherence'
import { windowsForWake } from '@/lib/ideal-day'
import {
  SESSION_COMMENT_PARAMS,
  buildSessionCommentarySystemPrompt,
  describeSessionFacts,
} from '@/lib/prompts'

const PERIODS: readonly string[] = ['morning', 'afternoon', 'evening']
const DATE = /^\d{4}-\d{2}-\d{2}$/

type Raw = Record<string, unknown>
const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null

/** An integer minute past midnight, or null for anything else. */
function minuteOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1439 ? v : null
}

/** The client's entries are only ever read for what they say, so each is checked and trimmed. */
function cleanEntries(list: unknown, max: number): CoachEntry[] {
  if (!Array.isArray(list)) return []
  const out: CoachEntry[] = []
  for (const raw of list.slice(0, max)) {
    if (!isObject(raw)) continue
    const { id, activity, category, duration_minutes, start_time, end_time, description } = raw
    if (typeof activity !== 'string') continue
    if (typeof duration_minutes !== 'number' || !Number.isFinite(duration_minutes)) continue
    if (duration_minutes < 0 || duration_minutes > 1440) continue
    if (category !== null && category !== undefined && !CATEGORIES.includes(category as TimeCategory)) continue
    out.push({
      id: typeof id === 'string' ? id : `entry-${out.length}`,
      activity: activity.slice(0, 80),
      category: (category as TimeCategory | null | undefined) ?? null,
      duration_minutes,
      start_time: typeof start_time === 'string' ? start_time : null,
      end_time: typeof end_time === 'string' ? end_time : null,
      description: typeof description === 'string' ? description.slice(0, 200) : null,
    })
  }
  return out
}

function cleanPlans(list: unknown): PlanRow[] {
  if (!Array.isArray(list)) return []
  const out: PlanRow[] = []
  for (const raw of list.slice(0, 40)) {
    if (!isObject(raw)) continue
    const { id, title, completed, committed_start, committed_end } = raw
    if (typeof title !== 'string' || typeof completed !== 'boolean') continue
    if (committed_start !== null && typeof committed_start !== 'string') continue
    if (committed_end !== null && typeof committed_end !== 'string') continue
    out.push({
      id: typeof id === 'string' ? id : `plan-${out.length}`,
      title: title.slice(0, 80),
      completed,
      committed_start,
      committed_end,
    })
  }
  return out
}

export async function POST(request: NextRequest) {
  try {
    // Authentication check — prevent unauthorized OpenAI credit burn
    const session = await getAppSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit by user ID (authenticated) with IP fallback
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const rateLimitKey = `period-commentary:${session.user.id || ip}`
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.ai)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }

    const body: unknown = await request.json()
    const input = isObject(body) ? body : {}
    const { period, date } = input

    if (typeof period !== 'string' || !PERIODS.includes(period)) {
      return NextResponse.json({ error: 'Period and entries are required' }, { status: 400 })
    }
    if (typeof date !== 'string' || !DATE.test(date)) {
      return NextResponse.json({ error: 'A date is required' }, { status: 400 })
    }
    if (!Array.isArray(input.entries) || input.entries.length === 0) {
      return NextResponse.json({ error: 'Period and entries are required' }, { status: 400 })
    }

    const sessionEntries = cleanEntries(input.entries, 60)
    if (sessionEntries.length === 0) {
      return NextResponse.json({ error: 'Period and entries are required' }, { status: 400 })
    }

    const facts = buildSessionFacts({
      period: period as TimePeriod,
      sessionEntries,
      dayEntries: cleanEntries(input.dayEntries, 120),
      plans: cleanPlans(input.plans),
      windows: windowsForWake(minuteOrNull(input.wakeMinutes)),
      nowMinutes: minuteOrNull(input.nowMinutes),
    })

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000,
    })

    // One model call. There were once three, then two more that only
    // restated the card; the comment is the part with something to say.
    const completion = await openai.chat.completions.create({
      ...SESSION_COMMENT_PARAMS,
      messages: [
        { role: 'system', content: buildSessionCommentarySystemPrompt(facts.ahead.kind) },
        { role: 'user', content: describeSessionFacts(facts) },
      ],
    })
    const commentary = completion.choices[0]?.message?.content?.trim() || ''

    return NextResponse.json({ commentary })
  } catch (error) {
    console.error('Period commentary generation error:', error)

    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        return NextResponse.json({ error: 'AI service is busy. Please try again.' }, { status: 503 })
      }
    }

    return NextResponse.json({ error: 'Failed to generate commentary' }, { status: 500 })
  }
}
