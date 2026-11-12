/**
 * @jest-environment node
 *
 * A deleted account, and the other device that is still signed in to it.
 *
 * Sessions here are signed cookies. Deleting the account on a phone clears
 * the phone's cookie, but a laptop's is still valid and still names the id —
 * so the laptop would carry on logging under an account that no sign-in can
 * ever reach again, and nothing could delete what it wrote. When a session
 * comes up for its hourly renewal the sign-in code now asks whether the
 * account still exists, and ends the session if it clearly does not.
 *
 * "Clearly" is most of what is tested: this must never sign out someone
 * whose account is there.
 */

let lookup: { data: unknown; error: unknown } | Error = { data: { id: 'x' }, error: null }
const lookups: string[] = []

jest.mock('@/lib/supabase-server', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: (_column: string, id: string) => ({
          maybeSingle: async () => {
            lookups.push(id)
            if (lookup instanceof Error) throw lookup
            return lookup
          },
        }),
      }),
    }),
  },
}))
jest.mock('@/lib/auth-adapter', () => ({ SupabaseAdapter: () => ({}) }))

import { authOptions } from '@/lib/auth'

const ID = '11111111-1111-4111-8111-111111111111'
const HOUR = 60 * 60 * 1000

type Token = Record<string, unknown>
const jwt = (token: Token) =>
  (authOptions.callbacks!.jwt as unknown as (args: { token: Token }) => Promise<Token>)({ token })
const session = (token: Token) =>
  (authOptions.callbacks!.session as unknown as (args: { session: { user: Token; error?: string }; token: Token }) => Promise<{ user: Token; error?: string }>)({
    session: { user: { email: 'me@example.com' } },
    token,
  })

const tokenDue = (extra: Token = {}): Token => ({
  id: ID,
  sub: 'google-sub-123',
  authProvider: 'google',
  accessToken: 'old-access',
  refreshToken: 'refresh',
  accessTokenExpires: Date.now() - HOUR,
  ...extra,
})

const fetchMock = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  lookups.length = 0
  lookup = { data: { id: ID }, error: null }
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ access_token: 'new-access', expires_in: 3600 }) })
  global.fetch = fetchMock as unknown as typeof fetch
  jest.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => jest.restoreAllMocks())

describe('a session that is not yet due for renewal', () => {
  it('is left alone, and costs no lookup', async () => {
    const token = tokenDue({ accessTokenExpires: Date.now() + HOUR })

    expect(await jwt(token)).toBe(token)
    expect(lookups).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('a session due for renewal', () => {
  it('renews as before when the account is there', async () => {
    const result = await jwt(tokenDue())

    expect(lookups).toEqual([ID])
    expect(result.accessToken).toBe('new-access')
    expect(result.error).toBeUndefined()
  })

  it('ends, without asking Google for anything, when the account is gone', async () => {
    lookup = { data: null, error: null }

    const result = await jwt(tokenDue())

    expect(result.error).toBe('AccountDeleted')
    expect(result.accessToken).toBeUndefined()
    expect(result.refreshToken).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['the lookup returns an error', { data: null, error: { code: '57014', message: 'timeout' } }],
    ['the lookup throws', new Error('network down')],
  ])('keeps the person signed in when %s', async (_name, answer) => {
    lookup = answer as typeof lookup

    const result = await jwt(tokenDue())

    expect(result.error).toBeUndefined()
    expect(result.accessToken).toBe('new-access')
  })

  it('does not ask about an id that is not one of ours', async () => {
    lookup = { data: null, error: null }

    const result = await jwt(tokenDue({ id: 'google-sub-123' }))

    expect(lookups).toEqual([])
    expect(result.error).toBeUndefined()
  })

  it('stays ended once ended', async () => {
    const ended = tokenDue({ error: 'AccountDeleted', accessToken: undefined, refreshToken: undefined })

    expect(await jwt(ended)).toBe(ended)
    expect(lookups).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('what the rest of the app sees', () => {
  it('an ordinary session carries its id', async () => {
    const result = await session(tokenDue())

    expect(result.user.id).toBe(ID)
    expect(result.error).toBeUndefined()
  })

  it('a deleted account carries no id at all — not even the Google one it would fall back to', async () => {
    const result = await session(tokenDue({ error: 'AccountDeleted' }))

    expect(result.user.id).toBe('')
    expect(result.error).toBe('AccountDeleted')
  })
})
