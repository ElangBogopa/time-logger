/**
 * Auth guards on the AI routes
 *
 * Every route that spends OpenAI credit must reject unauthenticated callers
 * before it reaches the model. /api/commentary and /api/period-commentary
 * once had no session check at all, so anyone could bill the project's key;
 * the CSRF middleware does not help, since its unsigned double-submit token
 * is trivial for a script to satisfy.
 *
 * Each case asserts both halves: a 401 out, and no model call made.
 */

const mockCreate = jest.fn(() => {
  throw new Error('OpenAI was called on an unauthenticated request')
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
jest.mock('@/lib/supabase-server', () => ({
  supabase: { from: jest.fn(() => ({ select: jest.fn() })) },
}))
jest.mock('openai', () => ({
  __esModule: true,
  default: class {
    chat = { completions: { create: mockCreate } }
  },
}))

import { getServerSession } from 'next-auth'
import type { NextRequest } from 'next/server'

type AiRoute = { POST: (request: NextRequest) => Promise<unknown> }

function mockRequest(body: unknown = {}): NextRequest {
  return {
    headers: { get: () => null },
    json: async () => body,
    url: 'http://localhost/api/test',
    method: 'POST',
  } as unknown as NextRequest
}

const ROUTES: { name: string; load: () => Promise<AiRoute>; body: unknown }[] = [
  {
    name: '/api/categorize',
    load: () => import('@/app/api/categorize/route'),
    body: { activity: 'writing code' },
  },
  {
    name: '/api/commentary',
    load: () => import('@/app/api/commentary/route'),
    body: { entry: { activity: 'writing code', category: 'deep_work', duration_minutes: 60 }, dayEntries: [] },
  },
  {
    name: '/api/day-commentary',
    load: () => import('@/app/api/day-commentary/route'),
    body: { score: 80, totalMinutesLogged: 300, wins: [], targetProgress: [] },
  },
  {
    name: '/api/period-commentary',
    load: () => import('@/app/api/period-commentary/route'),
    body: { period: 'morning', date: '2026-11-01', entries: [{ activity: 'writing code', category: 'deep_work', duration_minutes: 60 }] },
  },
  {
    name: '/api/weekly-review',
    load: () => import('@/app/api/weekly-review/route'),
    body: { weekStart: '2026-11-02' },
  },
]

describe('AI routes reject unauthenticated callers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each(ROUTES)('$name returns 401 with no session', async ({ load, body }) => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const { POST } = await load()
    const response = (await POST(mockRequest(body))) as { status: number; body: { error?: string } }

    expect(response.status).toBe(401)
    expect(response.body.error).toBe('Unauthorized')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it.each(ROUTES)('$name returns 401 for a session with no user id', async ({ load, body }) => {
    // A session object can exist without a usable user id; that must not pass.
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { email: 'nobody@example.com' } })

    const { POST } = await load()
    const response = (await POST(mockRequest(body))) as { status: number }

    expect(response.status).toBe(401)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
