import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { CATEGORIES, TimeCategory } from '@/lib/types'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP address (fallback to 'unknown')
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const rateLimitKey = `categorize:${ip}`
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
    })

    if (!activity || typeof activity !== 'string') {
      return NextResponse.json({ error: 'Activity is required' }, { status: 400 })
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a time tracking assistant. Categorize the given activity into exactly one of these categories: ${CATEGORIES.join(', ')}.

Category definitions:
- deep_work: Focused, cognitively demanding work like coding, writing, analysis, design, creative projects, programming, vibe coding
- meetings: Scheduled calls, video conferences, in-person meetings, 1:1s
- admin: Administrative tasks like email, scheduling, paperwork, organizing, errands, chores
- learning: Educational activities including university lectures, classes, labs, tutorials, seminars, courses, studying, research, reading educational content, skill development. University course codes (e.g., "STA414H1 LEC5101", "CSC108 TUT0101", "MAT137 LAB01") are ALWAYS learning.
- exercise: Physical workouts, gym, running, sports, yoga, cycling
- rest: Intentional relaxation like naps, meditation, walks, watching movies/TV to unwind, reading for pleasure, relaxing
- meals: Eating activities like breakfast, lunch, dinner, snacks, brunch, eating food, cooking meals, grabbing coffee/food
- self_care: Personal maintenance and grooming like showering, skincare, hygiene, getting ready, brushing teeth, haircut, shaving, makeup, morning/night routine
- relationships: Quality time with family, friends, dates, calls with loved ones, social activities
- distraction: ONLY use when the activity is purely unproductive with NO productive element - scrolling TikTok, Instagram, Twitter/X, Reddit, YouTube rabbit holes, porn, aimless browsing, doomscrolling
- other: Anything that doesn't fit the above categories

IMPORTANT RULES:
1. MIXED ACTIVITIES - FAVOR PRODUCTIVE: When an activity combines productive work with distractions, ALWAYS categorize by the PRODUCTIVE part:
   - "Vibe coding + tiktok" → deep_work (coding is the primary productive activity)
   - "Studying while checking Instagram" → learning (studying is productive)
   - "Working on project + youtube in background" → deep_work (work is productive)
   - "Reading docs with twitter breaks" → learning (reading docs is productive)
   - "Coding with music/youtube" → deep_work (coding is the main activity)
   The logic: if someone is doing productive work while occasionally getting distracted, they're still primarily doing that productive work. The distraction is secondary.

2. ONLY categorize as "distraction" when the activity is PURELY unproductive with no productive element mentioned:
   - "Just scrolling tiktok" → distraction
   - "Doomscrolling twitter" → distraction
   - "Watching random youtube videos" → distraction

3. If the activity includes words like "break", "intentional", "to unwind", "relaxing", or "to decompress" with typically distracting activities, categorize as "rest" instead of "distraction".

4. Other category mappings:
   - Naps, meditation, walks, movies, TV shows, and reading for fun are "rest" (intentional recovery)
   - Hanging out with friends, family time, dates, and social calls are "relationships"
   - Eating, breakfast, lunch, dinner, snacks, food, and cooking should be "meals"
   - Showering, grooming, skincare, hygiene, getting ready, brushing teeth, and personal care routines should be "self_care"

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

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Categorization error:', error)
    return NextResponse.json({ error: 'Failed to categorize activity' }, { status: 500 })
  }
}
