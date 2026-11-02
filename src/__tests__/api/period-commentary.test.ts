/**
 * /api/period-commentary makes three generations — commentary, insight and
 * prediction — from the same context, differing only in system prompt. They
 * were awaited one after another, so finishing a session waited on three
 * round trips in series while the summary popup span.
 */

type Completion = { choices: { message: { content: string } }[] }

let started = 0
let releaseBarrier: () => void = () => {}
let barrier: Promise<void>
let failOn: number | null = null

// hoisted so the jest.mock factory can reach it
function createCompletion(): Promise<Completion> {
  started += 1
  const mine = started
  if (mine === 3) releaseBarrier() // only unblocks if all three were started
  return barrier.then(() => {
    if (failOn === mine) throw new Error(`generation ${mine} failed`)
    return { choices: [{ message: { content: `text ${mine}` } }] }
  })
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
jest.mock('openai', () => {
  // The route's catch does `error instanceof OpenAI.APIError`, so the fake
  // needs that static too — without it the check throws inside the catch.
  class FakeAPIError extends Error {
    status?: number
  }
  class FakeOpenAI {
    static APIError = FakeAPIError
    chat = { completions: { create: () => createCompletion() } }
  }
  return { __esModule: true, default: FakeOpenAI }
})

import { getServerSession } from 'next-auth'
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
  failOn = null
  barrier = new Promise<void>((resolve) => {
    releaseBarrier = resolve
  })
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
})

type Body = { commentary: string; insight: string | null; prediction: string | null }

it('starts all three generations before any of them resolves', async () => {
  // The barrier only releases once the third call has been made. If the route
  // awaited them in series this would never resolve and the test would time out.
  const res = (await POST(request())) as unknown as { status: number; body: Body }

  expect(started).toBe(3)
  expect(res.status).toBe(200)
  expect(res.body.commentary).toBe('text 1')
  expect(res.body.insight).toBe('text 2')
  expect(res.body.prediction).toBe('text 3')
})

it('still returns the commentary when the insight fails', async () => {
  failOn = 2

  const res = (await POST(request())) as unknown as { status: number; body: Body }

  expect(res.status).toBe(200)
  expect(res.body.commentary).toBe('text 1')
  expect(res.body.insight).toBeNull()
  expect(res.body.prediction).toBe('text 3')
})

it('still returns the commentary when the prediction fails', async () => {
  failOn = 3

  const res = (await POST(request())) as unknown as { status: number; body: Body }

  expect(res.status).toBe(200)
  expect(res.body.commentary).toBe('text 1')
  expect(res.body.prediction).toBeNull()
})

it('fails the request when the commentary itself fails', async () => {
  failOn = 1

  const res = (await POST(request())) as unknown as { status: number }

  expect(res.status).toBe(500)
})

it('rejects an unauthenticated caller before generating anything', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)

  const res = (await POST(request())) as unknown as { status: number }

  expect(res.status).toBe(401)
  expect(started).toBe(0)
})
