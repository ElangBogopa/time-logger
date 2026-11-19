/**
 * /api/period-commentary.
 *
 * It used to make three generations from the same context — commentary,
 * insight and prediction — differing only in system prompt, and the tests
 * here pinned that they ran in parallel rather than in series.
 *
 * The insight and the prediction are gone. On screen they restated what the
 * card already showed ("You spent 37.5% of your evening on social
 * activities", above a list reading Social 1h30m) or said nothing worth
 * reading ("If you maintain this evening routine, you could easily finish
 * the week strong"). They cost two thirds of this route's model calls, three
 * times a day. What this file pins now is that only one call is made.
 */

type Completion = { choices: { message: { content: string } }[] }

let started = 0
let shouldFail = false
let lastArgs: { messages: { role: string; content: string }[] } | null = null

// hoisted so the jest.mock factory can reach it
function createCompletion(args?: unknown): Promise<Completion> {
  started += 1
  lastArgs = (args as typeof lastArgs) ?? null
  if (shouldFail) return Promise.reject(new Error('generation failed'))
  return Promise.resolve({ choices: [{ message: { content: 'A steady morning.' } }] })
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
jest.mock('@/lib/session', () => ({ getAppSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('openai', () => {
  // The route's catch does `error instanceof OpenAI.APIError`, so the fake
  // needs that static too — without it the check throws inside the catch.
  class FakeAPIError extends Error {
    status?: number
  }
  class FakeOpenAI {
    static APIError = FakeAPIError
    chat = { completions: { create: (args: unknown) => createCompletion(args) } }
  }
  return { __esModule: true, default: FakeOpenAI }
})

import { getAppSession } from '@/lib/session'
import type { NextRequest } from 'next/server'
import { POST } from '@/app/api/period-commentary/route'

const body = {
  period: 'morning',
  date: '2026-11-02',
  entries: [
    { id: 'e1', activity: 'Coding', category: 'deep_work', duration_minutes: 120, start_time: '09:00', end_time: '11:00' },
    { id: 'e2', activity: 'Email', category: 'admin', duration_minutes: 30, start_time: '11:00', end_time: '11:30' },
  ],
}

function request(payload: unknown = body): NextRequest {
  return {
    url: 'http://localhost/api/period-commentary',
    method: 'POST',
    headers: { get: () => null },
    json: async () => payload,
  } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  started = 0
  shouldFail = false
  lastArgs = null
  ;(getAppSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
})

type Body = { commentary: string; insight?: unknown; prediction?: unknown }

it('generates the commentary in a single call', async () => {
  const res = (await POST(request())) as unknown as { status: number; body: Body }

  expect(started).toBe(1)
  expect(res.status).toBe(200)
  expect(res.body.commentary).toBe('A steady morning.')
})

it('no longer returns an insight or a prediction', async () => {
  const res = (await POST(request())) as unknown as { status: number; body: Body }

  expect(res.body).not.toHaveProperty('insight')
  expect(res.body).not.toHaveProperty('prediction')
})

it('fails the request when the generation fails', async () => {
  shouldFail = true

  const res = (await POST(request())) as unknown as { status: number }

  expect(res.status).toBe(500)
})

it('rejects an unauthenticated caller before generating anything', async () => {
  ;(getAppSession as jest.Mock).mockResolvedValue(null)

  const res = (await POST(request())) as unknown as { status: number }

  expect(res.status).toBe(401)
  expect(started).toBe(0)
})

it('writes the prompt from the session\'s activities and sends one call', async () => {
  await POST(request())
  expect(started).toBe(1)
  const user = lastArgs?.messages.find((m) => m.role === 'user')?.content ?? ''
  expect(user).toContain('Coding')
})

it('ignores a malformed plans, wakeMinutes and nowMinutes rather than rejecting', async () => {
  const res = (await POST(
    request({ ...body, dayEntries: 'nope', plans: [{ title: 5 }, 'x'], wakeMinutes: 'late', nowMinutes: 99999 })
  )) as unknown as { status: number }
  expect(res.status).toBe(200)
  expect(started).toBe(1)
})

it('rejects a body without entries', async () => {
  const res = (await POST(request({ ...body, entries: [] }))) as unknown as { status: number }
  expect(res.status).toBe(400)
  expect(started).toBe(0)
})
