/**
 * DELETE /api/session-completions
 *
 * Undo for "Nothing to log". It removes one row, scoped by the signed-in id,
 * and only a skipped one: a session wrapped up with "Done" must survive it.
 */

let nextResult: { error: unknown } = { error: null }
const captured: { table?: string; deleted: boolean; filters: [string, unknown][] } = { deleted: false, filters: [] }

function makeBuilder(table: string) {
  captured.table = table
  const b = {
    delete() { captured.deleted = true; return b },
    eq(column: string, value: unknown) {
      captured.filters.push([column, value])
      return captured.filters.length >= 4 ? Promise.resolve(nextResult) : b
    },
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
jest.mock('@/lib/session', () => ({ getAppSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/supabase-server', () => ({ supabase: { from: (t: string) => makeBuilder(t) } }))

import { getAppSession } from '@/lib/session'
import type { NextRequest } from 'next/server'
import { DELETE } from '@/app/api/session-completions/route'

function request(url: string): NextRequest {
  return { url, method: 'DELETE', headers: { get: () => null } } as unknown as NextRequest
}

const GOOD = 'http://localhost/api/session-completions?date=2026-11-03&period=evening'

beforeEach(() => {
  jest.clearAllMocks()
  captured.table = undefined
  captured.deleted = false
  captured.filters = []
  nextResult = { error: null }
  jest.spyOn(console, 'error').mockImplementation(() => {})
  ;(getAppSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
})

it('rejects an unauthenticated caller', async () => {
  ;(getAppSession as jest.Mock).mockResolvedValue(null)
  const res = (await DELETE(request(GOOD))) as { status: number }
  expect(res.status).toBe(401)
  expect(captured.deleted).toBe(false)
})

it('rejects a bad date', async () => {
  const res = (await DELETE(request('http://localhost/api/session-completions?date=11-03&period=evening'))) as { status: number }
  expect(res.status).toBe(400)
  expect(captured.deleted).toBe(false)
})

it('rejects a bad period', async () => {
  const res = (await DELETE(request('http://localhost/api/session-completions?date=2026-11-03&period=night'))) as { status: number }
  expect(res.status).toBe(400)
  expect(captured.deleted).toBe(false)
})

it('filters by user, date, period and skipped = true', async () => {
  const res = (await DELETE(request(GOOD))) as { status: number; body: { success?: boolean } }
  expect(res.status).toBe(200)
  expect(res.body.success).toBe(true)
  expect(captured.table).toBe('session_completions')
  expect(captured.filters).toEqual([
    ['user_id', 'user-1'],
    ['date', '2026-11-03'],
    ['period', 'evening'],
    ['skipped', true],
  ])
})

it('answers 500 on a database error', async () => {
  nextResult = { error: { message: 'boom' } }
  const res = (await DELETE(request(GOOD))) as { status: number; body: { error?: string } }
  expect(res.status).toBe(500)
  expect(res.body.error).toBe('Failed to undo')
})
