import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface DayData {
  score: number
  totalMinutesLogged: number
  wins: { text: string }[]
  intentionProgress: {
    label: string
    todayMinutes: number
    dailyTarget: number
    progress: number
    direction: 'maximize' | 'minimize'
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

  try {
    const dayData: DayData = await request.json()

    // Build context for AI
    const winsText = dayData.wins.length > 0
      ? `Wins today: ${dayData.wins.map(w => w.text).join(', ')}.`
      : 'No specific wins detected.'

    const intentionsText = dayData.intentionProgress.length > 0
      ? dayData.intentionProgress.map(i => {
          const status = i.progress >= 100 ? 'met' : i.progress >= 50 ? 'partially met' : 'not met'
          const directionWord = i.direction === 'maximize' ? 'toward' : 'staying under'
          return `${i.label}: ${i.todayMinutes} min ${directionWord} ${i.dailyTarget} min target (${status}, ${i.trend} vs yesterday)`
        }).join('. ')
      : 'No intentions set.'

    const moodText = dayData.mood
      ? `Evening mood: ${dayData.mood}.`
      : ''

    const focusText = dayData.longestFocusSession
      ? `Longest focus session: ${dayData.longestFocusSession.minutes} minutes on "${dayData.longestFocusSession.activity}".`
      : ''

    const prompt = `You are a warm, encouraging life coach reviewing someone's day. Based on their time tracking data, write a brief, personalized 2-3 sentence commentary. Be specific about what they did well. If it was a tough day, acknowledge that with compassion. Never be preachy or guilt-inducing.

Day Score: ${dayData.score}/100
Total Time Tracked: ${dayData.totalMinutesLogged} minutes
${winsText}
${intentionsText}
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
