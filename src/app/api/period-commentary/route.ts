import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'
import {
  TimeEntry,
  TimeCategory,
  CATEGORY_LABELS,
  TimePeriod,
  PERIOD_LABELS,
} from '@/lib/types'
import { formatDurationLong } from '@/lib/time-utils'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'

interface PeriodCommentaryRequest {
  period: TimePeriod
  entries: TimeEntry[]
  date: string
}

function buildPeriodContext(
  period: TimePeriod,
  entries: TimeEntry[],
): string {
  const periodLabel = PERIOD_LABELS[period]
  const totalMinutes = entries.reduce((sum, e) => sum + e.duration_minutes, 0)

  // Group by category
  const categoryBreakdown: Record<string, { count: number; minutes: number; activities: string[] }> = {}
  entries.forEach(entry => {
    const cat = entry.category || 'other'
    if (!categoryBreakdown[cat]) {
      categoryBreakdown[cat] = { count: 0, minutes: 0, activities: [] }
    }
    categoryBreakdown[cat].count++
    categoryBreakdown[cat].minutes += entry.duration_minutes
    categoryBreakdown[cat].activities.push(entry.activity)
  })

  // Sort by time spent
  const sortedCategories = Object.entries(categoryBreakdown)
    .sort(([, a], [, b]) => b.minutes - a.minutes)

  let context = `Time period: ${periodLabel}
Total activities logged: ${entries.length}
Total time: ${formatDurationLong(totalMinutes)}

BREAKDOWN BY CATEGORY:
`

  sortedCategories.forEach(([cat, data]) => {
    context += `- ${CATEGORY_LABELS[cat as TimeCategory]}: ${formatDurationLong(data.minutes)} (${data.count} ${data.count === 1 ? 'entry' : 'entries'})
  Activities: ${data.activities.join(', ')}
`
  })

  // Notable patterns
  const deepWorkMinutes = categoryBreakdown['deep_work']?.minutes || 0
  const entertainmentMinutes = categoryBreakdown['entertainment']?.minutes || 0
  const meetingMinutes = categoryBreakdown['meetings']?.minutes || 0

  context += `
NOTABLE PATTERNS:
`
  if (deepWorkMinutes >= 120) {
    context += `- Strong focus: ${formatDurationLong(deepWorkMinutes)} of deep work
`
  }
  if (entertainmentMinutes >= 60) {
    context += `- High entertainment: ${formatDurationLong(entertainmentMinutes)} logged as entertainment/leisure
`
  }
  if (meetingMinutes >= 120) {
    context += `- Meeting-heavy: ${formatDurationLong(meetingMinutes)} in meetings
`
  }
  if (entries.length >= 5) {
    context += `- Busy period: ${entries.length} different activities logged
`
  }

  return context
}

export async function POST(request: NextRequest) {
  try {
    // Authentication check — prevent unauthorized OpenAI credit burn
    const session = await getServerSession(authOptions)
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

    const { period, entries, date }: PeriodCommentaryRequest = await request.json()

    if (!period || !entries || entries.length === 0) {
      return NextResponse.json({ error: 'Period and entries are required' }, { status: 400 })
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000,
    })

    const context = buildPeriodContext(period, entries)
    const periodLabel = PERIOD_LABELS[period]

    // Determine overall tone
    const totalMinutes = entries.reduce((sum, e) => sum + e.duration_minutes, 0)
    const entertainmentMinutes = entries
      .filter(e => e.category === 'entertainment')
      .reduce((sum, e) => sum + e.duration_minutes, 0)
    // shallow_work belongs here: answering email and filing expenses is still
    // work, and leaving it out made the model call a full working day
    // unproductive and then suggest the person try harder.
    const productiveMinutes = entries
      .filter(e => ['deep_work', 'shallow_work', 'learning', 'exercise', 'creating'].includes(e.category || ''))
      .reduce((sum, e) => sum + e.duration_minutes, 0)

    let toneGuidance = ''
    if (productiveMinutes > entertainmentMinutes && productiveMinutes >= totalMinutes * 0.5) {
      toneGuidance = 'The period was productive overall. Be encouraging and acknowledge their focus.'
    } else if (entertainmentMinutes > productiveMinutes && entertainmentMinutes >= totalMinutes * 0.3) {
      toneGuidance = 'There was notable leisure time. Be honest but supportive, acknowledge what they did accomplish.'
    } else {
      toneGuidance = 'Mixed period. Highlight the positives while being realistic about the balance.'
    }

    // All three take the same context and differ only in their system prompt,
    // so they ran back to back for no reason — three round trips of latency
    // while the summary popup spins. They are started together below.
    const commentaryPromise = openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Generate a brief, insightful summary of this person's ${periodLabel.toLowerCase()}. 2-3 sentences max.

PERSONALITY:
- Sound like a supportive but real friend who knows them well
- Use casual language naturally (not forced slang)
- Can be cheeky about distractions: "Another scroll session? We both know that assignment exists."
- Celebrate genuinely: "You crushed it. That's your best morning this week."
- Reference specific activities by name from the entries
- Occasionally drop a one-liner that feels personal
- NO emojis (keep this rule)
- Can be blunt when needed but never mean
- Don't start with generic praise like "Great" unless it truly fits

${toneGuidance}

EXAMPLES OF GOOD PERIOD SUMMARIES:
- "Solid morning—2 hours of deep work before the meetings kicked in. That STA414 study session is paying off."
- "Meeting-heavy afternoon, but you protected an hour for coding at the end. Smart move."
- "Mixed evening—the gym session was clutch, though that 45-minute scroll sesh crept in after."
- "You logged 3 hours of TikTok but called it 'research.' Come on."
- "Back-to-back meetings all afternoon. You survived, but your brain needs a break."`,
        },
        {
          role: 'user',
          content: context,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
    })

    /**
     * There were two more calls here, for an "insight" one-liner and a
     * "prediction" one-liner, shown under the commentary in the session
     * popup. In practice they restated what was already on the screen —
     * "You spent 37.5% of your evening on social activities", over a card
     * already listing Social 1h30m — or said nothing at all: "If you
     * maintain this evening routine, you could easily finish the week
     * strong."
     *
     * They cost two of this route's three model calls, three times a day,
     * for text nobody needed. The commentary is the part with something to
     * say.
     */

    const completion = await commentaryPromise
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
