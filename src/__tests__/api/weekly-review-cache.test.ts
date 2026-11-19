/**
 * The weekly coach summary must not be regenerated when the week is unchanged.
 *
 * WeeklyReviewContent POSTs on every mount and had no cache of any kind, while
 * the route called OpenAI unconditionally — so every view of the weekly tab,
 * and every flip between the Today and Weekly tabs, cost a generation.
 *
 * The client now sends the fingerprint of the summary it holds; the route
 * hashes the prompt context and skips the model when they match.
 */

const mockCreate = jest.fn(async () => ({
  choices: [{ message: { content: 'A strong week of focus.' } }],
}))

const entries = Array.from({ length: 10 }, (_, i) => ({
  id: `e${i}`,
  user_id: 'user-1',
  date: `2026-10-${String(26 + (i % 5)).padStart(2, '0')}`,
  activity: 'Coding',
  category: 'deep_work',
  duration_minutes: 60,
  start_time: '09:00',
  end_time: '10:00',
  status: 'confirmed',
}))

// The week before: twice the time, so a "Logged N% less" insight would be
// pushed if the route still made one (this week is 50% less than it).
const previousEntries = Array.from({ length: 20 }, (_, i) => ({
  ...entries[0],
  id: `p${i}`,
  date: `2026-10-${String(19 + (i % 5)).padStart(2, '0')}`,
}))

// hoisted function declaration, so the jest.mock factory can reach it.
// It honours the date range, so each week's query gets that week's entries.
function makeBuilder() {
  const range: { gte?: string; lte?: string } = {}
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order', 'in', 'not', 'limit']) {
    b[m] = () => b
  }
  b.gte = (col: string, v: string) => {
    if (col === 'date') range.gte = v
    return b
  }
  b.lte = (col: string, v: string) => {
    if (col === 'date') range.lte = v
    return b
  }
  // awaited at the end of a chain
  b.then = (resolve: (v: unknown) => unknown) =>
    resolve({
      data: [...entries, ...previousEntries].filter(
        (e) => (!range.gte || e.date >= range.gte) && (!range.lte || e.date <= range.lte)
      ),
      error: null,
    })
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
jest.mock('@/lib/session', () => ({ getAppSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/supabase-server', () => ({ supabase: { from: () => makeBuilder() } }))
jest.mock('openai', () => ({
  __esModule: true,
  default: class {
    chat = { completions: { create: (...args: unknown[]) => mockCreate(...(args as [])) } }
  },
}))

import { getAppSession } from '@/lib/session'
import type { NextRequest } from 'next/server'
import { POST } from '@/app/api/weekly-review/route'

function request(body: unknown): NextRequest {
  return {
    url: 'http://localhost/api/weekly-review',
    method: 'POST',
    headers: { get: () => null },
    json: async () => body,
  } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAppSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
})

type Body = { coachSummary: string | null; coachFingerprint: string | null; coachSummaryUnchanged: boolean }

it('generates a summary and returns its fingerprint on a cold call', async () => {
  const res = (await POST(request({ weekStart: '2026-10-26', timezone: 'America/Toronto' }))) as unknown as { status: number; body: Body }

  expect(res.status).toBe(200)
  expect(mockCreate).toHaveBeenCalledTimes(1)
  expect(res.body.coachSummary).toBe('A strong week of focus.')
  expect(res.body.coachFingerprint).toEqual(expect.any(String))
  expect(res.body.coachSummaryUnchanged).toBe(false)
  const insights = (res.body as unknown as { insights: string[] }).insights
  expect(insights.some((i) => i.startsWith('Logged '))).toBe(false)
})

it('skips the model when the caller already holds that summary', async () => {
  const first = (await POST(request({ weekStart: '2026-10-26', timezone: 'America/Toronto' }))) as unknown as { body: Body }
  const fingerprint = first.body.coachFingerprint
  jest.clearAllMocks()

  const second = (await POST(
    request({ weekStart: '2026-10-26', timezone: 'America/Toronto', knownCoachFingerprint: fingerprint })
  )) as unknown as { body: Body }

  expect(mockCreate).not.toHaveBeenCalled()
  expect(second.body.coachSummaryUnchanged).toBe(true)
  expect(second.body.coachFingerprint).toBe(fingerprint)
  expect(second.body.coachSummary).toBeNull()
})

it('generates again when the caller holds a stale fingerprint', async () => {
  const res = (await POST(
    request({ weekStart: '2026-10-26', timezone: 'America/Toronto', knownCoachFingerprint: 'from-a-different-week' })
  )) as unknown as { body: Body }

  expect(mockCreate).toHaveBeenCalledTimes(1)
  expect(res.body.coachSummaryUnchanged).toBe(false)
  expect(res.body.coachSummary).toBe('A strong week of focus.')
})

it('asks for facts in the shared review voice, with no coaching warmth', async () => {
  await POST(request({ weekStart: '2026-10-26', timezone: 'America/Toronto' }))

  const calls = mockCreate.mock.calls as unknown as Array<[{ messages: Array<{ role: string; content: string }> }]>
  const system = calls[0][0].messages.find((m) => m.role === 'system')?.content ?? ''
  expect(system).toContain('No praise')
  expect(system).not.toContain('supportive')
  expect(system).not.toContain('warm')
})

it('still returns the week stats when generation is skipped', async () => {
  const first = (await POST(request({ weekStart: '2026-10-26', timezone: 'America/Toronto' }))) as unknown as { body: Body & { entryCount?: number } }
  const second = (await POST(
    request({ weekStart: '2026-10-26', timezone: 'America/Toronto', knownCoachFingerprint: first.body.coachFingerprint })
  )) as unknown as { body: Body & { entryCount?: number } }

  // the cheap database-derived numbers are always fresh; only the model is skipped
  expect(second.body.entryCount).toBe(first.body.entryCount)
  expect(second.body.entryCount).toBeGreaterThan(0)
})

/**
 * The week in progress. The route decided "is this the current week?" by
 * comparing the requested start with a Sunday it computed itself, while
 * the client asks for weeks starting on Monday — so the answer was always
 * no, today was never left out, and a part-week was compared with a full
 * one ("49% less time logged" on a Wednesday).
 */
describe('a week still in progress', () => {
  const types = jest.requireActual('@/lib/types')
  const today: string = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const monday: string = types.getWeekStartForDate(today, 1)
  const daysIntoWeek = Math.round(
    (new Date(today + 'T12:00:00').getTime() - new Date(monday + 'T12:00:00').getTime()) / 86_400_000
  )

  it('covers only the days that have finished', async () => {
    const res = (await POST(request({ weekStart: monday, timezone: 'America/Toronto' }))) as unknown as {
      body: { evaluatedDays: number }
    }
    // Monday shows itself; any later day shows the days before it.
    expect(res.body.evaluatedDays).toBe(Math.max(1, daysIntoWeek))
    expect(res.body.evaluatedDays).toBeLessThan(7)
  })

  it('still treats a past week as all seven days', async () => {
    const res = (await POST(request({ weekStart: '2026-10-26', timezone: 'America/Toronto' }))) as unknown as {
      body: { evaluatedDays: number }
    }
    expect(res.body.evaluatedDays).toBe(7)
  })
})

it('says which one sentence may be a suggestion, with no evaluation and no scores', async () => {
  await POST(request({ weekStart: '2026-10-26', timezone: 'America/Toronto' }))

  const calls = mockCreate.mock.calls as unknown as Array<
    [{ temperature: number; messages: Array<{ role: string; content: string }> }]
  >
  const args = calls[0][0]
  const system = args.messages.find((m) => m.role === 'system')?.content ?? ''
  const user = args.messages.find((m) => m.role === 'user')?.content ?? ''
  expect(system).toContain('only sentence that is not a statement')
  expect(system).not.toContain('What to watch')
  expect(system).not.toContain('needing attention')
  expect(user).not.toContain('/100')
  expect(args.temperature).toBe(0.4)
})
