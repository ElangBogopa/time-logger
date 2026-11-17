/**
 * @jest-environment node
 *
 * What the entries routes write for times that cross midnight: sleep stays
 * one row, anything else becomes two, one on each day. The rule runs on a
 * save that moves the times and never on one that does not.
 */

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

const insert = jest.fn()
const update = jest.fn()
const remove = jest.fn()
let stored: Record<string, unknown> | null = null
let updateResult: { data: unknown; error: unknown } = { data: null, error: null }

jest.mock('@/lib/supabase-server', () => ({
  supabase: {
    from: () => ({
      // Read of the stored row (PUT).
      select: () => {
        const chain = {
          eq: () => chain,
          maybeSingle: async () => ({ data: stored, error: null }),
        }
        return chain
      },
      insert: (rows: unknown) => {
        insert(rows)
        const list = Array.isArray(rows) ? rows : [rows]
        const data = list.map((r, i) => ({ id: `new-${i}`, ...(r as object) }))
        return {
          select: () => {
            const result = Promise.resolve({ data, error: null })
            return Object.assign(result, { single: async () => ({ data: data[0], error: null }) })
          },
        }
      },
      update: (values: unknown) => {
        update(values)
        const chain = {
          eq: () => chain,
          select: () => chain,
          single: async () => updateResult,
        }
        return chain
      },
      delete: () => {
        const chain = {
          eq: (col: string, val: unknown) => {
            if (col === 'id') remove(val)
            return chain
          },
        }
        return chain
      },
    }),
  },
}))

import { getAppSession } from '@/lib/session'
import type { NextRequest } from 'next/server'
import { POST } from '@/app/api/entries/route'
import { PUT } from '@/app/api/entries/[id]/route'

const request = (body: unknown): NextRequest =>
  ({
    url: 'http://localhost/api/entries',
    method: 'POST',
    headers: { get: () => null },
    json: async () => body,
  }) as unknown as NextRequest

const params = { params: Promise.resolve({ id: 'entry-1' }) }

type Row = Record<string, unknown>
const inserted = (): Row[] => {
  const arg = insert.mock.calls[0][0]
  return Array.isArray(arg) ? arg : [arg]
}

beforeEach(() => {
  jest.clearAllMocks()
  stored = null
  updateResult = { data: { id: 'entry-1' }, error: null }
  ;(getAppSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
})

describe('POST /api/entries across midnight', () => {
  const dinner = {
    date: '2026-11-16',
    activity: 'Dinner',
    category: 'meals',
    duration_minutes: 120,
    start_time: '23:00',
    end_time: '01:00',
    commentary: 'Late one',
  }

  it('splits a dinner 23:00–01:00 into two rows and returns the first', async () => {
    const res = await POST(request(dinner))
    const rows = inserted()
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ date: '2026-11-16', start_time: '23:00', end_time: '24:00', duration_minutes: 60, category: 'meals', commentary: 'Late one' })
    expect(rows[1]).toMatchObject({ date: '2026-11-17', start_time: '00:00', end_time: '01:00', duration_minutes: 60, category: 'meals', activity: 'Dinner', commentary: 'Late one', status: 'confirmed' })
    const body = await res.json()
    expect(body.data).toMatchObject({ id: 'new-0', date: '2026-11-16' })
  })

  it('keeps a sleep 23:00–07:00 as one row of 480 minutes', async () => {
    await POST(request({ ...dinner, activity: 'Sleep', category: 'sleep', duration_minutes: 480, start_time: '23:00', end_time: '07:00' }))
    const rows = inserted()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ start_time: '23:00', end_time: '07:00', duration_minutes: 480 })
  })

  it('keeps a planned entry marked overnight_sleep as one row, and never stores the mark', async () => {
    await POST(request({ ...dinner, activity: 'Sleep', category: null, status: 'pending', start_time: '23:00', end_time: '07:00', overnight_sleep: true }))
    const rows = inserted()
    expect(rows).toHaveLength(1)
    expect(rows[0]).not.toHaveProperty('overnight_sleep')
    expect(rows[0].duration_minutes).toBe(480)
  })

  it('splits a planned entry without the mark', async () => {
    await POST(request({ ...dinner, activity: 'Sleep', category: null, status: 'pending', start_time: '23:00', end_time: '07:00' }))
    expect(inserted()).toHaveLength(2)
  })

  it('leaves an entry inside one day as one row', async () => {
    await POST(request({ ...dinner, start_time: '18:00', end_time: '19:00', duration_minutes: 60 }))
    const rows = inserted()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ start_time: '18:00', end_time: '19:00', duration_minutes: 60 })
  })

  it('stores an end of 00:00 as 24:00 without splitting', async () => {
    await POST(request({ ...dinner, start_time: '23:00', end_time: '00:00', duration_minutes: 60 }))
    const rows = inserted()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ start_time: '23:00', end_time: '24:00', duration_minutes: 60 })
  })

  it('adds one row for a batch with one crossing event', async () => {
    const res = await POST(request({
      entries: [
        { ...dinner, activity: 'Standup', category: 'meetings', start_time: '09:00', end_time: '09:30', duration_minutes: 30 },
        dinner,
      ],
    }))
    expect(inserted()).toHaveLength(3)
    const body = await res.json()
    expect(body.data).toHaveLength(3)
  })
})

describe('PUT /api/entries/[id] across midnight', () => {
  const storedRow = (over: Row = {}): Row => ({
    id: 'entry-1',
    user_id: 'user-1',
    date: '2026-11-16',
    activity: 'Dinner',
    category: 'meals',
    duration_minutes: 60,
    start_time: '19:00:00',
    end_time: '20:00:00',
    description: null,
    commentary: 'Logged',
    status: 'confirmed',
    ...over,
  })

  it('404s when the entry is not the person\'s', async () => {
    const res = await PUT(request({ category: 'meals' }), params)
    expect(res.status).toBe(404)
    expect(update).not.toHaveBeenCalled()
  })

  it('splits a meals entry whose new times cross: inserts the second piece, shortens the first', async () => {
    stored = storedRow()
    const res = await PUT(request({ start_time: '23:00', end_time: '01:00', duration_minutes: 120 }), params)
    expect(res.status).toBe(200)
    expect(inserted()).toEqual([
      expect.objectContaining({
        user_id: 'user-1',
        date: '2026-11-17',
        start_time: '00:00',
        end_time: '01:00',
        duration_minutes: 60,
        activity: 'Dinner',
        category: 'meals',
        commentary: 'Logged',
        status: 'confirmed',
      }),
    ])
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ start_time: '23:00', end_time: '24:00', duration_minutes: 60 }))
    // The insert comes before the update.
    expect(insert.mock.invocationCallOrder[0]).toBeLessThan(update.mock.invocationCallOrder[0])
  })

  it('deletes the second piece and answers 500 if the first will not update', async () => {
    stored = storedRow()
    updateResult = { data: null, error: { message: 'nope' } }
    const res = await PUT(request({ start_time: '23:00', end_time: '01:00' }), params)
    expect(res.status).toBe(500)
    expect(remove).toHaveBeenCalledWith('new-0')
  })

  it('writes just the category when only the category changes on a stored 23:00–07:00 row', async () => {
    stored = storedRow({ activity: 'Sleep', category: 'sleep', start_time: '23:00:00', end_time: '07:00:00', duration_minutes: 480 })
    await PUT(request({ category: 'rest' }), params)
    expect(insert).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith({ category: 'rest' })
  })

  it('does not run the rule when the times sent are the stored ones', async () => {
    stored = storedRow({ activity: 'Sleep', category: 'rest', start_time: '23:00:00', end_time: '07:00:00', duration_minutes: 480 })
    await PUT(request({ start_time: '23:00', end_time: '07:00', status: 'confirmed' }), params)
    expect(insert).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith({ start_time: '23:00', end_time: '07:00', status: 'confirmed' })
  })

  it('keeps a sleep whose times change as one row with the new duration', async () => {
    stored = storedRow({ activity: 'Sleep', category: 'sleep', start_time: '23:00:00', end_time: '07:00:00', duration_minutes: 480 })
    await PUT(request({ start_time: '22:30', end_time: '06:30' }), params)
    expect(insert).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ start_time: '22:30', end_time: '06:30', duration_minutes: 480 }))
  })

  it('keeps a planned entry marked overnight_sleep as one row, and never writes the mark', async () => {
    stored = storedRow({ activity: 'Sleep', category: null, status: 'pending', start_time: '22:00:00', end_time: '23:00:00' })
    await PUT(request({ start_time: '23:00', end_time: '07:00', overnight_sleep: true }), params)
    expect(insert).not.toHaveBeenCalled()
    const written = update.mock.calls[0][0]
    expect(written).not.toHaveProperty('overnight_sleep')
    expect(written).toMatchObject({ end_time: '07:00', duration_minutes: 480 })
  })
})
