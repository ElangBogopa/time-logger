import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import {
  TimeEntry,
  TimeCategory,
  CATEGORY_LABELS,
} from '@/lib/types'
import { getTimeOfDay, formatDurationLong } from '@/lib/time-utils'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'

interface CommentaryRequest {
  entry: TimeEntry
  dayEntries: TimeEntry[]
}

function getCategoryTone(category: TimeCategory | null): 'positive' | 'neutral' | 'distraction' {
  if (!category) return 'neutral' // Default for uncategorized entries
  const positive: TimeCategory[] = ['deep_work', 'learning', 'exercise', 'social', 'calls', 'meals', 'self_care', 'creating', 'movement']
  const neutral: TimeCategory[] = ['meetings', 'admin', 'rest', 'other', 'shallow_work', 'errands', 'chores', 'commute', 'sleep']

  if (positive.includes(category)) return 'positive'
  if (neutral.includes(category)) return 'neutral'
  return 'distraction' // entertainment falls here
}

function getDurationCategory(minutes: number): 'short' | 'medium' | 'long' {
  if (minutes < 30) return 'short'
  if (minutes <= 120) return 'medium'
  return 'long'
}

function detectMixedActivity(activity: string): boolean {
  const mixedIndicators = [' + ', ' while ', ' and ', ' with ', ' during ', ' but ']
  const lowerActivity = activity.toLowerCase()
  return mixedIndicators.some(indicator => lowerActivity.includes(indicator))
}

function buildContext(
  entry: TimeEntry,
  dayEntries: TimeEntry[],
): string {
  const timeOfDay = getTimeOfDay(entry.start_time)
  const duration = formatDurationLong(entry.duration_minutes)
  const durationCategory = getDurationCategory(entry.duration_minutes)
  const isMixedActivity = detectMixedActivity(entry.activity)

  // Count entries by category for the day (only count entries with categories)
  const categoryCounts: Partial<Record<TimeCategory, { count: number; totalMinutes: number }>> = {}
  dayEntries.forEach((e) => {
    if (!e.category) return // Skip entries without a category (pending)
    if (!categoryCounts[e.category]) {
      categoryCounts[e.category] = { count: 0, totalMinutes: 0 }
    }
    categoryCounts[e.category]!.count++
    categoryCounts[e.category]!.totalMinutes += e.duration_minutes
  })

  // Find position of this entry in same-category entries
  const sameCategoryEntries = entry.category
    ? dayEntries.filter((e) => e.category === entry.category)
    : []
  const entryIndex = sameCategoryEntries.findIndex((e) => e.id === entry.id)
  const positionInCategory = entryIndex + 1

  // Calculate total time logged today
  const totalMinutesToday = dayEntries.reduce((sum, e) => sum + e.duration_minutes, 0)

  // Build context string
  const categoryLabel = entry.category ? CATEGORY_LABELS[entry.category] : 'Uncategorized'
  let context = `Activity: "${entry.activity}"
Category: ${categoryLabel}
Duration: ${duration} (${entry.duration_minutes} minutes)
Duration category: ${durationCategory} (short = under 30 min, medium = 30 min to 2 hours, long = over 2 hours)
Time of day: ${timeOfDay}
Mixed activity: ${isMixedActivity ? 'YES - this activity combines productive work with distractions' : 'no'}
`

  if (entry.description) {
    context += `User's notes: "${entry.description}"
`
  }

  context += `
Day context:
- Total time logged today: ${formatDurationLong(totalMinutesToday)}
${entry.category ? `- This is ${categoryLabel} session #${positionInCategory} of ${sameCategoryEntries.length} today` : '- This is a new entry'}
`

  // Add category breakdown for context
  const categoryBreakdown = Object.entries(categoryCounts)
    .map(([cat, data]) => `${CATEGORY_LABELS[cat as TimeCategory]}: ${data!.count} entries (${formatDurationLong(data!.totalMinutes)})`)
    .join(', ')
  context += `- Today's breakdown: ${categoryBreakdown}
`

  return context
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP address (fallback to 'unknown')
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const rateLimitKey = `commentary:${ip}`
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

    const tone = getCategoryTone(entry.category)
    const context = buildContext(entry, dayEntries || [])
    const durationCategory = getDurationCategory(entry.duration_minutes)
    const isMixedActivity = detectMixedActivity(entry.activity)

    let toneInstructions = ''
    const categoryForTone = entry.category || 'other'

    if (tone === 'positive') {
      toneInstructions = `This is a POSITIVE activity (${categoryForTone}). Your tone should:
- Celebrate the win genuinely—sound like a friend, not a coach
- Note streaks or patterns: "Your second deep work session today—you're locked in"
- Can be cheeky if appropriate: "Two hours of coding without checking Twitter? That's growth."
- Acknowledge specific effort if they included notes
- Be warm but keep it real—no cheesy motivational quotes
- For meals and self_care: validate taking care of yourself matters`
    } else if (tone === 'neutral') {
      toneInstructions = `This is a NEUTRAL activity (${categoryForTone}). Your tone should:
- Be supportive but real, like a friend checking in
- Acknowledge the necessity without being dismissive
- Can be direct about overload: "You've had 3 hours of meetings today. Protect some focus time."
- For rest: validate that rest is productive, not laziness
- Reference patterns when relevant`
    } else {
      toneInstructions = `This is logged as DISTRACTION. Your tone should:
- Be honest but never mean—sound like a friend who calls you out
- Can be cheeky: "Third scroll session today. What are you avoiding?"
- Notice patterns bluntly: "You always lose your evenings to TikTok after 8pm"
- Acknowledge logging it shows self-awareness
- Don't sugarcoat but don't pile on guilt
- NEVER say "we've all been there" or be condescending`
    }

    // Add duration-aware instructions
    let durationInstructions = ''
    if (durationCategory === 'short') {
      durationInstructions = `
DURATION CONTEXT - SHORT (under 30 min):
- For productive activities: Acknowledge quick wins positively ("A focused 15-minute burst—sometimes that's all you need")
- For meals: No special comment needed, normal duration
- For distraction: Keep it light, short distractions aren't a big deal`
    } else if (durationCategory === 'long') {
      durationInstructions = `
DURATION CONTEXT - LONG (over 2 hours):
- For deep_work: Extra praise for sustained focus ("${entry.duration_minutes} minutes of deep work is serious focus time")
- For exercise: Acknowledge the commitment ("That was a solid workout session")
- For meetings: Note the length with gentle concern ("Long meeting—hopefully it was productive")
- For distraction: Be more pointed ("${entry.duration_minutes} minutes of scrolling—what were you putting off?")
- For meals: Show curiosity ("Long meal—was it social or just a slow lunch?")
- For learning: Celebrate the dedication`
    }

    // Add mixed activity instructions
    let mixedActivityInstructions = ''
    if (isMixedActivity) {
      mixedActivityInstructions = `
MIXED ACTIVITY DETECTED:
The activity text suggests they were doing productive work while also getting distracted. This is GOOD to acknowledge positively:
- Give them credit for getting the work done despite distractions
- Examples: "Got the coding done despite the TikTok tab—that counts" or "Studying with distractions is still studying"
- Don't lecture about the distraction; focus on what they accomplished
- The fact they logged it honestly shows self-awareness`
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Generate a VERY SHORT comment about this time entry. MAX 1 sentence, under 15 words.

PERSONALITY:
- Sound like a friend who knows them—casual, real, sometimes cheeky
- Can call them out: "Third TikTok session today. Come on."
- Celebrate genuinely: "That's your best focus block this week."
- Reference specific activities by name when relevant
- Be blunt but never mean

Examples of good commentary:
- "Solid focus session."
- "That's 3 workouts this week."
- "Another scroll session before bed?"
- "Nice deep work block."
- "You logged 'research' but we both know that was YouTube."
- "2 hours of learning—building momentum."

${toneInstructions}

STRICT RULES:
- ONE short sentence only (under 15 words)
- NO emojis
- Be specific but brief
- Sound natural, like texting a friend
- Reference patterns (streaks, totals) when relevant`,
        },
        {
          role: 'user',
          content: context,
        },
      ],
      temperature: 0.7,
      max_tokens: 40,
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
