/**
 * DELETE /api/goals
 *
 * Goals were create-only: the route had GET and POST and nothing else, and no
 * screen offered a way to remove one. A duplicate created by re-onboarding
 * (before the guard in b8fcd37) therefore sat on the dashboard permanently
 * with no way to clear it from inside the app.
 *
 * The delete is soft — `active: false` — because GET filters on active, and a
 * hard delete would fire daily_plans' ON DELETE SET NULL and detach the task
 * history from the goal it belonged to.
 */

let nextResult: { data: unknown; error: unknown } = { data: [{ id: 'goal-1' }], error: null }
const captured: { table?: string; patch?: Record<string, unknown>; filters: [string, unknown][] } = { filters: [] }

// A function declaration, so it is hoisted above the jest.mock factory below —
// a const would be in its TDZ when the route module is imported.
function makeBuilder(table: string) {
  captured.table = table
  const b = {
    update(patch: Record<string, unknown>) { captured.patch = patch; return b },
    eq(column: string, value: unknown) { captured.filters.push([column, value]); return b },
    select() { return Promise.resolve(nextResult) },
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
jest.mock('@/lib/supabase-server', () => ({ supabase: { from: (t: string) => makeBuilder(t) } }))

import { getServerSession } from 'next-auth'
import type { NextRequest } from 'next/server'
import { DELETE } from '@/app/api/goals/route'

function request(url: string): NextRequest {
  return { url, method: 'DELETE', headers: { get: () => null } } as unknown as NextRequest
}

const URL_WITH_ID = 'http://localhost/api/goals?id=goal-1'

beforeEach(() => {
  jest.clearAllMocks()
  captured.table = undefined
  captured.patch = undefined
  captured.filters = []
  nextResult = { data: [{ id: 'goal-1' }], error: null }
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
})

it('rejects an unauthenticated caller', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)

  const res = (await DELETE(request(URL_WITH_ID))) as { status: number }

  expect(res.status).toBe(401)
  expect(captured.patch).toBeUndefined()
})

it('requires an id', async () => {
  const res = (await DELETE(request('http://localhost/api/goals'))) as { status: number }

  expect(res.status).toBe(400)
  expect(captured.patch).toBeUndefined()
})

it('soft-deletes rather than removing the row', async () => {
  const res = (await DELETE(request(URL_WITH_ID))) as { status: number; body: { success?: boolean } }

  expect(res.status).toBe(200)
  expect(res.body.success).toBe(true)
  expect(captured.table).toBe('user_goals')
  expect(captured.patch).toMatchObject({ active: false })
  expect(captured.patch).toHaveProperty('updated_at')
})

it('scopes the update to the caller, so one account cannot delete another\'s goal', async () => {
  await DELETE(request(URL_WITH_ID))

  expect(captured.filters).toContainEqual(['id', 'goal-1'])
  expect(captured.filters).toContainEqual(['user_id', 'user-1'])
})

it('reports 404 when nothing matched', async () => {
  // someone else's id, or a goal already retired
  nextResult = { data: [], error: null }

  const res = (await DELETE(request(URL_WITH_ID))) as { status: number }

  expect(res.status).toBe(404)
})

it('reports 500 when the database errors', async () => {
  nextResult = { data: null, error: { message: 'connection reset' } }

  const res = (await DELETE(request(URL_WITH_ID))) as { status: number }

  expect(res.status).toBe(500)
})
