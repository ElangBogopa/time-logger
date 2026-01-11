import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { CATEGORIES, TimeCategory } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
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
- deep_work: Focused, cognitively demanding work like coding, writing, analysis, design, creative projects
- meetings: Scheduled calls, video conferences, in-person meetings, 1:1s
- admin: Administrative tasks like email, scheduling, paperwork, organizing, errands, chores
- learning: Reading educational content, courses, tutorials, research, studying, skill development
- exercise: Physical workouts, gym, running, sports, yoga, cycling
- rest: Intentional relaxation like naps, meditation, walks, watching movies/TV to unwind, reading for pleasure, relaxing
- relationships: Quality time with family, friends, dates, calls with loved ones, social activities
- distraction: Unintentional time wasters like scrolling TikTok, Instagram, Twitter/X, Reddit, YouTube rabbit holes, porn, aimless browsing, doomscrolling
- other: Anything that doesn't fit the above categories

IMPORTANT RULES:
1. Activities mentioning TikTok, Instagram, Twitter, X, Reddit, YouTube, porn, scrolling, browsing, or social media should default to "distraction" UNLESS the user indicates it was intentional rest.
2. If the activity includes words like "break", "intentional", "to unwind", "relaxing", or "to decompress" with typically distracting activities, categorize as "rest" instead of "distraction".
3. Naps, meditation, walks, movies, TV shows, and reading for fun are "rest" (intentional recovery).
4. Hanging out with friends, family time, dates, and social calls are "relationships".

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
