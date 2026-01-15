import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import OpenAI from 'openai'
import {
  TimeEntry,
  TimeCategory,
  CATEGORY_LABELS,
  UserIntention,
  INTENTION_LABELS,
  INTENTION_CATEGORY_MAP,
} from '@/lib/types'
import { getTimeOfDay, formatDurationLong } from '@/lib/time-utils'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'

interface CommentaryRequest {
  entry: TimeEntry
  dayEntries: TimeEntry[]
}

function getCategoryTone(category: TimeCategory | null): 'positive' | 'neutral' | 'distraction' {
  if (!category) return 'neutral' // Default for uncategorized entries
  const positive: TimeCategory[] = ['deep_work', 'learning', 'exercise', 'relationships', 'meals', 'self_care']
  const neutral: TimeCategory[] = ['meetings', 'admin', 'rest', 'other']

  if (positive.includes(category)) return 'positive'
  if (neutral.includes(category)) return 'neutral'
  return 'distraction'
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

// Get the start of the week (Monday) for a given date string (YYYY-MM-DD)
function getWeekStart(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const dayOfWeek = date.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // Adjust for Monday start
  date.setDate(date.getDate() + diff)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Simple in-memory cache for weekly category totals (avoids N+1 queries)
// Cache invalidates after 2 minutes or when a new week starts
interface WeeklyCacheEntry {
  totals: Map<TimeCategory, number>
  weekStart: string
  timestamp: number
}
const weeklyTotalsCache = new Map<string, WeeklyCacheEntry>()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes (optimized from 2 min to reduce DB queries)

async function getCachedWeeklyTotals(
  userId: string,
  entryDate: string
): Promise<Map<TimeCategory, number>> {
  const weekStart = getWeekStart(entryDate)
  const cacheKey = `${userId}:${weekStart}`
  const cached = weeklyTotalsCache.get(cacheKey)

  // Return cached if valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.totals
  }

  // Fetch fresh data
  const { data: weekEntries } = await supabase
    .from('time_entries')
    .select('category, duration_minutes')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .gte('date', weekStart)

  const totals = new Map<TimeCategory, number>()
  if (weekEntries) {
    weekEntries.forEach((entry) => {
      if (entry.category) {
        const current = totals.get(entry.category as TimeCategory) || 0
        totals.set(entry.category as TimeCategory, current + entry.duration_minutes)
      }
    })
  }

  // Store in cache
  weeklyTotalsCache.set(cacheKey, {
    totals,
    weekStart,
    timestamp: Date.now(),
  })

  // Clean old entries (different week starts)
  for (const [key, value] of weeklyTotalsCache.entries()) {
    if (value.weekStart !== weekStart) {
      weeklyTotalsCache.delete(key)
    }
  }

  return totals
}

// Calculate weekly progress for intention-related categories
// Uses cached weekly totals to avoid N+1 queries
async function getWeeklyIntentionProgress(
  userId: string,
  intentions: UserIntention[],
  entryDate: string
): Promise<Map<string, { minutes: number; target: number | null; intentionLabel: string }>> {
  const progress = new Map<string, { minutes: number; target: number | null; intentionLabel: string }>()

  if (intentions.length === 0) return progress

  // Use cached weekly totals instead of fetching each time
  const categoryTotals = await getCachedWeeklyTotals(userId, entryDate)

  // Map intentions to their progress
  intentions.forEach((intention) => {
    const relatedCategories = INTENTION_CATEGORY_MAP[intention.intention_type]
    let totalMinutes = 0

    relatedCategories.forEach((cat) => {
      totalMinutes += categoryTotals.get(cat) || 0
    })

    // For "less_distraction", we track distraction time
    if (intention.intention_type === 'less_distraction') {
      totalMinutes = categoryTotals.get('distraction') || 0
    }

    progress.set(intention.intention_type, {
      minutes: totalMinutes,
      target: intention.weekly_target_minutes,
      intentionLabel: intention.intention_type === 'custom'
        ? intention.custom_text || 'Custom goal'
        : INTENTION_LABELS[intention.intention_type],
    })
  })

  return progress
}

// Check if entry category relates to any intention
function getRelatedIntention(
  category: TimeCategory | null,
  intentions: UserIntention[]
): UserIntention | null {
  if (!category) return null

  for (const intention of intentions) {
    const relatedCategories = INTENTION_CATEGORY_MAP[intention.intention_type]

    // Special case: "less_distraction" relates to distraction category
    if (intention.intention_type === 'less_distraction' && category === 'distraction') {
      return intention
    }

    if (relatedCategories.includes(category)) {
      return intention
    }
  }

  return null
}

function buildContext(
  entry: TimeEntry,
  dayEntries: TimeEntry[],
  intentions: UserIntention[],
  weeklyProgress: Map<string, { minutes: number; target: number | null; intentionLabel: string }>
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

  // Add intentions context
  if (intentions.length > 0) {
    context += `
USER'S INTENTIONS (what they want to change):
`
    intentions.forEach((intention, idx) => {
      const progress = weeklyProgress.get(intention.intention_type)
      const label = intention.intention_type === 'custom'
        ? intention.custom_text
        : INTENTION_LABELS[intention.intention_type]

      let progressStr = ''
      if (progress) {
        const hours = Math.round(progress.minutes / 60 * 10) / 10
        if (progress.target) {
          const targetHours = progress.target / 60
          const percentage = Math.round((progress.minutes / progress.target) * 100)
          progressStr = ` — ${hours}h logged this week (${percentage}% of ${targetHours}h target)`
        } else {
          progressStr = ` — ${hours}h logged this week`
        }
      }

      context += `${idx + 1}. ${label}${progressStr}
`
    })

    // Check if this entry relates to an intention
    const relatedIntention = getRelatedIntention(entry.category, intentions)
    if (relatedIntention) {
      const progress = weeklyProgress.get(relatedIntention.intention_type)
      if (progress) {
        const isDistraction = relatedIntention.intention_type === 'less_distraction'
        if (isDistraction) {
          context += `
THIS ENTRY RELATES TO USER'S INTENTION: "${progress.intentionLabel}"
- They want LESS of this (distraction)
- This week so far: ${Math.round(progress.minutes / 60 * 10) / 10}h of distraction
`
        } else {
          context += `
THIS ENTRY RELATES TO USER'S INTENTION: "${progress.intentionLabel}"
- They want MORE of this
- This week so far: ${Math.round(progress.minutes / 60 * 10) / 10}h
${progress.target ? `- Weekly target: ${progress.target / 60}h (${Math.round((progress.minutes / progress.target) * 100)}% complete)` : ''}
`
        }
      }
    }
  }

  return context
}

function buildIntentionInstructions(
  entry: TimeEntry,
  intentions: UserIntention[],
  weeklyProgress: Map<string, { minutes: number; target: number | null; intentionLabel: string }>
): string {
  if (intentions.length === 0) return ''

  const relatedIntention = getRelatedIntention(entry.category, intentions)
  if (!relatedIntention) return ''

  const progress = weeklyProgress.get(relatedIntention.intention_type)
  if (!progress) return ''

  const isDistraction = relatedIntention.intention_type === 'less_distraction'
  const hoursLogged = Math.round(progress.minutes / 60 * 10) / 10
  const targetHours = progress.target ? progress.target / 60 : null
  const percentage = progress.target ? Math.round((progress.minutes / progress.target) * 100) : null

  let instructions = `
INTENTION-AWARE COMMENTARY:
This entry relates to the user's intention: "${progress.intentionLabel}"
`

  if (isDistraction) {
    instructions += `
- The user wants LESS distraction time
- Be supportive, not judgmental
- Acknowledge their self-awareness in logging it
- If they've had multiple distraction entries: gently note the pattern
- Ask a reflective question about what they might be avoiding
- Don't pile on guilt; they're already tracking it which shows intent to change
- You might reference their goal: "You wanted less scrolling time..."
`
  } else {
    // Positive intention (more of something)
    if (targetHours && percentage !== null) {
      if (percentage >= 100) {
        instructions += `
- They've HIT their weekly target (${hoursLogged}h of ${targetHours}h goal)!
- Celebrate this achievement
- Example: "That's ${hoursLogged} hours of deep work this week—you hit your target!"
`
      } else if (percentage >= 75) {
        instructions += `
- They're CLOSE to their weekly target (${percentage}% there)
- Encourage them: "X more hours to hit your ${targetHours}h target"
- Build momentum
`
      } else if (percentage >= 50) {
        instructions += `
- They're HALFWAY to their weekly target
- Acknowledge progress: "${hoursLogged}h down, ${Math.round((targetHours - hoursLogged) * 10) / 10}h to go"
`
      } else {
        instructions += `
- They're building toward their target (${percentage}% so far)
- Encourage without pressure
- Every session counts toward the goal
`
      }
    } else {
      instructions += `
- Acknowledge this supports their intention
- Note the progress without specific targets: "Another ${entry.duration_minutes} minutes toward your ${progress.intentionLabel.toLowerCase()} goal"
`
    }
  }

  instructions += `
IMPORTANT: Only reference their intention if it feels natural and meaningful. Don't force it into every comment.
`

  return instructions
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

    // Get session to fetch user's intentions
    const session = await getServerSession(authOptions)
    let intentions: UserIntention[] = []
    let weeklyProgress = new Map<string, { minutes: number; target: number | null; intentionLabel: string }>()

    if (session?.user?.id) {
      // Fetch user's active intentions
      const { data: userIntentions } = await supabase
        .from('user_intentions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('active', true)
        .order('priority', { ascending: true })

      if (userIntentions) {
        intentions = userIntentions as UserIntention[]
        weeklyProgress = await getWeeklyIntentionProgress(session.user.id, intentions, entry.date)
      }
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000, // 30 second timeout
    })

    const tone = getCategoryTone(entry.category)
    const context = buildContext(entry, dayEntries || [], intentions, weeklyProgress)
    const durationCategory = getDurationCategory(entry.duration_minutes)
    const isMixedActivity = detectMixedActivity(entry.activity)
    const intentionInstructions = buildIntentionInstructions(entry, intentions, weeklyProgress)

    let toneInstructions = ''
    const categoryForTone = entry.category || 'other'

    if (tone === 'positive') {
      toneInstructions = `This is a POSITIVE activity (${categoryForTone}). Your tone should:
- Celebrate the win, be genuinely encouraging
- Note streaks or patterns if this isn't their first session ("Your second deep work session today—you're locked in")
- Acknowledge specific effort if they included notes
- Be warm but not over-the-top or cheesy
- For meals and self_care: acknowledge that taking care of yourself is a win worth celebrating`
    } else if (tone === 'neutral') {
      toneInstructions = `This is a NEUTRAL activity (${categoryForTone}). Your tone should:
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

Examples of good commentary:
- "Solid focus session."
- "That's 3 workouts this week."
- "Long meeting day."
- "Nice deep work block."
- "Third distraction entry today."
- "2 hours of learning—building momentum."

${toneInstructions}
${intentionInstructions}

STRICT RULES:
- ONE short sentence only (under 15 words)
- NO questions
- NO lengthy reflections or advice
- NO emojis
- Be specific but brief
- Sound natural, not robotic
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
