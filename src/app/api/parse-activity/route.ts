import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'
import { CATEGORIES, TimeCategory, CATEGORY_DEFINITIONS } from '@/lib/types'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'

interface ParsedActivity {
  activity: string
  duration_minutes: number
  start_time: string
  end_time: string
  category: TimeCategory
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
    const rateLimitKey = `parse:${session.user.id || ip}`
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.ai)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }

    const { text, currentTime, date } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000,
    })

    // Build category definitions for the prompt
    const categoryDefs = CATEGORIES.map(cat => {
      const def = CATEGORY_DEFINITIONS[cat]
      return `- ${cat}: ${def.definition} Examples: ${def.includes.slice(0, 3).join(', ')}`
    }).join('\n')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a time tracking assistant that parses natural language into structured time entries.

Current time: ${currentTime || 'unknown'}
Current date: ${date || 'today'}

Parse the user's input and extract:
1. activity - Clean, concise description (capitalize first letter, remove time/duration info)
2. duration_minutes - Duration in minutes
3. start_time - In HH:MM 24-hour format
4. end_time - In HH:MM 24-hour format
5. category - One of: ${CATEGORIES.join(', ')}

Category definitions:
${categoryDefs}

PARSING RULES:
- If duration given (e.g., "2 hours", "30 min"), calculate end_time from current time or specified start
- If time range given (e.g., "9-11am", "14:00-16:00"), use those times and calculate duration
- If only end time given, assume start is current time
- If no times given, use current time as end and calculate start from duration
- Round times to nearest 5 minutes
- Default duration is 60 minutes if nothing specified
- For "from X to Y" patterns, X is start and Y is end

Examples:
- "coded for 2 hours" → activity: "Coding", duration: 120, end: current time, start: 2 hours before current
- "lunch 12-1pm" → activity: "Lunch", duration: 60, start: 12:00, end: 13:00
- "meeting with team 9:30-10:15" → activity: "Meeting with team", duration: 45, start: 09:30, end: 10:15
- "gym" → activity: "Gym workout", duration: 60, category: exercise
- "30 min meditation" → activity: "Meditation", duration: 30, category: self_care

Respond ONLY with valid JSON in this exact format:
{"activity": "...", "duration_minutes": N, "start_time": "HH:MM", "end_time": "HH:MM", "category": "..."}`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0,
      max_tokens: 150,
    })

    const responseText = completion.choices[0]?.message?.content?.trim() || ''

    // Parse JSON response
    let parsed: ParsedActivity
    try {
      // Handle potential markdown code blocks
      const jsonStr = responseText.replace(/```json\n?|\n?```/g, '').trim()
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error('Failed to parse AI response:', responseText)
      return NextResponse.json({ error: 'Failed to parse activity' }, { status: 500 })
    }

    // Validate category
    if (!CATEGORIES.includes(parsed.category)) {
      parsed.category = 'other'
    }

    // Validate times format (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(parsed.start_time) || !timeRegex.test(parsed.end_time)) {
      return NextResponse.json({ error: 'Invalid time format from AI' }, { status: 500 })
    }

    // Ensure duration is positive
    if (parsed.duration_minutes <= 0) {
      parsed.duration_minutes = 60
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Parse activity error:', error)

    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        return NextResponse.json({ error: 'AI service is busy. Please try again.' }, { status: 503 })
      }
    }

    if (error instanceof Error && error.message.includes('timeout')) {
      return NextResponse.json({ error: 'Request timed out. Please try again.' }, { status: 504 })
    }

    return NextResponse.json({ error: 'Failed to parse activity' }, { status: 500 })
  }
}
