import { renderHook, waitFor } from '@testing-library/react'
import type { SessionCompletion } from '@/lib/types'

const mockFetchCompletions = jest.fn()
jest.mock('@/lib/api', () => ({
  fetchEntries: jest.fn().mockResolvedValue([]),
  fetchSessionCompletions: (...a: unknown[]) => mockFetchCompletions(...a),
}))

import {
  useSessionData,
  getCachedCompletions,
  setCachedCompletion,
  removeCachedCompletion,
  setCachedEntries,
} from '@/hooks/useSessionData'

function completion(period: SessionCompletion['period'], skipped: boolean, date: string): SessionCompletion {
  return {
    id: period, user_id: 'u1', date, period,
    completed_at: '2099-01-01T20:00:00Z', entry_count: 0, total_minutes: 0, skipped,
  }
}

describe('session cache: completions', () => {
  it('ignores a write for a date whose completions were never fetched', () => {
    const date = '2099-03-04'
    setCachedEntries(date, [])
    setCachedCompletion(date, completion('evening', true, date))
    expect(getCachedCompletions(date)).toBeNull()
    removeCachedCompletion(date, 'evening')
    expect(getCachedCompletions(date)).toBeNull()
  })

  it('hands an answer to Today, and takes it back on undo, without a flash', async () => {
    const date = '2099-03-05'
    mockFetchCompletions.mockResolvedValue([completion('morning', false, date)])
    const first = renderHook(() => useSessionData({ userId: 'u1', today: date, currentHour: 22 }))
    await waitFor(() => expect(first.result.current.isLoading).toBe(false))
    first.unmount()

    setCachedCompletion(date, completion('evening', true, date))
    expect(getCachedCompletions(date)?.map(c => c.period).sort()).toEqual(['evening', 'morning'])

    // Today mounts again: the answer is there on the first render, no spinner.
    mockFetchCompletions.mockReturnValue(new Promise(() => {}))
    const again = renderHook(() => useSessionData({ userId: 'u1', today: date, currentHour: 22 }))
    expect(again.result.current.isLoading).toBe(false)
    expect(again.result.current.completions.find(c => c.period === 'evening')?.skipped).toBe(true)
    again.unmount()

    // Replacing the same period does not duplicate it.
    setCachedCompletion(date, completion('evening', false, date))
    expect(getCachedCompletions(date)?.filter(c => c.period === 'evening')).toHaveLength(1)

    removeCachedCompletion(date, 'evening')
    expect(getCachedCompletions(date)?.map(c => c.period)).toEqual(['morning'])
  })
})
