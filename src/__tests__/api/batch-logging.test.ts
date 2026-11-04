/**
 * Batch create and batch categorise — the two requests behind "same as
 * yesterday" and "confirm all".
 *
 * Confirming four calendar events one at a time was four categorise calls
 * (each re-sending the whole ~800-token prompt), four inserts, and four
 * chances to leave the day half written. These paths do each in one request.
 */

type ChatArgs = { messages: { role: string; content: string }[] }

let lastUserMessage = ''
let nextAnswer = ''
const mockCreate = jest.fn(async (args: ChatArgs) => {
  lastUserMessage = args.messages[args.messages.length - 1].content
  return { choices: [{ message: { content: nextAnswer } }] }
})

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
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ success: true, remaining: 9, resetTime: Date.now() + 60000 }),
  getRateLimitHeaders: () => ({}),
  RATE_LIMITS: { ai: { limit: 10, windowMs: 60000 } },
}))
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

const insert = jest.fn()
jest.mock('@/lib/supabase-server', () => ({
  supabase: { from: () => ({ insert: (...args: unknown[]) => insert(...args) }) },
}))

import { getServerSession } from 'next-auth'
import type { NextRequest } from 'next/server'
import { POST as categorize } from '@/app/api/categorize/route'
import { POST as createEntries } from '@/app/api/entries/route'

const request = (body: unknown): NextRequest =>
  ({
    url: 'http://localhost/api',
    method: 'POST',
    headers: { get: () => null },
    json: async () => body,
  }) as unknown as NextRequest

const row = (activity: string) => ({
  date: '2026-11-03',
  activity,
  duration_minutes: 60,
  start_time: '09:00',
  end_time: '10:00',
})

beforeEach(() => {
  jest.clearAllMocks()
  lastUserMessage = ''
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
  insert.mockReturnValue({ select: async () => ({ data: [{ id: 'a' }, { id: 'b' }], error: null }) })
})

describe('creating a set of entries', () => {
  it('inserts them all in one call, scoped to the signed-in user', async () => {
    const res = await createEntries(request({ entries: [row('Work'), row('Lunch')] }))

    expect(res.status).toBe(200)
    expect(insert).toHaveBeenCalledTimes(1)
    const [rows] = insert.mock.calls[0] as [Array<{ user_id: string; activity: string }>]
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.activity)).toEqual(['Work', 'Lunch'])
    expect(rows.every((r) => r.user_id === 'user-1')).toBe(true)
  })

  it('returns an array for a batch and a single object for one entry', async () => {
    const batch = (await createEntries(request({ entries: [row('Work')] }))) as unknown as {
      body: { data: unknown }
    }
    expect(Array.isArray(batch.body.data)).toBe(true)

    // Every existing caller reads data.id straight off the response.
    const single = (await createEntries(request(row('Work')))) as unknown as {
      body: { data: { id: string } }
    }
    expect(single.body.data).toEqual({ id: 'a' })
  })

  it('rejects the whole batch when any entry is incomplete', async () => {
    const res = await createEntries(
      request({ entries: [row('Work'), { date: '2026-11-03', activity: 'No duration' }] })
    )

    expect(res.status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })

  it('refuses an empty or oversized batch', async () => {
    expect((await createEntries(request({ entries: [] }))).status).toBe(400)
    const tooMany = Array.from({ length: 26 }, () => row('Work'))
    expect((await createEntries(request({ entries: tooMany }))).status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })

  it('requires a session', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    expect((await createEntries(request({ entries: [row('Work')] }))).status).toBe(401)
  })
})

describe('categorising a set of activities', () => {
  it('asks the model once for the whole set and keeps the order', async () => {
    nextAnswer = 'meetings\nmeals\ndeep_work'
    const res = (await categorize(
      request({ activities: ['Standup', 'Lunch', 'Writing the report'] })
    )) as unknown as { body: { categories: string[] } }

    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(res.body.categories).toEqual(['meetings', 'meals', 'deep_work'])
  })

  it('tolerates a numbered answer', async () => {
    nextAnswer = '1. meetings\n2. meals'
    const res = (await categorize(request({ activities: ['Standup x', 'Lunch x'] }))) as unknown as {
      body: { categories: string[] }
    }
    expect(res.body.categories).toEqual(['meetings', 'meals'])
  })

  it('falls back to other for lines the model did not answer', async () => {
    // A short answer must not lose the entries the caller is confirming.
    nextAnswer = 'meetings'
    const res = (await categorize(request({ activities: ['Standup y', 'Lunch y'] }))) as unknown as {
      body: { categories: string[] }
    }
    expect(res.body.categories).toEqual(['meetings', 'other'])
  })

  it('rejects an invalid category rather than storing it', async () => {
    nextAnswer = 'productive'
    const res = (await categorize(request({ activities: ['Something new entirely'] }))) as unknown as {
      body: { categories: string[] }
    }
    expect(res.body.categories).toEqual(['other'])
  })

  it('asks about a repeated activity once', async () => {
    nextAnswer = 'meetings'
    const res = (await categorize(
      request({ activities: ['Daily sync', 'daily sync', 'DAILY SYNC'] })
    )) as unknown as { body: { categories: string[] } }

    expect(lastUserMessage.match(/daily sync/gi)).toHaveLength(1)
    expect(res.body.categories).toEqual(['meetings', 'meetings', 'meetings'])
  })

  it('does not call the model at all when every activity is cached', async () => {
    nextAnswer = 'exercise'
    await categorize(request({ activities: ['Morning swim session'] }))
    expect(mockCreate).toHaveBeenCalledTimes(1)

    mockCreate.mockClear()
    const res = (await categorize(request({ activities: ['morning swim session'] }))) as unknown as {
      body: { categories: string[] }
    }
    expect(mockCreate).not.toHaveBeenCalled()
    expect(res.body.categories).toEqual(['exercise'])
  })

  it('refuses an empty or oversized batch', async () => {
    expect((await categorize(request({ activities: [] }))).status).toBe(400)
    expect((await categorize(request({ activities: Array(26).fill('Work') }))).status).toBe(400)
  })

  it('still answers the single form', async () => {
    nextAnswer = 'deep_work'
    const res = (await categorize(request({ activity: 'Refactoring the parser' }))) as unknown as {
      body: { category: string }
    }
    expect(res.body.category).toBe('deep_work')
  })
})
