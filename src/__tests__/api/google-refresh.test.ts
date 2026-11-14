/**
 * @jest-environment node
 *
 * Asking Google for a new access token.
 *
 * What matters is the line between "refused" (Google says the grant is dead,
 * so the person must sign in again) and "unavailable" (anything else, so a
 * quiet retry later may work). A banner telling someone to sign in again
 * because of a network blip is the bug this separation ends.
 */

import { refreshGoogleAccessToken } from '@/lib/google-refresh'

const fetchMock = jest.fn()
const realFetch = global.fetch
let errorSpy: jest.SpyInstance

function googleAnswers(status: number, body: unknown) {
  fetchMock.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock as unknown as typeof fetch
  process.env.GOOGLE_CLIENT_ID = 'client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  global.fetch = realFetch
  errorSpy.mockRestore()
})

describe('refreshGoogleAccessToken', () => {
  it('returns the new token, about an hour of life, and the new refresh token when sent', async () => {
    googleAnswers(200, { access_token: 'fresh', expires_in: 3600, refresh_token: 'refresh-2' })
    const before = Date.now()

    const result = await refreshGoogleAccessToken('refresh-1')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.accessToken).toBe('fresh')
    expect(result.refreshToken).toBe('refresh-2')
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000)
    expect(result.expiresAt).toBeLessThanOrEqual(Date.now() + 3600 * 1000)
  })

  it('sends the grant exactly as Google expects it', async () => {
    googleAnswers(200, { access_token: 'fresh', expires_in: 3600 })

    await refreshGoogleAccessToken('refresh-1')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    const sent = init.body as URLSearchParams
    expect(sent.get('grant_type')).toBe('refresh_token')
    expect(sent.get('refresh_token')).toBe('refresh-1')
    expect(sent.get('client_id')).toBe('client-id')
    expect(sent.get('client_secret')).toBe('client-secret')
  })

  it('has no expiry, and no new refresh token, when Google gives neither', async () => {
    googleAnswers(200, { access_token: 'fresh' })

    expect(await refreshGoogleAccessToken('refresh-1')).toEqual({
      ok: true,
      accessToken: 'fresh',
      expiresAt: null,
      refreshToken: undefined,
    })
  })

  it('is refused when Google says invalid_grant', async () => {
    googleAnswers(400, { error: 'invalid_grant' })
    expect(await refreshGoogleAccessToken('refresh-1')).toEqual({ ok: false, reason: 'refused' })
  })

  it.each([
    ['invalid_client', 400, { error: 'invalid_client' }],
    ['a 500', 500, { error: 'backend_error' }],
    ['a 429', 429, { error: 'rate_limit_exceeded' }],
    ['a 200 without an access token', 200, { expires_in: 3600 }],
    ['a body that is not JSON', 502, null],
  ])('is unavailable on %s', async (_name, status, body) => {
    if (body === null) {
      fetchMock.mockResolvedValue({
        ok: false,
        status,
        json: async () => {
          throw new SyntaxError('Unexpected token <')
        },
      })
    } else {
      googleAnswers(status, body)
    }

    expect(await refreshGoogleAccessToken('refresh-1')).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('is unavailable when the request itself fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    expect(await refreshGoogleAccessToken('refresh-1')).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('never logs the refresh token or the client secret', async () => {
    googleAnswers(400, { error: 'invalid_grant' })
    await refreshGoogleAccessToken('refresh-secret')
    fetchMock.mockRejectedValue(new Error('network down'))
    await refreshGoogleAccessToken('refresh-secret')

    const logged = JSON.stringify(errorSpy.mock.calls)
    expect(logged).toContain('invalid_grant')
    expect(logged).not.toContain('refresh-secret')
    expect(logged).not.toContain('client-secret')
  })
})
