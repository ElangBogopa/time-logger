/**
 * How an account is recognised as set up. The flag is what counts; a saved
 * goal is the fallback for accounts set up before the flag was written.
 */

import { renderHook, waitFor } from '@testing-library/react'
import { invalidateGoals } from '@/lib/goals'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { useDashboardState } from '@/hooks/useDashboardState'

const session = { user: { id: 'u1' } } as never

type Setup = { preferences: Record<string, unknown>; goals?: { id: string }[]; goalsStatus?: number }
let requested: string[] = []

const mockFetch = ({ preferences, goals = [], goalsStatus = 200 }: Setup) => {
  requested = []
  global.fetch = jest.fn(async (url: string) => {
    requested.push(String(url))
    if (String(url).startsWith('/api/preferences')) return { ok: true, status: 200, json: async () => ({ preferences }) }
    if (String(url).startsWith('/api/goals'))
      return { ok: goalsStatus === 200, status: goalsStatus, json: async () => ({ goals }) }
    return { ok: true, status: 200, json: async () => ({}) }
  }) as unknown as typeof fetch
}

const run = async () => {
  const { result } = renderHook(() => useDashboardState({ session, status: 'authenticated' } as never))
  await waitFor(() => expect(result.current.hasCheckedTargets).toBe(true))
  return result.current
}

beforeEach(() => {
  invalidateGoals()
})

it('is set up when the flag is set, without asking for goals', async () => {
  mockFetch({ preferences: { productivity_target: 80 } })
  const state = await run()
  expect(state.showOnboarding).toBe(false)
  expect(requested.some((u) => u.startsWith('/api/goals'))).toBe(false)
})

it('shows setup to a brand-new account: no flag, no goals', async () => {
  mockFetch({ preferences: {} })
  expect((await run()).showOnboarding).toBe(true)
})

it('recognises an older account: no flag, one saved goal', async () => {
  mockFetch({ preferences: {}, goals: [{ id: 'g1' }] })
  expect((await run()).showOnboarding).toBe(false)
})

it('does not send a set-up account back through setup when the goal lookup fails', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  mockFetch({ preferences: {}, goalsStatus: 500 })
  expect((await run()).showOnboarding).toBe(false)
  spy.mockRestore()
})
