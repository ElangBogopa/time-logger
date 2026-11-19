/**
 * The log the day review reads, and the button that adds a slot to the plan.
 *
 * useLogRange shows a cached range at once and refreshes behind it; it never
 * shows another range's rows while a new one loads; and a log that cannot be
 * loaded is "failed", not an empty day. useReadAction keeps the plan a first
 * tap made when timing it failed, so a second tap does not add another.
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { csrfFetch, fetchEntries } from '@/lib/api'
import { useLogRange } from '@/hooks/useLogRange'
import { useReadAction } from '@/hooks/useReadAction'
import type { ReviewRead } from '@/lib/review-read'

jest.mock('@/lib/api', () => ({ csrfFetch: jest.fn(), fetchEntries: jest.fn() }))
const stableRouter = { push: jest.fn() }
jest.mock('next/navigation', () => ({ useRouter: () => stableRouter }))
const NO_EVENTS: never[] = []
jest.mock('@/contexts/CalendarContext', () => ({ useCalendar: () => ({ getEventsForDate: () => NO_EVENTS }) }))
jest.mock('sonner', () => ({ toast: { error: jest.fn() } }))

const row = (date: string, activity = 'Essay') => ({
  id: `${date}-${activity}`,
  date,
  activity,
  category: 'deep_work',
  start_time: '09:00',
  end_time: '10:00',
  duration_minutes: 60,
  status: 'confirmed',
})

beforeEach(() => {
  jest.clearAllMocks()
  window.sessionStorage.clear()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('useLogRange', () => {
  it('shows the cached range at once, then the refreshed one', async () => {
    window.sessionStorage.setItem(
      'log-range:2026-10-01:2026-10-29',
      JSON.stringify({ rows: [{ date: '2026-10-29', activity: 'Old', category: 'deep_work', start_time: null, end_time: null, duration_minutes: 30 }] })
    )
    ;(fetchEntries as jest.Mock).mockResolvedValue([row('2026-10-29', 'New')])
    const { result } = renderHook(() => useLogRange('2026-10-01', '2026-10-29'))

    expect(result.current.loaded).toBe(true)
    expect(result.current.rows.map((r) => r.activity)).toEqual(['Old'])
    await waitFor(() => expect(result.current.rows.map((r) => r.activity)).toEqual(['New']))
    expect(JSON.parse(window.sessionStorage.getItem('log-range:2026-10-01:2026-10-29') as string).rows).toHaveLength(1)
  })

  it('never shows the last range while the next one loads', async () => {
    ;(fetchEntries as jest.Mock).mockResolvedValueOnce([row('2026-10-29', 'First')])
    const { result, rerender } = renderHook(({ from, to }) => useLogRange(from, to), {
      initialProps: { from: '2026-10-01', to: '2026-10-29' },
    })
    await waitFor(() => expect(result.current.rows.map((r) => r.activity)).toEqual(['First']))

    let release: (rows: unknown[]) => void = () => {}
    ;(fetchEntries as jest.Mock).mockReturnValueOnce(new Promise((resolve) => (release = resolve)))
    rerender({ from: '2026-10-02', to: '2026-10-30' })
    expect(result.current).toEqual({ rows: [], loaded: false, failed: false })

    await act(async () => release([row('2026-10-30', 'Second')]))
    expect(result.current.rows.map((r) => r.activity)).toEqual(['Second'])
  })

  it('says failed, not an empty day, when nothing loads and nothing is cached', async () => {
    ;(fetchEntries as jest.Mock).mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useLogRange('2026-10-01', '2026-10-29'))
    await waitFor(() => expect(result.current.failed).toBe(true))
    expect(result.current.loaded).toBe(false)
    expect(result.current.rows).toEqual([])
  })

  it('keeps the cached range when the refresh fails', async () => {
    window.sessionStorage.setItem(
      'log-range:2026-10-01:2026-10-29',
      JSON.stringify({ rows: [{ date: '2026-10-29', activity: 'Old', category: 'deep_work', start_time: null, end_time: null, duration_minutes: 30 }] })
    )
    ;(fetchEntries as jest.Mock).mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useLogRange('2026-10-01', '2026-10-29'))
    await waitFor(() => expect(fetchEntries).toHaveBeenCalled())
    await act(async () => {})
    expect(result.current.failed).toBe(false)
    expect(result.current.rows.map((r) => r.activity)).toEqual(['Old'])
  })
})

describe('useReadAction', () => {
  const read: ReviewRead = {
    scope: 'day',
    kind: 'change',
    rule: 'change-focus-outside-window',
    facts: [],
    evidence: [],
    slot: { title: 'Essay draft', startTime: '09:00', durationMinutes: 60 },
    timing: true,
  }

  const calls = () => (csrfFetch as jest.Mock).mock.calls.map(([, init]) => init.method)

  beforeEach(() => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ plans: [] }) })) as unknown as typeof fetch
  })

  it('reads the plan from the cache at once', async () => {
    const { getUserToday } = jest.requireActual('@/lib/types')
    window.sessionStorage.setItem(
      `read-action-plans:${getUserToday()}`,
      JSON.stringify({ plans: [{ id: 'p0', title: 'Essay draft', committed_start: null, committed_end: null }] })
    )
    const { result } = renderHook(() => useReadAction(read, { reviewDate: getUserToday() }, false))
    expect(result.current.action).not.toBeNull()
  })

  it('does not add a second plan when timing the first failed', async () => {
    let patches = 0
    ;(csrfFetch as jest.Mock).mockImplementation(async (_url: string, init: { method: string }) => {
      if (init.method === 'POST') return { ok: true, json: async () => ({ plan: { id: 'p1' } }) }
      patches += 1
      return { ok: patches > 1, json: async () => ({}) }
    })
    const { result } = renderHook(() => useReadAction(read, { reviewDate: jest.requireActual('@/lib/types').getUserToday() }, false))
    expect(result.current.action?.slot).toBeTruthy()

    await act(async () => result.current.run())
    expect(calls()).toEqual(['POST', 'PATCH'])
    expect(stableRouter.push).not.toHaveBeenCalled()

    await act(async () => result.current.run())
    expect(calls()).toEqual(['POST', 'PATCH', 'PATCH']) // no second POST
    expect(stableRouter.push).toHaveBeenCalledTimes(1)
  })
})
