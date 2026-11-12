/**
 * @jest-environment node
 *
 * Export and delete-account.
 *
 * The privacy page used to say neither was built and to ask through Send
 * Feedback. Both now exist, and both are the kind of thing that must be
 * right the first time someone uses them: an export that leaks a token or
 * leaves a table out, or a deletion that removes the wrong account, half an
 * account, or an account while leaving its log behind.
 *
 * The database here is a small in-memory stand-in with two people in it, so
 * every test can check what happened to the person who did not ask.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

type Row = Record<string, unknown>
type DbError = { code: string; message: string }

const ME = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

let db: Record<string, Row[]> = {}
/** Tables that answer every request with this error. */
let broken: Record<string, DbError> = {}
/** A database layer that ignores the column list and returns everything. */
let sendsWholeRows = false
const deletesIn: string[] = []

function makeBuilder(table: string) {
  let op: 'select' | 'delete' = 'select'
  let columns = '*'
  const filters: [string, unknown][] = []
  let range: [number, number] | null = null
  let single = false

  const run = () => {
    if (broken[table]) return { data: null, error: broken[table] }
    if (!(table in db)) return { data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${table}'` } }
    const matches = (row: Row) => filters.every(([column, value]) => row[column] === value)
    if (op === 'delete') {
      deletesIn.push(table)
      db[table] = db[table].filter((row) => !matches(row))
      return { data: null, error: null }
    }
    let rows = db[table].filter(matches)
    if (range) rows = rows.slice(range[0], range[1] + 1)
    if (columns !== '*' && !sendsWholeRows) {
      const keep = columns.split(',').map((c) => c.trim())
      rows = rows.map((row) => Object.fromEntries(keep.map((key) => [key, row[key]])))
    }
    return single ? { data: rows[0] ?? null, error: null } : { data: rows, error: null }
  }

  const builder = {
    select(cols = '*') { columns = cols; return builder },
    delete() { op = 'delete'; return builder },
    eq(column: string, value: unknown) { filters.push([column, value]); return builder },
    order() { return builder },
    range(from: number, to: number) { range = [from, to]; return builder },
    maybeSingle() { single = true; return builder },
    then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve(run()).then(resolve, reject)
    },
  }
  return builder
}

jest.mock('next/server', () => {
  class FakeResponse {
    status: number
    headers: Record<string, string>
    cookies = { set: jest.fn() }
    constructor(public body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
      this.status = init.status ?? 200
      this.headers = init.headers ?? {}
    }
    async json() { return this.body }
    static json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
      return new FakeResponse(body, init)
    }
  }
  return { NextRequest: class {}, NextResponse: FakeResponse }
})
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/supabase-server', () => ({ supabase: { from: (table: string) => makeBuilder(table) } }))
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ success: true, remaining: 4, resetTime: 0 })),
  getRateLimitHeaders: () => ({}),
  RATE_LIMITS: { auth: { limit: 5, windowMs: 60000 } },
}))

import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { ACCOUNT_TABLES, ACCOUNT_TABLES_BY_OTHER_KEY, entriesToCsv } from '@/lib/account-data'
import { DELETE_CONFIRMATION } from '@/lib/account-shared'
import { DELETE } from '@/app/api/account/route'
import { GET as EXPORT } from '@/app/api/account/export/route'

type FakeResponse = {
  status: number
  body: unknown
  headers: Record<string, string>
  cookies: { set: jest.Mock }
  json: () => Promise<Record<string, unknown>>
}

function request({
  url = 'http://localhost/api/account',
  body,
  cookies = [],
}: { url?: string; body?: unknown; cookies?: string[] } = {}): NextRequest {
  return {
    url,
    method: 'DELETE',
    headers: { get: () => null },
    json: async () => {
      if (body === undefined) throw new Error('no body')
      return body
    },
    cookies: { getAll: () => cookies.map((name) => ({ name, value: 'x' })) },
  } as unknown as NextRequest
}

const confirmed = (extra: { cookies?: string[] } = {}) => request({ body: { confirm: DELETE_CONFIRMATION }, ...extra })

const entry = (owner: string, id: string, extra: Row = {}): Row => ({
  id,
  user_id: owner,
  date: '2026-11-10',
  activity: 'Write the pricing doc',
  category: 'deep_work',
  duration_minutes: 90,
  start_time: '09:00:00',
  end_time: '10:30:00',
  description: null,
  commentary: 'Solid.',
  status: 'confirmed',
  ...extra,
})

const fetchMock = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  deletesIn.length = 0
  broken = {}
  sendsWholeRows = false
  // Every table the app knows, each holding something of two people.
  db = Object.fromEntries(
    ACCOUNT_TABLES.map(({ table }) => [
      table,
      [
        { id: `${table}-mine`, user_id: ME },
        { id: `${table}-theirs`, user_id: OTHER },
      ],
    ])
  )
  // The tables that hold secrets, holding some.
  for (const table of ['calendar_connections', 'pending_calendar_connections']) {
    Object.assign(db[table][0], { google_refresh_token: 'stored-refresh', google_access_token: 'stored-access', google_email: 'me@example.com', connected_at: '2026-10-01' })
  }
  Object.assign(db.push_subscriptions[0], { endpoint: 'https://push.example/abc', p256dh: 'device-key', auth: 'device-secret' })
  db.time_entries = [entry(ME, 'e1'), entry(ME, 'e2', { date: '2026-11-09' }), entry(OTHER, 'e3')]
  db.users = [
    { id: ME, email: 'me@example.com', preferred_name: 'Me', auth_provider: 'google', google_id: 'g-me', password_hash: 'never-export-this', created_at: '2026-09-01' },
    { id: OTHER, email: 'other@example.com', preferred_name: 'Other', auth_provider: 'google', google_id: 'g-other', created_at: '2026-09-02' },
  ]
  db.verification_tokens = [
    { identifier: 'me@example.com', token: 't1' },
    { identifier: 'other@example.com', token: 't2' },
  ]
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: ME, email: 'Me@Example.com' } })
  ;(getToken as jest.Mock).mockResolvedValue({ refreshToken: 'jwt-refresh', accessToken: 'jwt-access' })
  ;(checkRateLimit as jest.Mock).mockReturnValue({ success: true, remaining: 4, resetTime: 0 })
  fetchMock.mockResolvedValue({ ok: true })
  global.fetch = fetchMock as unknown as typeof fetch
})

const rowsOf = (owner: string) =>
  Object.entries(db).flatMap(([table, rows]) =>
    rows.filter((row) => row.user_id === owner || row.id === owner).map(() => table)
  )

describe('the list of tables', () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path)
      return /\.(ts|tsx)$/.test(name) ? [path] : []
    })
  }

  it('knows every table the app reads or writes', () => {
    const used = new Set<string>()
    for (const file of sourceFiles(join(process.cwd(), 'src'))) {
      for (const match of readFileSync(file, 'utf8').matchAll(/\.from\(\s*['"`]([a-z_]+)['"`]\s*\)/g)) used.add(match[1])
    }
    const known = new Set([...ACCOUNT_TABLES.map((t) => t.table), ...ACCOUNT_TABLES_BY_OTHER_KEY])

    // A table here that is not in lib/account-data.ts would be left out of
    // exports and would survive a deleted account. Add it to ACCOUNT_TABLES.
    expect([...used].filter((table) => !known.has(table))).toEqual([])
    expect(used.size).toBeGreaterThan(8)
  })

  it('never exports a whole row from a table that holds secrets', () => {
    for (const table of ['calendar_connections', 'pending_calendar_connections', 'push_subscriptions']) {
      const listed = ACCOUNT_TABLES.find((t) => t.table === table)
      expect(listed).toBeDefined()
      expect(listed?.export?.columns ?? '').not.toBe('*')
      expect(listed?.export?.columns ?? '').not.toMatch(/token|p256dh|auth/)
    }
  })
})

describe('DELETE /api/account', () => {
  it('rejects a caller who is not signed in, and deletes nothing', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const res = (await DELETE(confirmed())) as unknown as FakeResponse

    expect(res.status).toBe(401)
    expect(deletesIn).toEqual([])
  })

  it.each([
    ['no body at all', undefined],
    ['an empty body', {}],
    ['the wrong words', { confirm: 'yes' }],
    ['a truthy flag', { confirm: true }],
  ])('refuses %s, and deletes nothing', async (_name, body) => {
    const res = (await DELETE(request({ body }))) as unknown as FakeResponse

    expect(res.status).toBe(400)
    expect(deletesIn).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is rate limited', async () => {
    ;(checkRateLimit as jest.Mock).mockReturnValue({ success: false, remaining: 0, resetTime: 0 })

    const res = (await DELETE(confirmed())) as unknown as FakeResponse

    expect(res.status).toBe(429)
    expect(deletesIn).toEqual([])
  })

  it('removes everything of the person who asked, and nothing of anyone else', async () => {
    const before = rowsOf(OTHER)

    const res = (await DELETE(confirmed())) as unknown as FakeResponse

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ deleted: true })
    expect(rowsOf(ME)).toEqual([])
    expect(db.verification_tokens).toEqual([{ identifier: 'other@example.com', token: 't2' }])
    expect(rowsOf(OTHER)).toEqual(before)
    expect(before.length).toBe(ACCOUNT_TABLES.length + 1) // a row in every table, and the account
  })

  it('takes the account from the session and ignores an id in the request', async () => {
    const res = (await DELETE(
      request({
        url: `http://localhost/api/account?userId=${OTHER}&id=${OTHER}`,
        body: { confirm: DELETE_CONFIRMATION, userId: OTHER, id: OTHER, user_id: OTHER },
      })
    )) as unknown as FakeResponse

    expect(res.status).toBe(200)
    expect(db.users.map((user) => user.id)).toEqual([OTHER])
    expect(db.time_entries.map((row) => row.id)).toEqual(['e3'])
  })

  it('removes the account row last', async () => {
    await DELETE(confirmed())

    expect(deletesIn[deletesIn.length - 1]).toBe('users')
    expect(deletesIn.indexOf('daily_plans')).toBeLessThan(deletesIn.indexOf('user_goals'))
    expect(deletesIn.indexOf('user_streaks')).toBeLessThan(deletesIn.indexOf('user_intentions'))
  })

  it('keeps the account when part of the data would not go, so the person can ask again', async () => {
    broken.day_reviews = { code: '57014', message: 'statement timeout' }
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {})

    const res = (await DELETE(confirmed({ cookies: ['next-auth.session-token'] }))) as unknown as FakeResponse

    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ failed: ['day_reviews'] })
    expect(db.users.map((user) => user.id)).toContain(ME)
    // Still signed in, and still connected to Google.
    expect(res.cookies.set).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()

    // Asking again, once the table answers, finishes the job.
    broken = {}
    const again = (await DELETE(confirmed())) as unknown as FakeResponse
    expect(again.status).toBe(200)
    expect(rowsOf(ME)).toEqual([])
    quiet.mockRestore()
  })

  it('treats a table the database does not have as already empty', async () => {
    delete db.user_intentions
    delete db.weekly_targets
    delete db.verification_tokens

    const res = (await DELETE(confirmed())) as unknown as FakeResponse

    expect(res.status).toBe(200)
    expect(rowsOf(ME)).toEqual([])
  })

  it('hands back the Google access once the account is gone', async () => {
    const res = (await DELETE(confirmed())) as unknown as FakeResponse

    expect(await res.json()).toMatchObject({ googleAccessRevoked: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/revoke')
    expect(init.method).toBe('POST')
    expect(String(init.body)).toBe('token=jwt-refresh')
  })

  it('tries the next token when Google refuses one, and says so when none works', async () => {
    fetchMock.mockResolvedValue({ ok: false })

    const res = (await DELETE(confirmed())) as unknown as FakeResponse

    // The account is gone either way; the answer just cannot claim the revoke.
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ deleted: true, googleAccessRevoked: false })
    expect(fetchMock.mock.calls.map(([, init]) => String(init.body))).toEqual([
      'token=jwt-refresh',
      'token=stored-refresh',
      'token=jwt-access',
    ])
  })

  it('does not fail the deletion when Google cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))

    const res = (await DELETE(confirmed())) as unknown as FakeResponse

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ deleted: true, googleAccessRevoked: false })
    expect(rowsOf(ME)).toEqual([])
  })

  it('reports nothing to revoke when no Google token was held', async () => {
    ;(getToken as jest.Mock).mockResolvedValue(null)
    db.calendar_connections = []

    const res = (await DELETE(confirmed())) as unknown as FakeResponse

    expect(await res.json()).toMatchObject({ deleted: true, googleAccessRevoked: null })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ends the session, so nothing can be written under an id that no longer exists', async () => {
    const res = (await DELETE(
      confirmed({
        cookies: ['__Secure-next-auth.session-token.0', '__Secure-next-auth.session-token.1', 'csrf-token', 'theme'],
      })
    )) as unknown as FakeResponse

    const cleared = res.cookies.set.mock.calls.map(([name, value, options]) => [name, value, options.maxAge, options.secure])
    expect(cleared).toEqual([
      ['__Secure-next-auth.session-token.0', '', 0, true],
      ['__Secure-next-auth.session-token.1', '', 0, true],
    ])
  })

  it('handles an old sign-in whose id is a Google account id, not a uuid', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'g-me', email: 'me@example.com' } })
    db.time_entries.push(entry('g-me', 'legacy'))

    const res = (await DELETE(confirmed())) as unknown as FakeResponse

    expect(res.status).toBe(200)
    expect(db.time_entries.map((row) => row.id)).toEqual(['e1', 'e2', 'e3'])
    // The uuid-keyed tables are not asked with an id they would reject…
    expect(deletesIn).not.toContain('calendar_connections')
    expect(deletesIn).not.toContain('push_subscriptions')
    // …and the account row is found by the Google id instead.
    expect(db.users.map((user) => user.id)).toEqual([OTHER])
  })
})

describe('GET /api/account/export', () => {
  const exportRequest = (query = '') =>
    ({ url: `http://localhost/api/account/export${query}`, method: 'GET', headers: { get: () => null } }) as unknown as NextRequest

  it('rejects a caller who is not signed in', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const res = (await EXPORT(exportRequest())) as unknown as FakeResponse

    expect(res.status).toBe(401)
  })

  it('gives the person everything of theirs, and nothing of anyone else', async () => {
    const res = (await EXPORT(exportRequest())) as unknown as FakeResponse
    const file = JSON.parse(res.body as string)

    expect(res.status).toBe(200)
    expect(res.headers['Content-Disposition']).toMatch(/^attachment; filename="better-export\.json"$/)
    expect(res.headers['Cache-Control']).toBe('no-store')
    expect(file.version).toBe(1)
    expect(file.account).toEqual({ email: 'me@example.com', preferred_name: 'Me', auth_provider: 'google', created_at: '2026-09-01' })
    expect(file.entries.map((row: Row) => row.id)).toEqual(['e1', 'e2'])
    for (const table of ACCOUNT_TABLES) {
      if (!table.export) continue
      expect(file[table.export.as]).toHaveLength(table.table === 'time_entries' ? 2 : 1)
    }
    expect(res.body as string).not.toContain(OTHER)
    expect(res.body as string).not.toContain('other@example.com')
  })

  it('never puts a secret in the file, and says what it left out', async () => {
    const res = (await EXPORT(exportRequest())) as unknown as FakeResponse
    const text = res.body as string
    const file = JSON.parse(text)

    for (const secret of ['stored-refresh', 'stored-access', 'jwt-refresh', 'never-export-this', 'google_refresh_token', 'password_hash', 'device-key', 'device-secret', 'push.example']) {
      expect(text).not.toContain(secret)
    }
    expect(file.calendarConnections).toEqual([{ google_email: 'me@example.com', connected_at: '2026-10-01' }])
    expect(file.notIncluded.join(' ')).toMatch(/tokens/)
  })

  it('keeps secrets out even if the database sends back more columns than were asked for', async () => {
    sendsWholeRows = true

    const res = (await EXPORT(exportRequest())) as unknown as FakeResponse
    const text = res.body as string

    for (const secret of ['stored-refresh', 'stored-access', 'never-export-this', 'g-me']) expect(text).not.toContain(secret)
    expect(JSON.parse(text).account).toEqual({ email: 'me@example.com', preferred_name: 'Me', auth_provider: 'google', created_at: '2026-09-01' })
  })

  it('reads a long log all the way through, a thousand rows at a time', async () => {
    db.time_entries = Array.from({ length: 2350 }, (_, i) => entry(ME, `e${i}`))

    const res = (await EXPORT(exportRequest())) as unknown as FakeResponse

    expect(JSON.parse(res.body as string).entries).toHaveLength(2350)
  })

  it('fails outright rather than hand over a file with a table missing from it', async () => {
    broken.daily_plans = { code: '57014', message: 'statement timeout' }
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {})

    const res = (await EXPORT(exportRequest())) as unknown as FakeResponse

    expect(res.status).toBe(500)
    quiet.mockRestore()
  })

  it('gives the log alone as a spreadsheet, oldest first', async () => {
    const res = (await EXPORT(exportRequest('?format=csv'))) as unknown as FakeResponse
    const lines = (res.body as string).trim().split('\r\n')

    expect(res.headers['Content-Type']).toMatch(/^text\/csv/)
    expect(lines[0]).toBe('date,start_time,end_time,duration_minutes,activity,category,status,description,commentary')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toMatch(/^2026-11-09,/)
    expect(lines[2]).toBe('2026-11-10,09:00:00,10:30:00,90,Write the pricing doc,deep_work,confirmed,,Solid.')
  })
})

describe('entriesToCsv', () => {
  it('quotes what needs quoting', () => {
    const csv = entriesToCsv([{ date: '2026-11-10', activity: 'Lunch, with "Thabo"', description: 'two\nlines' }])
    expect(csv).toContain('"Lunch, with ""Thabo"""')
    expect(csv).toContain('"two\nlines"')
  })

  it('does not let an activity run as a formula in a spreadsheet', () => {
    const csv = entriesToCsv([
      { date: '2026-11-10', activity: '=HYPERLINK("http://example.com","x")' },
      { date: '2026-11-11', activity: '+1 hour of reading' },
      { date: '2026-11-12', activity: '@home' },
    ])
    const cells = csv.trim().split('\r\n').slice(1)
    expect(cells[0]).toContain(`"'=HYPERLINK(""http://example.com"",""x"")"`)
    expect(cells[1]).toContain(`'+1 hour of reading`)
    expect(cells[2]).toContain(`'@home`)
  })

  it('leaves a number alone, even a negative one', () => {
    expect(entriesToCsv([{ date: '2026-11-10', duration_minutes: -5, activity: 'x' }])).toContain(',-5,x,')
  })
})
