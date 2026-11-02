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
