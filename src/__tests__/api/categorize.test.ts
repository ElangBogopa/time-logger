/**
 * /api/categorize
 *
 * A bare "Work" was coming back as 'other', which the energy view then scored
 * as escape — five hours of a working day counted as leisure. The prompt
 * described deep_work ("coding, writing, analysis") and shallow_work ("work
 * email, Slack") but said nothing about an activity that only says someone
 * worked, so the model fell through to the fallback.
 *
 * The model's actual answer cannot be asserted here, so what is pinned is the
 * instruction being present, the fallback behaviour, and the cache.
 */

type ChatArgs = { messages: { role: string; content: string }[] }

let lastPrompt = ''
let nextAnswer = 'shallow_work'
const mockCreate = jest.fn(async (args: ChatArgs) => {
  lastPrompt = args.messages[0].content
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

import { getServerSession } from 'next-auth'
import type { NextRequest } from 'next/server'
import { POST } from '@/app/api/categorize/route'

function request(activity: string): NextRequest {
  return {
    url: 'http://localhost/api/categorize',
    method: 'POST',
    headers: { get: () => null },
    json: async () => ({ activity }),
  } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  lastPrompt = ''
  nextAnswer = 'shallow_work'
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
})

type Res = { status: number; body: { category?: string; error?: string } }

it('tells the model to treat a bare working day as real work', async () => {
  await POST(request('some unique activity for the prompt check'))

  expect(lastPrompt).toContain('ASSUME A WORKING DAY IS REAL WORK')
  expect(lastPrompt).toMatch(/"Work" → deep_work/)
})

it('tells the model not to infer shallow work from missing detail', async () => {
  await POST(request('a third unique activity for the prompt check'))

  // "shallow" was reading as "barely working": it scores 0.3 against deep
  // work's 1.0 and the session commentary did not count it as productive.
  expect(lastPrompt).toContain('Never infer')
  expect(lastPrompt).toMatch(/a missing description is not evidence/)
})

it('tells the model to use other only as a last resort', async () => {
  await POST(request('another unique activity for the prompt check'))

  expect(lastPrompt).toContain("USE 'other' ONLY AS A LAST RESORT")
})

it('returns the category the model picked', async () => {
  nextAnswer = 'deep_work'

  const res = (await POST(request('Refactoring the parser'))) as unknown as Res

  expect(res.status).toBe(200)
  expect(res.body.category).toBe('deep_work')
})

it('falls back to other when the model answers with something invalid', async () => {
  nextAnswer = 'productive'

  const res = (await POST(request('An activity with a nonsense answer'))) as unknown as Res

  expect(res.body.category).toBe('other')
})

it('serves a repeated activity from cache without asking again', async () => {
  nextAnswer = 'deep_work'
  const first = (await POST(request('Writing the quarterly memo'))) as unknown as Res
  expect(first.body.category).toBe('deep_work')
  expect(mockCreate).toHaveBeenCalledTimes(1)

  // same text, normalised — must not cost a second call
  const second = (await POST(request('  writing the QUARTERLY memo  '))) as unknown as Res
  expect(second.body.category).toBe('deep_work')
  expect(mockCreate).toHaveBeenCalledTimes(1)
})

it('rejects an unauthenticated caller', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)

  const res = (await POST(request('Work'))) as unknown as Res

  expect(res.status).toBe(401)
  expect(mockCreate).not.toHaveBeenCalled()
})
