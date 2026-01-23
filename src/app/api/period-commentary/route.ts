import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import OpenAI from 'openai'
import {
  TimeEntry,
  TimeCategory,
  CATEGORY_LABELS,
  TimePeriod,
  PERIOD_LABELS,
  UserIntention,
  INTENTION_LABELS,
  INTENTION_CATEGORY_MAP,
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
  intentions: UserIntention[]
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

  // Add intentions context
  if (intentions.length > 0) {
    context += `
USER'S INTENTIONS:
`
    intentions.forEach((intention, idx) => {
      const label = intention.intention_type === 'custom'
        ? intention.custom_text
        : INTENTION_LABELS[intention.intention_type]

      // Check if this period had any related activities
      const relatedCategories = INTENTION_CATEGORY_MAP[intention.intention_type]
      const relatedMinutes = sortedCategories
        .filter(([cat]) => relatedCategories.includes(cat as TimeCategory))
        .reduce((sum, [, data]) => sum + data.minutes, 0)

      if (relatedMinutes > 0) {
        context += `${idx + 1}. ${label} - ${formatDurationLong(relatedMinutes)} this ${periodLabel.toLowerCase()}
`
      } else {
        context += `${idx + 1}. ${label} - no related activities this ${periodLabel.toLowerCase()}
`
      }
    })
  }

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
    // Rate limit by IP address
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const rateLimitKey = `period-commentary:${ip}`
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

    // Get session to fetch user's intentions
    const session = await getServerSession(authOptions)
    let intentions: UserIntention[] = []

    if (session?.user?.id) {
      const { data: userIntentions } = await supabase
        .from('user_intentions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('active', true)
        .order('priority', { ascending: true })

      if (userIntentions) {
        intentions = userIntentions as UserIntention[]
      }
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000,
    })

    const context = buildPeriodContext(period, entries, intentions)
    const periodLabel = PERIOD_LABELS[period]

    // Determine overall tone
    const totalMinutes = entries.reduce((sum, e) => sum + e.duration_minutes, 0)
    const entertainmentMinutes = entries
      .filter(e => e.category === 'entertainment')
      .reduce((sum, e) => sum + e.duration_minutes, 0)
    const productiveMinutes = entries
      .filter(e => ['deep_work', 'learning', 'exercise', 'creating'].includes(e.category || ''))
      .reduce((sum, e) => sum + e.duration_minutes, 0)

    let toneGuidance = ''
    if (productiveMinutes > entertainmentMinutes && productiveMinutes >= totalMinutes * 0.5) {
      toneGuidance = 'The period was productive overall. Be encouraging and acknowledge their focus.'
    } else if (entertainmentMinutes > productiveMinutes && entertainmentMinutes >= totalMinutes * 0.3) {
      toneGuidance = 'There was notable leisure time. Be honest but supportive, acknowledge what they did accomplish.'
    } else {
      toneGuidance = 'Mixed period. Highlight the positives while being realistic about the balance.'
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Generate a brief, insightful summary of this person's ${periodLabel.toLowerCase()}. 2-3 sentences max.

STYLE:
- Sound like a supportive friend who's genuinely interested in how their day is going
- Be specific about what they did (reference actual activities)
- Notice patterns worth mentioning
- If they have intentions, briefly note progress toward them when relevant
- NO emojis
- Don't be preachy or give unsolicited advice
- Don't start with "Great" or generic praise

${toneGuidance}

EXAMPLES OF GOOD PERIOD SUMMARIES:
- "Solid morning—2 hours of deep work before the meetings kicked in. That STA414 study session is paying off."
- "Meeting-heavy afternoon, but you protected an hour for coding at the end. Smart move."
- "Mixed evening—the gym session was clutch, though that 45-minute scroll sesh crept in after."
- "Busy morning with lots of context switching. The workout anchored it nicely."`,
        },
        {
          role: 'user',
          content: context,
        },
      ],
      temperature: 0.7,
      max_tokens: 100,
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
