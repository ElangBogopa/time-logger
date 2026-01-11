import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { TimeEntry, TimeCategory, CATEGORY_LABELS } from '@/lib/types'

interface CommentaryRequest {
  entry: TimeEntry
  dayEntries: TimeEntry[]
}

function getTimeOfDay(time: string | null): string {
  if (!time) return 'sometime today'
  const hour = parseInt(time.split(':')[0], 10)
  if (hour < 6) return 'early morning'
  if (hour < 9) return 'morning'
  if (hour < 12) return 'late morning'
  if (hour < 14) return 'around midday'
  if (hour < 17) return 'afternoon'
  if (hour < 20) return 'evening'
  return 'night'
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`
}

function getCategoryTone(category: TimeCategory): 'positive' | 'neutral' | 'distraction' {
  const positive: TimeCategory[] = ['deep_work', 'learning', 'exercise', 'relationships']
  const neutral: TimeCategory[] = ['meetings', 'admin', 'rest', 'other']

  if (positive.includes(category)) return 'positive'
  if (neutral.includes(category)) return 'neutral'
  return 'distraction'
}

function buildContext(entry: TimeEntry, dayEntries: TimeEntry[]): string {
  const tone = getCategoryTone(entry.category)
  const timeOfDay = getTimeOfDay(entry.start_time)
  const duration = formatDuration(entry.duration_minutes)

  // Count entries by category for the day
  const categoryCounts: Partial<Record<TimeCategory, { count: number; totalMinutes: number }>> = {}
  dayEntries.forEach((e) => {
    if (!categoryCounts[e.category]) {
      categoryCounts[e.category] = { count: 0, totalMinutes: 0 }
    }
    categoryCounts[e.category]!.count++
    categoryCounts[e.category]!.totalMinutes += e.duration_minutes
  })

  // Find position of this entry in same-category entries
  const sameCategoryEntries = dayEntries.filter((e) => e.category === entry.category)
  const entryIndex = sameCategoryEntries.findIndex((e) => e.id === entry.id)
  const positionInCategory = entryIndex + 1

  // Calculate total time logged today
  const totalMinutesToday = dayEntries.reduce((sum, e) => sum + e.duration_minutes, 0)

  // Build context string
  let context = `Activity: "${entry.activity}"
Category: ${CATEGORY_LABELS[entry.category]}
Duration: ${duration}
Time of day: ${timeOfDay}
`

  if (entry.description) {
    context += `User's notes: "${entry.description}"
`
  }

  context += `
Day context:
- Total time logged today: ${formatDuration(totalMinutesToday)}
- This is ${entry.category} session #${positionInCategory} of ${sameCategoryEntries.length} today
`

  // Add category breakdown for context
  const categoryBreakdown = Object.entries(categoryCounts)
    .map(([cat, data]) => `${CATEGORY_LABELS[cat as TimeCategory]}: ${data!.count} entries (${formatDuration(data!.totalMinutes)})`)
    .join(', ')
  context += `- Today's breakdown: ${categoryBreakdown}
`

  return context
}

export async function POST(request: NextRequest) {
  try {
    const { entry, dayEntries }: CommentaryRequest = await request.json()

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    if (!entry) {
      return NextResponse.json({ error: 'Entry is required' }, { status: 400 })
    }

    const tone = getCategoryTone(entry.category)
    const context = buildContext(entry, dayEntries || [])

    let toneInstructions = ''

    if (tone === 'positive') {
      toneInstructions = `This is a POSITIVE activity (${entry.category}). Your tone should:
- Celebrate the win, be genuinely encouraging
- Note streaks or patterns if this isn't their first session ("Your second deep work session today—you're locked in")
- Acknowledge specific effort if they included notes
- Be warm but not over-the-top or cheesy`
    } else if (tone === 'neutral') {
      toneInstructions = `This is a NEUTRAL activity (${entry.category}). Your tone should:
- Be supportive and matter-of-fact
- Acknowledge the necessity without being dismissive
- If they've spent a lot of time here, gently suggest balance ("You've had 3 hours of meetings today—protect some focus time this afternoon")
- For rest: validate that rest is productive, not laziness`
    } else {
      toneInstructions = `This is logged as DISTRACTION. Your tone should:
- Be honest but NOT preachy, judgmental, or disappointed
- Ask a genuine reflective question ("What were you avoiding?" or "Were you recharging or escaping?")
- If there's a pattern (multiple distraction entries), notice it gently ("This is your third distraction entry today, mostly after lunch")
- Acknowledge that logging it honestly is itself progress and takes self-awareness
- Offer a gentle reframe, not a guilt trip
- NEVER say things like "we've all been there" or be condescending`
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a supportive but real friend helping someone reflect on how they spend their time. You're not a motivational poster and not a disappointed parent—just honest and caring.

Generate a 1-2 sentence commentary about this time entry. Be specific to what they logged, not generic.

${toneInstructions}

Important:
- Keep it to 1-2 sentences max
- Reference specific details from their activity or notes when available
- Sound like a real person, not an app notification
- Don't start with "Great job!" or similar clichés
- Don't use emojis`,
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
    console.error('Commentary generation error:', error)
    return NextResponse.json({ error: 'Failed to generate commentary' }, { status: 500 })
  }
}
