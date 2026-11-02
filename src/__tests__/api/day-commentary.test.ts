/**
 * /api/day-commentary must survive the payload the client actually sends.
 *
 * The route read dayData.wins.length and dayData.targetProgress.length
 * directly. /api/day-summary stopped returning targetProgress when the weekly
 * targets system was removed, so the client sent `targetProgress: undefined`,
 * JSON.stringify dropped the key, and the route threw
 * "Cannot read properties of undefined (reading 'length')" — caught by the
 * handler and returned as a 500. Observed live: one POST, 500, no commentary.
 */

type ChatArgs = { messages: { role: string; content: string }[] }

let lastPrompt = ''
const mockCreate = jest.fn(async (args: ChatArgs) => {
  lastPrompt = args.messages[0].content
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
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
// This route builds its OpenAI client at module scope, so the class is
// constructed during import — before this file's consts initialise. The arrow
// defers reading mockCreate until the call itself.
jest.mock('openai', () => ({
  __esModule: true,
  default: class {
    chat = { completions: { create: (...args: unknown[]) => mockCreate(args[0] as ChatArgs) } }
  },
}))

import { getServerSession } from 'next-auth'
import type { NextRequest } from 'next/server'
import { POST } from '@/app/api/day-commentary/route'

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
  lastPrompt = ''
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })
})

// Exactly what DayReviewContent posts: day-summary has no targetProgress field,
// so the key never makes it into the request body.
const realPayload = {
  score: 67,
  totalMinutesLogged: 1080,
  wins: [{ id: 'longest-focus', text: '150 min focus session on "Coding"', type: 'focus', value: 150 }],
  mood: null,
  longestFocusSession: { activity: 'Coding', minutes: 150 },
}

it('returns commentary when targetProgress is absent', async () => {
  const res = (await POST(request(realPayload))) as { status: number; body: { commentary?: string } }

  expect(res.status).toBe(200)
  expect(res.body.commentary).toBe('A steady day with real focus in it.')
})

it('includes the wins text in the prompt', async () => {
  await POST(request(realPayload))

  expect(lastPrompt).toContain('150 min focus session on "Coding"')
  expect(lastPrompt).not.toContain('undefined')
})

it('survives a payload with neither wins nor targetProgress', async () => {
  const res = (await POST(request({ score: 40, totalMinutesLogged: 120 }))) as { status: number }

  expect(res.status).toBe(200)
})

it('still returns 500 if the model call itself fails', async () => {
  mockCreate.mockRejectedValueOnce(new Error('upstream down'))

  const res = (await POST(request(realPayload))) as { status: number }

  expect(res.status).toBe(500)
})
