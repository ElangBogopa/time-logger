import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'
import { CATEGORIES, TimeCategory } from '@/lib/types'
import { buildCategorizeSystemPrompt } from '@/lib/prompts'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'

// In-memory cache for activity → category mappings
// Key: normalized activity text, Value: { category, timestamp }
const categoryCache = new Map<string, { category: TimeCategory; timestamp: number }>()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

// One confirm-all should not be able to ask for a hundred categories.
const MAX_BATCH = 25

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

/**
 * Categorise several activities in one model call.
 *
 * Cached activities never reach the model, and duplicates within a batch are
 * asked about once. The model answers one category per line, in order; a
 * short or malformed answer falls back to 'other' for the lines it missed
 * rather than failing the whole batch, because the caller is part way
 * through confirming a set of entries.
 */
async function categorizeMany(input: unknown[], openai: OpenAI) {
  const activities = input.filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
  if (activities.length === 0 || activities.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `Between 1 and ${MAX_BATCH} activities are required` },
      { status: 400 }
    )
  }

  const now = Date.now()
  const resolved = new Map<string, TimeCategory>()
  const toAsk: string[] = []

  for (const activity of activities) {
    const key = normalizeActivity(activity)
    if (resolved.has(key) || toAsk.includes(key)) continue
    const cached = categoryCache.get(key)
    if (cached && now - cached.timestamp < CACHE_TTL) {
      resolved.set(key, cached.category)
    } else {
      toAsk.push(key)
    }
  }

  if (toAsk.length > 0) {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildCategorizeSystemPrompt() },
        {
          role: 'user',
          content:
            `Categorise each activity below. Reply with exactly ${toAsk.length} ` +
            `lines, one category per line, in the same order, and nothing else.\n\n` +
            toAsk.map((a, i) => `${i + 1}. ${a}`).join('\n'),
        },
      ],
      temperature: 0,
      max_tokens: 10 * toAsk.length + 10,
    })

    const lines = (completion.choices[0]?.message?.content || '')
      .split('\n')
      .map((line) => line.replace(/^\s*\d+[.)]?\s*/, '').trim().toLowerCase())
      .filter((line) => line.length > 0)

    toAsk.forEach((activity, i) => {
      const answer = lines[i] as TimeCategory
      const category = CATEGORIES.includes(answer) ? answer : 'other'
      resolved.set(activity, category)
      categoryCache.set(activity, { category, timestamp: Date.now() })
    })
  }

  return NextResponse.json({
    categories: activities.map((a) => resolved.get(normalizeActivity(a)) ?? 'other'),
  })
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

    const body = await request.json()
    const { activity } = body

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000, // 30 second timeout
    })

    // Batch form: { activities: string[] } → { categories: TimeCategory[] },
    // one model call for the lot. Confirming four calendar events used to be
    // four calls here, one per event, each re-sending the whole prompt.
    if (Array.isArray(body.activities)) {
      return categorizeMany(body.activities, openai)
    }

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
          content: buildCategorizeSystemPrompt(),
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
