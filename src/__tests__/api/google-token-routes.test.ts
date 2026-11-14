/**
 * @jest-environment node
 *
 * What the calendar and tasks routes answer when there is no Google token.
 *
 * `getGoogleAccessToken` says why there is none. The routes turn that into
 * a code, and the client turns the code into the sign-in-again banner. Only
 * a refused grant ('reconnect') may reach the banner; Google being
 * unreachable must not. Swap the two and every other check stays green.
 */

const mockGetAppSession = jest.fn()
const mockGetGoogleAccessToken = jest.fn()

jest.mock('@/lib/session', () => ({ getAppSession: () => mockGetAppSession() }))
jest.mock('@/lib/google-token', () => ({
  getGoogleAccessToken: (...args: unknown[]) => mockGetGoogleAccessToken(...args),
}))

import { NextRequest } from 'next/server'
import { GET as calendarEvents } from '@/app/api/calendar/events/route'
import { GET as googleTasks } from '@/app/api/tasks/google/route'

const routes = [
  ['calendar events', calendarEvents, 'http://localhost/api/calendar/events?start=2026-11-14&end=2026-11-14&timezone=UTC'],
  ['google tasks', googleTasks, 'http://localhost/api/tasks/google'],
] as const

beforeEach(() => {
  mockGetAppSession.mockReset()
  mockGetGoogleAccessToken.mockReset()
  mockGetAppSession.mockResolvedValue({ user: { id: '11111111-1111-4111-8111-111111111111' } })
  jest.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe.each(routes)('%s, with no Google token', (_name, GET, url) => {
  it('tells the person to sign in again when Google refused the grant', async () => {
    mockGetGoogleAccessToken.mockResolvedValue({ accessToken: null, source: null, problem: 'reconnect' })

    const response = await GET(new NextRequest(url))

    expect(response.status).toBe(401)
    expect((await response.json()).code).toBe('TOKEN_EXPIRED')
  })

  it('says Google is unavailable, and not TOKEN_EXPIRED, when it could not be reached', async () => {
    mockGetGoogleAccessToken.mockResolvedValue({ accessToken: null, source: null, problem: 'unavailable' })

    const response = await GET(new NextRequest(url))

    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('GOOGLE_UNAVAILABLE')
  })

  it('says no calendar is connected when there is no token and no problem', async () => {
    mockGetGoogleAccessToken.mockResolvedValue({ accessToken: null, source: null })

    const response = await GET(new NextRequest(url))

    expect(response.status).toBe(401)
    expect((await response.json()).code).toBe('NO_CALENDAR')
  })
})
