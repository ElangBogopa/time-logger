/**
 * @jest-environment node
 *
 * Where a Google access token comes from.
 *
 * The calendar and the tasks routes each carried their own copy of this
 * until lib/google-token.ts took both. It is now the only copy, so if it
 * is wrong the calendar is empty for everyone it is wrong for — and the
 * people it is most likely to be wrong for are the ones who linked a Google
 * account separately, whose token lives in `calendar_connections` and has
 * to be refreshed here.
 */

type Row = Record<string, unknown>

let connection: Row | null = null
const reads: { table: string; userId: unknown }[] = []
const updates: { table: string; values: Row; userId: unknown }[] = []

jest.mock('@/lib/supabase-server', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: (_column: string, userId: unknown) => ({
          single: async () => {
            reads.push({ table, userId })
            return connection
              ? { data: connection, error: null }
              : { data: null, error: { code: 'PGRST116', message: 'no rows' } }
          },
        }),
      }),
      update: (values: Row) => ({
        eq: async (_column: string, userId: unknown) => {
          updates.push({ table, values, userId })
          return { error: null }
        },
      }),
    }),
  },
}))
jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))

import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getGoogleAccessToken, getSignInGoogleTokens } from '@/lib/google-token'

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>
const request = {} as NextRequest

const ME = '11111111-1111-4111-8111-111111111111'
const viaGoogle = { user: { id: ME }, authProvider: 'google' }
const viaLink = { user: { id: ME } }

const HOUR = 60 * 60 * 1000
const past = () => new Date(Date.now() - HOUR).toISOString()
const future = () => new Date(Date.now() + HOUR).toISOString()

const fetchMock = jest.fn()
const realFetch = global.fetch
let errorSpy: jest.SpyInstance

/** What Google's token endpoint answers. */
function googleAnswers(status: number, body: Row) {
  fetchMock.mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body })
}

beforeEach(() => {
  connection = null
  reads.length = 0
  updates.length = 0
  fetchMock.mockReset()
  mockGetToken.mockReset()
  mockGetToken.mockResolvedValue(null)
  global.fetch = fetchMock as unknown as typeof fetch
  process.env.GOOGLE_CLIENT_ID = 'client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  global.fetch = realFetch
  errorSpy.mockRestore()
})

describe('getSignInGoogleTokens', () => {
  it('hands back the tokens the Google sign-in left in the session', async () => {
    mockGetToken.mockResolvedValue({ accessToken: 'jwt-access', refreshToken: 'jwt-refresh' })
    expect(await getSignInGoogleTokens(request)).toEqual({
      accessToken: 'jwt-access',
      refreshToken: 'jwt-refresh',
    })
  })

  it('answers with nothing, not an error, when the session cannot be read', async () => {
    mockGetToken.mockRejectedValue(new Error('bad cookie'))
    expect(await getSignInGoogleTokens(request)).toEqual({
      accessToken: undefined,
      refreshToken: undefined,
    })
  })
})

describe('getGoogleAccessToken — signed in with Google', () => {
  it('uses the sign-in token and does not touch the database', async () => {
    mockGetToken.mockResolvedValue({ accessToken: 'jwt-access' })
    connection = { google_access_token: 'stored', google_refresh_token: 'r', token_expires_at: future() }

    expect(await getGoogleAccessToken(request, viaGoogle)).toEqual({
      accessToken: 'jwt-access',
      source: 'session',
    })
    expect(reads).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to a linked account when the sign-in left no token', async () => {
    connection = { google_access_token: 'stored', google_refresh_token: 'r', token_expires_at: future() }

    expect(await getGoogleAccessToken(request, viaGoogle)).toEqual({
      accessToken: 'stored',
      source: 'connection',
    })
  })

  it('falls back the same way when the session cannot be read', async () => {
    mockGetToken.mockRejectedValue(new Error('bad cookie'))
    connection = { google_access_token: 'stored', google_refresh_token: 'r', token_expires_at: future() }

    expect(await getGoogleAccessToken(request, viaGoogle)).toEqual({
      accessToken: 'stored',
      source: 'connection',
    })
  })
})

describe('getGoogleAccessToken — a sign-in token that has expired', () => {
  const expiredJwt = (extra: Row = {}) => ({
    accessToken: 'jwt-stale',
    refreshToken: 'jwt-refresh',
    accessTokenExpires: Date.now() - HOUR,
    ...extra,
  })

  it('uses a token that is an hour from expiry as it is, without asking Google', async () => {
    mockGetToken.mockResolvedValue({ accessToken: 'jwt-access', accessTokenExpires: Date.now() + HOUR })

    expect(await getGoogleAccessToken(request, viaGoogle)).toEqual({
      accessToken: 'jwt-access',
      source: 'session',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renews it, without touching the database, when Google answers', async () => {
    mockGetToken.mockResolvedValue(expiredJwt())
    googleAnswers(200, { access_token: 'jwt-fresh', expires_in: 3600 })

    expect(await getGoogleAccessToken(request, viaGoogle)).toEqual({
      accessToken: 'jwt-fresh',
      source: 'session',
    })
    expect(reads).toEqual([])
    expect(updates).toEqual([])
  })

  it('says to reconnect when Google refuses and nothing is linked', async () => {
    mockGetToken.mockResolvedValue(expiredJwt())
    googleAnswers(400, { error: 'invalid_grant' })

    expect(await getGoogleAccessToken(request, viaGoogle)).toEqual({
      accessToken: null,
      source: null,
      problem: 'reconnect',
    })
  })

  it('says Google is unavailable when it cannot be reached and nothing is linked', async () => {
    mockGetToken.mockResolvedValue(expiredJwt())
    fetchMock.mockRejectedValue(new Error('network down'))

    expect(await getGoogleAccessToken(request, viaGoogle)).toEqual({
      accessToken: null,
      source: null,
      problem: 'unavailable',
    })
  })

  it('says to reconnect, without asking Google, when the sign-in has no refresh token', async () => {
    mockGetToken.mockResolvedValue(expiredJwt({ refreshToken: undefined }))

    expect(await getGoogleAccessToken(request, viaGoogle)).toEqual({
      accessToken: null,
      source: null,
      problem: 'reconnect',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses a good linked account when the sign-in token cannot be renewed', async () => {
    mockGetToken.mockResolvedValue(expiredJwt())
    googleAnswers(400, { error: 'invalid_grant' })
    connection = { google_access_token: 'stored', google_refresh_token: 'r', token_expires_at: future() }

    expect(await getGoogleAccessToken(request, viaGoogle)).toEqual({
      accessToken: 'stored',
      source: 'connection',
    })
  })
})

describe('getGoogleAccessToken — a Google account linked separately', () => {
  it('ignores a token in the session when the sign-in was not Google', async () => {
    mockGetToken.mockResolvedValue({ accessToken: 'jwt-access' })
    connection = { google_access_token: 'stored', google_refresh_token: 'r', token_expires_at: future() }

    expect(await getGoogleAccessToken(request, viaLink)).toEqual({
      accessToken: 'stored',
      source: 'connection',
    })
    expect(mockGetToken).not.toHaveBeenCalled()
  })

  it('has no token when nothing is linked', async () => {
    expect(await getGoogleAccessToken(request, viaLink)).toEqual({ accessToken: null, source: null })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('has no token, and asks nobody, when the session carries no id', async () => {
    connection = { google_access_token: 'stored', google_refresh_token: 'r', token_expires_at: future() }

    expect(await getGoogleAccessToken(request, { user: { id: '' } })).toEqual({
      accessToken: null,
      source: null,
    })
    expect(reads).toEqual([])
  })

  it("reads this person's connection and no one else's", async () => {
    connection = { google_access_token: 'stored', google_refresh_token: 'r', token_expires_at: future() }
    await getGoogleAccessToken(request, viaLink)
    expect(reads).toEqual([{ table: 'calendar_connections', userId: ME }])
  })

  it('uses the stored token while it is still good, without asking Google', async () => {
    connection = { google_access_token: 'stored', google_refresh_token: 'r', token_expires_at: future() }

    expect(await getGoogleAccessToken(request, viaLink)).toEqual({
      accessToken: 'stored',
      source: 'connection',
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(updates).toEqual([])
  })

  it('treats a token with no expiry recorded as still good', async () => {
    connection = { google_access_token: 'stored', google_refresh_token: 'r', token_expires_at: null }

    expect((await getGoogleAccessToken(request, viaLink)).accessToken).toBe('stored')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refreshes an expired token, returns the new one and stores it for this person', async () => {
    connection = { google_access_token: 'stale', google_refresh_token: 'refresh-1', token_expires_at: past() }
    googleAnswers(200, { access_token: 'fresh', expires_in: 3600 })
    const before = Date.now()

    expect(await getGoogleAccessToken(request, viaLink)).toEqual({
      accessToken: 'fresh',
      source: 'connection',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    expect(init.method).toBe('POST')
    const sent = init.body as URLSearchParams
    expect(sent.get('grant_type')).toBe('refresh_token')
    expect(sent.get('refresh_token')).toBe('refresh-1')
    expect(sent.get('client_id')).toBe('client-id')
    expect(sent.get('client_secret')).toBe('client-secret')

    expect(updates).toHaveLength(1)
    expect(updates[0].table).toBe('calendar_connections')
    expect(updates[0].userId).toBe(ME)
    expect(updates[0].values.google_access_token).toBe('fresh')
    const expires = new Date(updates[0].values.token_expires_at as string).getTime()
    expect(expires).toBeGreaterThanOrEqual(before + 3600 * 1000)
    expect(expires).toBeLessThanOrEqual(Date.now() + 3600 * 1000)
  })

  it('stores no expiry when Google does not give one', async () => {
    connection = { google_access_token: 'stale', google_refresh_token: 'refresh-1', token_expires_at: past() }
    googleAnswers(200, { access_token: 'fresh' })

    await getGoogleAccessToken(request, viaLink)
    expect(updates[0].values).toEqual({ google_access_token: 'fresh', token_expires_at: null })
  })

  it('has no token, says to reconnect, and stores nothing, when Google refuses the refresh', async () => {
    connection = { google_access_token: 'stale', google_refresh_token: 'revoked', token_expires_at: past() }
    googleAnswers(400, { error: 'invalid_grant' })

    expect(await getGoogleAccessToken(request, viaLink)).toEqual({
      accessToken: null,
      source: null,
      problem: 'reconnect',
    })
    expect(updates).toEqual([])
  })

  it('has no token, says Google is unavailable, and stores nothing, when Google cannot be reached', async () => {
    connection = { google_access_token: 'stale', google_refresh_token: 'refresh-1', token_expires_at: past() }
    fetchMock.mockRejectedValue(new Error('network down'))

    expect(await getGoogleAccessToken(request, viaLink)).toEqual({
      accessToken: null,
      source: null,
      problem: 'unavailable',
    })
    expect(updates).toEqual([])
  })

  it('says to reconnect, without asking Google, when expired with no refresh token', async () => {
    connection = { google_access_token: 'stale', google_refresh_token: null, token_expires_at: past() }

    expect(await getGoogleAccessToken(request, viaLink)).toEqual({
      accessToken: null,
      source: null,
      problem: 'reconnect',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never writes a token to the log when a refresh fails', async () => {
    connection = { google_access_token: 'stale', google_refresh_token: 'refresh-secret', token_expires_at: past() }
    googleAnswers(400, { error: 'invalid_grant', access_token: undefined })

    await getGoogleAccessToken(request, viaLink)
    const logged = JSON.stringify(errorSpy.mock.calls)
    expect(logged).toContain('invalid_grant')
    expect(logged).not.toContain('refresh-secret')
    expect(logged).not.toContain('stale')
    expect(logged).not.toContain('client-secret')
  })
})
