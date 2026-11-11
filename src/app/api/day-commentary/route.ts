import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface DayData {
  /** Body / Mind / Heart, each 0–99. */
  metrics?: { body: number; focus: number; social: number } | null
  /** Planned blocks with a time: how many were kept, moved or missed. */
  plan?: { kept: number; moved: number; missed: number } | null
  totalMinutesLogged: number
  // Optional: /api/day-summary stopped returning targetProgress when the
  // weekly targets system was removed, so the client omits it entirely.
  wins?: { text: string }[]
  targetProgress?: {
    label: string
    todayMinutes: number
    dailyTarget: number
    progress: number
    direction: 'at_least' | 'at_most'
    trend: 'up' | 'down' | 'same'
  }[]
  mood?: 'low' | 'okay' | 'great' | null
  longestFocusSession?: { activity: string; minutes: number } | null
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit by user ID (authenticated) with IP fallback
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const rateLimitKey = `day-commentary:${session.user.id || ip}`
  const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.ai)

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    )
  }

  try {
    const dayData: DayData = await request.json()

    // Build context for AI
    const wins = dayData.wins ?? []
    const targetProgress = dayData.targetProgress ?? []

    const winsText = wins.length > 0
      ? `Wins today: ${wins.map(w => w.text).join(', ')}.`
      : 'No specific wins detected.'

    const targetsText = targetProgress.length > 0
      ? targetProgress.map(t => {
          const status = t.progress >= 100 ? 'met' : t.progress >= 50 ? 'partially met' : 'not met'
          const directionWord = t.direction === 'at_least' ? 'toward' : 'staying under'
          return `${t.label}: ${t.todayMinutes} min ${directionWord} ${t.dailyTarget} min target (${status}, ${t.trend} vs yesterday)`
        }).join('. ')
      : 'No targets set.'

    const moodText = dayData.mood
      ? `Evening mood: ${dayData.mood}.`
      : ''

    const focusText = dayData.longestFocusSession
      ? `Longest focus session: ${dayData.longestFocusSession.minutes} minutes on "${dayData.longestFocusSession.activity}".`
      : ''

    const metrics = dayData.metrics
    const scoresText = metrics
      ? `Body: ${metrics.body}/100\nMind: ${metrics.focus}/100\nHeart: ${metrics.social}/100`
      : 'Scores unavailable.'

    const plan = dayData.plan
    const planned = plan ? plan.kept + plan.moved + plan.missed : 0
    const planText = plan && planned > 0
      ? `Plan: ${planned} timed ${planned === 1 ? 'block' : 'blocks'} — ${plan.kept} kept, ${plan.moved} done at another time, ${plan.missed} not done.`
      : ''

    const hours = Math.floor(dayData.totalMinutesLogged / 60)
    const minutes = dayData.totalMinutesLogged % 60

    // What the model is told is what the person can see. It used to get a
    // "Day Score" that was sessions wrapped up ÷ sessions passed — not shown
    // anywhere — plus "if it was a tough day, acknowledge that", and so it
    // consoled people for days that had gone well.
    const prompt = `You are reviewing someone's day from their time log. Write 2-3 sentences: warm, specific, a little dry. Name what actually happened. Never be preachy or guilt-inducing, and never describe the day as hard, tough or challenging unless their mood says so.

The day is scored on three things, each out of 100. 80 means the target for that area was met, 70 or more is a strong day for it, and 100 is not reachable. A low number is often a choice rather than a failure.
Use the scores to judge the day, but do not recite them: they are on screen above your words.
This may be read on the day itself or days later, so never write "today", "yesterday" or "tomorrow": say "the day". You know nothing about any other day, so make no comparisons such as "lower than usual". Do not suggest improving a score and give no advice about tomorrow. You may note, lightly and once, an area that got no time at all.
${scoresText}
Time tracked: ${hours}h ${minutes}m (this only says how much was written down — do not praise or criticise it)
${planText}
${winsText}
${targetsText}
${moodText}
${focusText}

Write your commentary now (2-3 sentences, warm and specific):`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.7,
    })

    const commentary = completion.choices[0]?.message?.content?.trim() || ''

    return NextResponse.json({ commentary })
  } catch (error) {
    console.error('Error generating day commentary:', error)
    return NextResponse.json({ error: 'Failed to generate commentary' }, { status: 500 })
  }
}
