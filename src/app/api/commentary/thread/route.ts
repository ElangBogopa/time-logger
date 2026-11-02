import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import OpenAI from 'openai'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'
import {
  TimeEntry,
  TimeCategory,
  TimePeriod,
  CATEGORY_LABELS,
  shiftDateString,
} from '@/lib/types'
import { getEntriesForPeriod } from '@/lib/session-utils'
import { formatDurationLong } from '@/lib/time-utils'

/**
 * Follow-up conversation on AI commentary.
 *
 * GET  — the stored thread. A database read; it must never call the model.
 *        Regenerating on read is what made the day commentary expensive.
 * POST — appends the question, generates one answer, appends that, returns both.
 *
 * Threads cannot be fingerprint-cached the way commentary is, because the
 * input is free-form. Persistence is the only thing keeping this cheap.
 */

const SUBJECT_TYPES = ['entry', 'day', 'session', 'week'] as const
type SubjectType = (typeof SUBJECT_TYPES)[number]

// Cap the thread: without one, context grows every turn and cost grows with it.
const MAX_USER_MESSAGES = 6
// How much of the thread is replayed to the model.
const MAX_CONTEXT_MESSAGES = 6
const MAX_MESSAGE_LENGTH = 2000

const DATE = /^\d{4}-\d{2}-\d{2}$/
const SESSION_KEY = /^\d{4}-\d{2}-\d{2}:(morning|afternoon|evening)$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface ReplyRow {
  seq: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

function isSubjectType(value: string | null): value is SubjectType {
  return value !== null && (SUBJECT_TYPES as readonly string[]).includes(value)
}

/** Subject keys come from the client, so they are shape-checked before use. */
function isValidSubjectKey(type: SubjectType, key: string): boolean {
  if (type === 'entry') return UUID.test(key)
  if (type === 'session') return SESSION_KEY.test(key)
  return DATE.test(key)
}

async function loadThread(userId: string, type: SubjectType, key: string): Promise<ReplyRow[]> {
  const { data, error } = await supabase
    .from('commentary_replies')
    .select('seq, role, content, created_at')
    .eq('user_id', userId)
    .eq('subject_type', type)
    .eq('subject_key', key)
    .order('seq', { ascending: true })

  if (error) throw new Error(error.message)
  return (data as ReplyRow[]) || []
}

function describeEntries(entries: TimeEntry[]): string {
  if (entries.length === 0) return 'No activities logged.'
  return entries
    .map((e) => {
      const label = e.category ? CATEGORY_LABELS[e.category as TimeCategory] : 'Uncategorised'
      const when = e.start_time ? `${e.start_time.slice(0, 5)} ` : ''
      return `- ${when}${e.activity} (${label}, ${formatDurationLong(e.duration_minutes)})`
    })
    .join('\n')
}

/**
 * The data the commentary was about, re-derived server-side. The client sends
 * the commentary text but never the underlying numbers — otherwise a caller
 * could put words in the model's mouth about someone else's day.
 */
async function loadSubjectContext(
  userId: string,
  type: SubjectType,
  key: string
): Promise<string> {
  if (type === 'entry') {
    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('id', key)
      .limit(1)
    const entry = (data as TimeEntry[] | null)?.[0]
    if (!entry) return 'That activity no longer exists.'
    return `A single logged activity:\n${describeEntries([entry])}`
  }

  if (type === 'week') {
    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .gte('date', key)
      .lte('date', shiftDateString(key, 6))
      .order('date', { ascending: true })
    const entries = (data as TimeEntry[] | null) || []
    const total = entries.reduce((sum, e) => sum + e.duration_minutes, 0)
    return `The week starting ${key}: ${entries.length} activities, ${formatDurationLong(total)} logged.\n${describeEntries(entries)}`
  }

  const date = type === 'session' ? key.split(':')[0] : key
  const { data } = await supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .eq('date', date)
    .order('start_time', { ascending: true })

  let entries = (data as TimeEntry[] | null) || []
  if (type === 'session') {
    entries = getEntriesForPeriod(entries, key.split(':')[1] as TimePeriod)
    return `The ${key.split(':')[1]} of ${date}:\n${describeEntries(entries)}`
  }

  const total = entries.reduce((sum, e) => sum + e.duration_minutes, 0)
  return `${date}: ${entries.length} activities, ${formatDurationLong(total)} logged.\n${describeEntries(entries)}`
}

// GET /api/commentary/thread?subject_type=day&subject_key=2026-11-02
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = new URL(request.url).searchParams
    const subjectType = params.get('subject_type')
    const subjectKey = params.get('subject_key') || ''

    if (!isSubjectType(subjectType) || !isValidSubjectKey(subjectType, subjectKey)) {
      return NextResponse.json({ error: 'Invalid subject' }, { status: 400 })
    }

    const messages = await loadThread(session.user.id, subjectType, subjectKey)
    const userMessageCount = messages.filter((m) => m.role === 'user').length

    return NextResponse.json({
      messages,
      userMessageCount,
      atLimit: userMessageCount >= MAX_USER_MESSAGES,
    })
  } catch (error) {
    console.error('Commentary thread fetch error:', error)
    return NextResponse.json({ error: 'Failed to load thread' }, { status: 500 })
  }
}

// POST /api/commentary/thread
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const rateLimitKey = `commentary-thread:${session.user.id || ip}`
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.ai)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }

    const body = await request.json()
    const subjectType: string = body?.subject_type
    const subjectKey: string = body?.subject_key || ''
    const message: string = typeof body?.message === 'string' ? body.message.trim() : ''
    const subjectCommentary: string | null =
      typeof body?.subject_commentary === 'string' ? body.subject_commentary : null

    if (!isSubjectType(subjectType) || !isValidSubjectKey(subjectType, subjectKey)) {
      return NextResponse.json({ error: 'Invalid subject' }, { status: 400 })
    }
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: 'Message is too long' }, { status: 400 })
    }

    const thread = await loadThread(session.user.id, subjectType, subjectKey)
    const asked = thread.filter((m) => m.role === 'user').length
    if (asked >= MAX_USER_MESSAGES) {
      // 409 rather than silently dropping older turns, so the UI can say so.
      return NextResponse.json(
        { error: 'This conversation has reached its limit.', atLimit: true },
        { status: 409 }
      )
    }

    const subjectContext = await loadSubjectContext(session.user.id, subjectType, subjectKey)

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30000 })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are answering a follow-up question about the person's own time tracking.

THEIR DATA:
${subjectContext}

${subjectCommentary ? `WHAT YOU SAID ABOUT IT:\n${subjectCommentary}` : ''}

HOW CATEGORIES WORK — you need this to answer "why was this counted as X":
- The category in parentheses after each activity was assigned automatically by a
  classifier reading the activity text, not chosen by the person.
- So the honest answer to "why wasn't that deep work" is about what the text
  said, not about how hard they were working. Say that plainly.

ASSUME THE WORK WAS WORK:
- Someone who logged a working day was working. Never suggest they were
  slacking, distracted or "not fully engaged" — you have no evidence of that,
  and a short activity name is not evidence.
- Light-sounding categories are not an accusation. Do not tell them a day
  "could use improvement" because of how something was categorised.

RULES:
- Answer the question that was asked. Nothing else.
- No closing advice, no "next time try…", unless they asked what to do.
- Ground every claim in the data above; if it does not say, say you cannot tell.
- Never name a category, activity or number that is not in the data above.
- If they push back on your tone or your facts, re-read the data and correct
  yourself. Do not defend a previous answer.
- Keep the commentary's voice — warm, a bit dry, like a friend who knows them.
  Cheeky is fine. Preachy is not, and condescending never is.
- 1-3 sentences. No emojis, no bullet points, no preamble.`,
        },
        ...thread.slice(-MAX_CONTEXT_MESSAGES).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user' as const, content: message },
      ],
      temperature: 0.7,
      max_tokens: 200,
    })

    const answer = completion.choices[0]?.message?.content?.trim() || ''
    if (!answer) {
      // Nothing worth storing; the question is not recorded either, so the
      // person can simply ask again.
      return NextResponse.json({ error: 'No answer was generated.' }, { status: 502 })
    }

    const nextSeq = thread.length + 1
    const { data: inserted, error: insertError } = await supabase
      .from('commentary_replies')
      .insert([
        {
          user_id: session.user.id,
          subject_type: subjectType,
          subject_key: subjectKey,
          seq: nextSeq,
          role: 'user',
          content: message,
          // snapshot only on the first message of the thread
          subject_commentary: thread.length === 0 ? subjectCommentary : null,
        },
        {
          user_id: session.user.id,
          subject_type: subjectType,
          subject_key: subjectKey,
          seq: nextSeq + 1,
          role: 'assistant',
          content: answer,
        },
      ])
      .select('seq, role, content, created_at')

    if (insertError) {
      console.error('Failed to store commentary reply:', insertError)
      return NextResponse.json({ error: 'Failed to save reply' }, { status: 500 })
    }

    const userMessageCount = asked + 1
    return NextResponse.json({
      messages: (inserted as ReplyRow[]) || [],
      userMessageCount,
      atLimit: userMessageCount >= MAX_USER_MESSAGES,
    })
  } catch (error) {
    console.error('Commentary thread error:', error)

    if (error instanceof OpenAI.APIError && error.status === 429) {
      return NextResponse.json({ error: 'AI service is busy. Please try again.' }, { status: 503 })
    }

    return NextResponse.json({ error: 'Failed to generate reply' }, { status: 500 })
  }
}
