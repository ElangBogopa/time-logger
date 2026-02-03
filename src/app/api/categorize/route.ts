import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'
import { CATEGORIES, TimeCategory } from '@/lib/types'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'

// In-memory cache for activity → category mappings
// Key: normalized activity text, Value: { category, timestamp }
const categoryCache = new Map<string, { category: TimeCategory; timestamp: number }>()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

// Normalize activity text for cache lookup
function normalizeActivity(activity: string): string {
  return activity.toLowerCase().trim()
}

// Clean expired cache entries periodically
function cleanExpiredCache() {
  const now = Date.now()
  for (const [key, value] of categoryCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      categoryCache.delete(key)
    }
  }
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
    const rateLimitKey = `categorize:${session.user.id || ip}`
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.ai)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }

    const { activity } = await request.json()

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000, // 30 second timeout
    })

    if (!activity || typeof activity !== 'string') {
      return NextResponse.json({ error: 'Activity is required' }, { status: 400 })
    }

    // Check cache first (saves ~820 tokens per hit)
    const normalizedActivity = normalizeActivity(activity)
    const cached = categoryCache.get(normalizedActivity)

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ category: cached.category, cached: true })
    }

    // Clean expired entries occasionally (1% of requests)
    if (Math.random() < 0.01) {
      cleanExpiredCache()
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a time tracking assistant. Categorize the given activity into exactly one of these categories: ${CATEGORIES.join(', ')}.

Category definitions:

PRODUCTIVE (value-creating work):
- deep_work: Focused, cognitively demanding work - coding, writing, analysis, design, creative projects, programming, vibe coding
- shallow_work: Work tasks that are necessary but not cognitively demanding - work email, Slack, status updates, quick code reviews
- meetings: Scheduled WORK calls, video conferences, in-person meetings, 1:1s, standups
- learning: Educational activities - university lectures, classes, labs, tutorials, seminars, courses, studying, research, reading educational content. University course codes (e.g., "STA414H1", "CSC108") are ALWAYS learning.
- creating: Creative hobbies and side projects - art, music, writing for fun, personal projects, crafts

MAINTENANCE (life logistics):
- admin: PERSONAL administrative tasks - personal email, bills, finances, scheduling personal appointments, planning
- errands: Tasks outside home - grocery shopping, doctor appointments, bank visits, picking up packages, car maintenance
- chores: Household tasks - cleaning, laundry, cooking/meal prep, dishes, home repairs, organizing
- commute: Travel to/from obligations - commute to work, travel to appointments

BODY (physical):
- exercise: ANY physical activity - gym, running, sports, yoga, cycling, strength training, HIIT, walking, stretching, standing, light yoga, playing with kids
- meals: Eating (not cooking) - breakfast, lunch, dinner, snacks, coffee breaks
- sleep: Sleep tracking - night sleep, naps

MIND (mental recovery):
- rest: Intentional downtime - relaxing, reading for pleasure, listening to music, sitting in nature
- self_care: Personal maintenance - showering, skincare, hygiene, meditation, journaling, therapy

CONNECTION (social):
- social: In-person time with others - hanging out with friends, family time, dates, parties
- calls: Personal phone/video calls - FaceTime with family, catching up with friends

LEISURE:
- entertainment: Passive/active leisure - TV, movies, video games, social media, YouTube, browsing, podcasts

IMPORTANT RULES:
1. MIXED ACTIVITIES - FAVOR PRODUCTIVE: When an activity combines productive work with distractions, ALWAYS categorize by the PRODUCTIVE part:
   - "Vibe coding + tiktok" → deep_work
   - "Studying while checking Instagram" → learning
   - "Working on project + youtube in background" → deep_work

2. DISTINGUISH WORK vs PERSONAL:
   - Work meetings/calls → meetings
   - Personal calls with friends/family → calls
   - Work email/Slack → shallow_work
   - Personal email/bills → admin

3. COOKING vs EATING:
   - Cooking, meal prep → chores
   - Eating, having lunch → meals

4. REST vs ENTERTAINMENT:
   - Intentional relaxation, reading, unwinding → rest
   - TV, games, scrolling, browsing → entertainment

Respond with ONLY the category name, nothing else.`,
        },
        {
          role: 'user',
          content: activity,
        },
      ],
      temperature: 0,
      max_tokens: 20,
    })

    const categoryResponse = completion.choices[0]?.message?.content?.trim().toLowerCase() as TimeCategory

    // Validate the response is a valid category
    const category = CATEGORIES.includes(categoryResponse) ? categoryResponse : 'other'

    // Cache the result for future requests
    categoryCache.set(normalizedActivity, { category, timestamp: Date.now() })

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Categorization error:', error)

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

    return NextResponse.json({ error: 'Failed to categorize activity' }, { status: 500 })
  }
}
