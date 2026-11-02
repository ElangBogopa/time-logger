/**
 * /api/commentary/thread — follow-up conversation on AI commentary.
 *
 * The rules being pinned here are the ones that keep the feature cheap, and
 * each is a bug this codebase has already had:
 *   - a GET never calls the model (the day commentary regenerated on every view)
 *   - a thread is capped, so context cannot grow turn after turn
 *   - the subject's data is re-derived server-side, never taken from the caller
 */

type InsertRow = Record<string, unknown>

const store: { replies: InsertRow[]; entries: InsertRow[]; inserted: InsertRow[][] } = {
  replies: [],
  entries: [],
  inserted: [],
}

let rateLimitAllows = true

type ChatArgs = { messages: { role: string; content: string }[] }

let lastRequest: ChatArgs | null = null
const mockCreate = jest.fn(async (args: ChatArgs) => {
  lastRequest = args
  return { choices: [{ message: { content: 'Because that was your longest focus block this week.' } }] }
})

// hoisted function declaration, so the jest.mock factory can reach it
function makeBuilder(table: string) {
  const state: { insert: InsertRow[] | null } = { insert: null }
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte', 'lte', 'order', 'limit']) {
    b[m] = () => b
  }
  b.insert = (rows: InsertRow[]) => {
    state.insert = rows
    store.inserted.push(rows)
    return b
  }
  b.then = (resolve: (v: unknown) => unknown) => {
    if (state.insert) return resolve({ data: state.insert, error: null })
    if (table === 'commentary_replies') return resolve({ data: store.replies, error: null })
    return resolve({ data: store.entries, error: null })
  }
  return b
}

jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init: { status?: number } = {}) => ({
      body,
      status: init.status ?? 200,
      json: async () => body,
    }),
  },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
// The real limiter is a module-level Map keyed by user, so every POST in this
// file shares one bucket and the eleventh would 429 regardless of what it is
// testing. Controlled here, with its own case below.
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ success: rateLimitAllows, remaining: 9, resetTime: Date.now() + 60000 }),
  getRateLimitHeaders: () => ({}),
  RATE_LIMITS: { ai: { limit: 10, windowMs: 60000 } },
}))
jest.mock('@/lib/supabase-server', () => ({ supabase: { from: (t: string) => makeBuilder(t) } }))
jest.mock('openai', () => {
  class FakeAPIError extends Error {
    status?: number
  }
  class FakeOpenAI {
    static APIError = FakeAPIError
    chat = { completions: { create: (...args: unknown[]) => mockCreate(args[0] as ChatArgs) } }
  }
  return { __esModule: true, default: FakeOpenAI }
})

import { getServerSession } from 'next-auth'
import type { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/commentary/thread/route'

function get(query: string): NextRequest {
  return {
    url: `http://localhost/api/commentary/thread?${query}`,
    method: 'GET',
    headers: { get: () => null },
  } as unknown as NextRequest
}

function post(body: unknown): NextRequest {
  return {
    url: 'http://localhost/api/commentary/thread',
    method: 'POST',
    headers: { get: () => null },
    json: async () => body,
  } as unknown as NextRequest
}

const DAY = { subject_type: 'day', subject_key: '2026-11-02' }

beforeEach(() => {
  jest.clearAllMocks()
  rateLimitAllows = true
  lastRequest = null
  store.replies = []
  store.inserted = []
  store.entries = [
    {
      id: 'e1',
      user_id: 'user-1',
      date: '2026-11-02',
      activity: 'Coding',
      category: 'deep_work',
      duration_minutes: 150,
      start_time: '09:00',
      end_time: '11:30',
      status: 'confirmed',
    },
  ]
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
})

type Body = {
  messages?: { seq: number; role: string; content: string }[]
  userMessageCount?: number
  atLimit?: boolean
  error?: string
}
type Res = { status: number; body: Body }

describe('GET', () => {
  it('rejects an unauthenticated caller', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = (await GET(get('subject_type=day&subject_key=2026-11-02'))) as unknown as Res
    expect(res.status).toBe(401)
  })

  it('never calls the model', async () => {
    store.replies = [
      { seq: 1, role: 'user', content: 'why?', created_at: '2026-11-02T20:00:00Z' },
      { seq: 2, role: 'assistant', content: 'because…', created_at: '2026-11-02T20:00:01Z' },
    ]

    const res = (await GET(get('subject_type=day&subject_key=2026-11-02'))) as unknown as Res

    expect(res.status).toBe(200)
    expect(res.body.messages).toHaveLength(2)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('reports how many questions have been asked, and the cap', async () => {
    store.replies = Array.from({ length: 12 }, (_, i) => ({
      seq: i + 1,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `m${i}`,
      created_at: '2026-11-02T20:00:00Z',
    }))

    const res = (await GET(get('subject_type=day&subject_key=2026-11-02'))) as unknown as Res

    expect(res.body.userMessageCount).toBe(6)
    expect(res.body.atLimit).toBe(true)
  })

  it.each([
    ['unknown type', 'subject_type=month&subject_key=2026-11'],
    ['day key that is not a date', 'subject_type=day&subject_key=tuesday'],
    ['entry key that is not a uuid', 'subject_type=entry&subject_key=123'],
    ['session key without a period', 'subject_type=session&subject_key=2026-11-02'],
    ['missing key', 'subject_type=day'],
  ])('rejects %s', async (_label, query) => {
    const res = (await GET(get(query))) as unknown as Res
    expect(res.status).toBe(400)
  })
})

describe('POST', () => {
  it('rejects an unauthenticated caller before generating', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = (await POST(post({ ...DAY, message: 'why?' }))) as unknown as Res
    expect(res.status).toBe(401)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('stores the question and the answer, and returns both', async () => {
    const res = (await POST(
      post({ ...DAY, message: 'Why do you say that?', subject_commentary: 'Strong focus today.' })
    )) as unknown as Res

    expect(res.status).toBe(200)
    expect(mockCreate).toHaveBeenCalledTimes(1)

    const rows = store.inserted[0]
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ seq: 1, role: 'user', content: 'Why do you say that?' })
    expect(rows[1]).toMatchObject({ seq: 2, role: 'assistant' })
    expect(res.body.userMessageCount).toBe(1)
  })

  it('snapshots the commentary on the first message only', async () => {
    await POST(post({ ...DAY, message: 'first', subject_commentary: 'Strong focus today.' }))
    expect(store.inserted[0][0]).toMatchObject({ subject_commentary: 'Strong focus today.' })

    store.replies = [
      { seq: 1, role: 'user', content: 'first', created_at: 'x' },
      { seq: 2, role: 'assistant', content: 'answer', created_at: 'x' },
    ]
    await POST(post({ ...DAY, message: 'second', subject_commentary: 'Changed commentary.' }))

    // the thread keeps the commentary it started from, not a later version
    expect(store.inserted[1][0]).toMatchObject({ seq: 3, subject_commentary: null })
  })

  it('continues an existing thread at the next seq', async () => {
    store.replies = [
      { seq: 1, role: 'user', content: 'first', created_at: 'x' },
      { seq: 2, role: 'assistant', content: 'answer', created_at: 'x' },
    ]

    await POST(post({ ...DAY, message: 'and what about mornings?' }))

    expect(store.inserted[0][0]).toMatchObject({ seq: 3, role: 'user' })
    expect(store.inserted[0][1]).toMatchObject({ seq: 4, role: 'assistant' })
  })

  it('refuses once the thread hits its limit', async () => {
    store.replies = Array.from({ length: 12 }, (_, i) => ({
      seq: i + 1,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `m${i}`,
      created_at: 'x',
    }))

    const res = (await POST(post({ ...DAY, message: 'one more' }))) as unknown as Res

    expect(res.status).toBe(409)
    expect(res.body.atLimit).toBe(true)
    expect(mockCreate).not.toHaveBeenCalled()
    expect(store.inserted).toHaveLength(0)
  })

  it('replays only the tail of a long thread to the model', async () => {
    store.replies = Array.from({ length: 10 }, (_, i) => ({
      seq: i + 1,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `m${i}`,
      created_at: 'x',
    }))
    // 5 questions so far, so this one is allowed
    await POST(post({ ...DAY, message: 'latest' }))

    const sent = lastRequest as unknown as ChatArgs
    // system + 6 replayed + the new question
    expect(sent.messages).toHaveLength(8)
    expect(sent.messages[sent.messages.length - 1].content).toBe('latest')
  })

  it('grounds the prompt in data it loaded itself, not data from the caller', async () => {
    await POST(
      post({
        ...DAY,
        message: 'why?',
        subject_commentary: 'Strong focus today.',
        // a caller cannot smuggle its own numbers in
        totalMinutesLogged: 99999,
        entries: [{ activity: 'Fabricated', duration_minutes: 99999 }],
      })
    )

    const sent = lastRequest as unknown as ChatArgs
    const system = sent.messages[0].content
    expect(system).toContain('Coding')
    expect(system).toContain('Strong focus today.')
    expect(system).not.toContain('Fabricated')
    expect(system).not.toContain('99999')
  })

  it('tells the model how categories are assigned, and not to blame the person', async () => {
    // The first real thread answered "why wasn't that deep work" by guessing
    // at the person — "multitasking or not fully engaged" — because nothing
    // told it the category came from a classifier reading the activity text.
    await POST(post({ ...DAY, message: 'why?', subject_commentary: 'Strong focus today.' }))

    const system = (lastRequest as unknown as ChatArgs).messages[0].content
    expect(system).toContain('assigned automatically by a')
    expect(system).toContain('ASSUME THE WORK WAS WORK')
    expect(system).toContain('slacking')
  })

  it('tells the model to answer the question and skip the advice', async () => {
    // Every reply in the first real thread ended with homework.
    await POST(post({ ...DAY, message: 'why?' }))

    const system = (lastRequest as unknown as ChatArgs).messages[0].content
    expect(system).toContain('No closing advice')
    expect(system).toContain('Answer the question that was asked')
  })

  it('tells the model to correct itself rather than defend an answer', async () => {
    await POST(post({ ...DAY, message: 'I dont like your tone' }))

    const system = (lastRequest as unknown as ChatArgs).messages[0].content
    expect(system).toContain('push back on your tone')
    expect(system).toContain('Do not defend a previous answer')
  })

  it('keeps the cheek while ruling out condescension', async () => {
    await POST(post({ ...DAY, message: 'why?' }))

    const system = (lastRequest as unknown as ChatArgs).messages[0].content
    expect(system).toContain('Cheeky is fine')
    expect(system).toContain('condescending never is')
  })

  it.each([
    ['an empty message', { ...DAY, message: '   ' }],
    ['a missing message', { ...DAY }],
    ['an over-long message', { ...DAY, message: 'x'.repeat(2001) }],
    ['an invalid subject', { subject_type: 'month', subject_key: '2026-11', message: 'why?' }],
  ])('rejects %s', async (_label, body) => {
    const res = (await POST(post(body))) as unknown as Res
    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns 429 when the rate limit is hit, without generating', async () => {
    rateLimitAllows = false

    const res = (await POST(post({ ...DAY, message: 'why?' }))) as unknown as Res

    expect(res.status).toBe(429)
    expect(mockCreate).not.toHaveBeenCalled()
    expect(store.inserted).toHaveLength(0)
  })

  it('does not store anything when the model returns nothing', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: '   ' } }] })

    const res = (await POST(post({ ...DAY, message: 'why?' }))) as unknown as Res

    expect(res.status).toBe(502)
    expect(store.inserted).toHaveLength(0)
  })
})
