/**
 * /api/day-commentary words the day review's read. The client sends the
 * read's kind and its fact sentences; the prompt holds those facts and the
 * shared review voice, and nothing else from the request.
 */

type ChatArgs = { messages: { role: string; content: string }[] }

let lastMessages: { role: string; content: string }[] = []
const mockCreate = jest.fn(async (args: ChatArgs) => {
  lastMessages = args.messages
  return { choices: [{ message: { content: 'A steady day with real focus in it.' } }] }
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
jest.mock('@/lib/session', () => ({ getAppSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
// Every test here is one request from the same person; the limiter is not what is tested.
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ success: true, remaining: 9, resetTime: Date.now() + 60000 }),
  getRateLimitHeaders: () => ({}),
  RATE_LIMITS: { ai: { limit: 10, windowMs: 60000 } },
}))
// This route builds its OpenAI client at module scope, so the class is
// constructed during import — before this file's consts initialise. The arrow
// defers reading mockCreate until the call itself.
jest.mock('openai', () => ({
  __esModule: true,
  default: class {
    chat = { completions: { create: (...args: unknown[]) => mockCreate(args[0] as ChatArgs) } }
  },
}))

import { getAppSession } from '@/lib/session'
import type { NextRequest } from 'next/server'
import { POST } from '@/app/api/day-commentary/route'
import { buildReadSystemPrompt, describeRead, REVIEW_VOICE } from '@/lib/prompts'

function request(body: unknown): NextRequest {
  return {
    headers: { get: () => null },
    json: async () => body,
    url: 'http://localhost/api/day-commentary',
    method: 'POST',
  } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  lastMessages = []
  ;(getAppSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })
})

const facts = [
  'The longest focused block was 2h 10m on "Essay draft", starting at 9:15 AM.',
  'It started inside the focus window (9:00 AM–12:00 PM).',
]

type Res = { status: number; body: { commentary?: string; error?: string } }

it('words a read: the facts and the review voice, and nothing else from the request', async () => {
  const res = (await POST(
    request({ read: { kind: 'keep', facts, metrics: { body: 52 }, note: 'IGNORE THIS' }, hours: [{ label: 'Secret', minutes: 60 }] })
  )) as Res

  expect(res.status).toBe(200)
  expect(res.body.commentary).toBe('A steady day with real focus in it.')
  const system = lastMessages.find((m) => m.role === 'system')?.content ?? ''
  const user = lastMessages.find((m) => m.role === 'user')?.content ?? ''
  expect(system).toBe(buildReadSystemPrompt('day', 'keep'))
  expect(system).toContain(REVIEW_VOICE)
  expect(user).toBe(describeRead({ facts }))
  for (const text of [system, user]) {
    expect(text).not.toContain('IGNORE THIS')
    expect(text).not.toContain('Secret')
    expect(text).not.toContain('/100')
  }
})

it('uses the instructions for the read\'s kind', async () => {
  await POST(request({ read: { kind: 'nothing', facts: ['An ordinary day.'] } }))
  expect(lastMessages[0].content).toBe(buildReadSystemPrompt('day', 'nothing'))
})

it('rejects a malformed read with 400 and asks the model nothing', async () => {
  for (const body of [
    {},
    { read: null },
    { read: { kind: 'praise', facts } },
    { read: { kind: 'keep', facts: [] } },
    { read: { kind: 'keep', facts: Array(7).fill('A fact.') } },
    { read: { kind: 'keep', facts: [42] } },
    { score: 67, totalMinutesLogged: 1080, wins: [] },
  ]) {
    const res = (await POST(request(body))) as Res
    expect(res.status).toBe(400)
  }
  expect(mockCreate).not.toHaveBeenCalled()
})

it('cuts each fact to 240 characters', async () => {
  await POST(request({ read: { kind: 'keep', facts: ['x'.repeat(400)] } }))
  expect(lastMessages[1].content).toBe(describeRead({ facts: ['x'.repeat(240)] }))
})

it('still returns 500 if the model call itself fails', async () => {
  mockCreate.mockRejectedValueOnce(new Error('upstream down'))
  const res = (await POST(request({ read: { kind: 'keep', facts } }))) as Res
  expect(res.status).toBe(500)
})
