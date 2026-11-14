/**
 * @jest-environment node
 *
 * The hourly reminders job, and the test button.
 *
 * Reminders were built in January and never reached anyone. Three separate
 * things were each enough to stop them: the job required a flag nothing in
 * the app ever set, it was scheduled once a day when it only works hourly,
 * and it asked "have they logged today?" about the server's date rather
 * than the person's. Each has a test here, by name.
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

type Row = Record<string, unknown>

let db: Record<string, Row[]> = {}
let broken: string[] = []

function makeBuilder(table: string) {
  let op: 'select' | 'delete' = 'select'
  const filters: ((row: Row) => boolean)[] = []
  const run = () => {
    if (broken.includes(table)) return { data: null, error: { message: 'boom' } }
    const rows = db[table] ?? []
    const matching = rows.filter((row) => filters.every((filter) => filter(row)))
    if (op === 'delete') {
      db[table] = rows.filter((row) => !matching.includes(row))
      return { data: null, error: null }
    }
    return { data: matching, error: null }
  }
  const builder = {
    select() { return builder },
    delete() { op = 'delete'; return builder },
    eq(column: string, value: unknown) { filters.push((row) => row[column] === value); return builder },
    in(column: string, values: unknown[]) { filters.push((row) => values.includes(row[column])); return builder },
    then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve(run()).then(resolve, reject)
    },
  }
  return builder
}

jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init: { status?: number } = {}) => ({ body, status: init.status ?? 200, json: async () => body }),
  },
}))
jest.mock('@/lib/session', () => ({ getAppSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/supabase-server', () => ({ supabase: { from: (table: string) => makeBuilder(table) } }))
jest.mock('@/lib/push-server', () => ({ pushConfigured: jest.fn(() => true), sendPush: jest.fn(async () => 'sent') }))
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ success: true, remaining: 4, resetTime: 0 })),
  getRateLimitHeaders: () => ({}),
  RATE_LIMITS: { auth: { limit: 5, windowMs: 60000 } },
}))

import { getAppSession } from '@/lib/session'
import type { NextRequest } from 'next/server'
import { pushConfigured, sendPush } from '@/lib/push-server'
import { GET } from '@/app/api/cron/reminders/route'
import { POST as TEST } from '@/app/api/push/test/route'

type Res = { status: number; body: Record<string, unknown> }

const SECRET = 'test-cron-secret'
const call = (authorization: string | null = `Bearer ${SECRET}`) =>
  GET({ headers: { get: (name: string) => (name === 'authorization' ? authorization : null) } } as unknown as NextRequest) as unknown as Promise<Res>

const TORONTO = 'user-toronto'
const LONDON = 'user-london'
const device = (userId: string, id = `${userId}-phone`): Row => ({ id, user_id: userId, endpoint: `https://push.example/${id}`, p256dh: 'k', auth: 'a' })
const prefs = (userId: string, timezone: string | null, extra: Row = {}): Row => ({
  user_id: userId,
  timezone,
  reminder_enabled: false, // as it is for every real account: nothing ever set it
  reminder_times: [
    { id: 'midday', label: 'Midday check-in', time: '12:00', enabled: true },
    { id: 'evening', label: 'Evening check-in', time: '18:00', enabled: true },
    { id: 'night', label: 'Night check-in', time: '21:00', enabled: true },
  ],
  ...extra,
})
const sentTo = () => (sendPush as jest.Mock).mock.calls.map(([sub, payload]) => `${sub.user_id}: ${payload.title}`)

/** Noon in Toronto in November (17:05 UTC), which is five past five in London. */
const TORONTO_NOON = new Date('2026-11-12T17:05:00Z')
/** Nine in the evening in Toronto — already the 13th in UTC. */
const TORONTO_NINE_PM = new Date('2026-11-13T02:05:00Z')

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers().setSystemTime(TORONTO_NOON)
  process.env.CRON_SECRET = SECRET
  broken = []
  db = {
    push_subscriptions: [device(TORONTO), device(LONDON)],
    user_preferences: [prefs(TORONTO, 'America/Toronto'), prefs(LONDON, 'Europe/London')],
    time_entries: [],
    session_completions: [],
  }
  ;(pushConfigured as jest.Mock).mockReturnValue(true)
  ;(sendPush as jest.Mock).mockResolvedValue('sent')
  jest.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('who may call it', () => {
  it.each([
    ['no header', null],
    ['the wrong secret', 'Bearer nope'],
    ['the secret without Bearer', SECRET],
  ])('refuses %s, and sends nothing', async (_name, header) => {
    expect((await call(header)).status).toBe(401)
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('refuses everyone when the server has no secret, rather than accepting "Bearer undefined"', async () => {
    delete process.env.CRON_SECRET
    expect((await call('Bearer undefined')).status).toBe(401)
  })

  it('says so when the server has no notification keys', async () => {
    ;(pushConfigured as jest.Mock).mockReturnValue(false)
    expect((await call()).status).toBe(503)
  })
})

describe('who is reminded', () => {
  it('reminds the person whose clock says noon, and not the one whose clock says five', async () => {
    const res = await call()

    expect(res.status).toBe(200)
    expect(sentTo()).toEqual([`${TORONTO}: Log your morning`])
    expect((sendPush as jest.Mock).mock.calls[0][1]).toMatchObject({ url: '/log/morning', tag: 'reminder-morning' })
  })

  it('reminds someone who has a device subscribed, whatever reminder_enabled says', async () => {
    // The old job asked for reminder_enabled = true. Nothing ever set it,
    // so for most of a year this list was empty.
    expect(db.user_preferences.every((row) => row.reminder_enabled === false)).toBe(true)
    await call()
    expect(sentTo()).toHaveLength(1)
  })

  it('reminds nobody who has no device subscribed', async () => {
    db.push_subscriptions = []
    const res = await call()

    expect(res.body).toMatchObject({ success: true, subscribers: 0, sent: 0 })
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('sends to every device the person has', async () => {
    db.push_subscriptions.push(device(TORONTO, 'toronto-laptop'))
    const res = await call()

    expect(sendPush).toHaveBeenCalledTimes(2)
    expect(res.body).toMatchObject({ subscribers: 2, due: 1, sent: 2 })
  })

  it('uses the usual three times for someone with no preferences saved', async () => {
    db.user_preferences = []
    jest.setSystemTime(new Date('2026-11-12T18:05:00Z')) // six in the evening, UTC
    await call()

    expect(sentTo()).toEqual([`${TORONTO}: Log your afternoon`, `${LONDON}: Log your afternoon`])
  })

  it('respects a reminder switched off, and one moved to another hour', async () => {
    db.user_preferences = [
      prefs(TORONTO, 'America/Toronto', {
        reminder_times: [
          { id: 'midday', label: 'x', time: '12:00', enabled: false },
          { id: 'evening', label: 'x', time: '18:00', enabled: true },
          { id: 'night', label: 'x', time: '21:00', enabled: true },
        ],
      }),
      prefs(LONDON, 'Europe/London', {
        reminder_times: [{ id: 'evening', label: 'x', time: '17:00', enabled: true }],
      }),
    ]
    await call()

    expect(sentTo()).toEqual([`${LONDON}: Log your afternoon`])
  })

  it('sends each of the three in its own hour across a day, and nothing in the other twenty-one', async () => {
    db.push_subscriptions = [device(TORONTO)]
    const seen: string[] = []
    for (let hour = 0; hour < 24; hour++) {
      ;(sendPush as jest.Mock).mockClear()
      jest.setSystemTime(new Date(Date.UTC(2026, 10, 12, hour, 5)))
      await call()
      for (const [, payload] of (sendPush as jest.Mock).mock.calls) seen.push(`${hour}Z ${payload.title}`)
    }

    // Toronto is five hours behind UTC in November.
    expect(seen).toEqual(['2Z Log your evening', '17Z Log your morning', '23Z Log your afternoon'])
  })
})

describe('not reminding someone to do what they have done', () => {
  it('skips the morning reminder when the morning is logged', async () => {
    db.time_entries = [{ user_id: TORONTO, date: '2026-11-12', start_time: '09:00:00', status: 'confirmed' }]
    const res = await call()

    expect(sendPush).not.toHaveBeenCalled()
    expect(res.body).toMatchObject({ due: 1, alreadyLogged: 1, sent: 0 })
  })

  it('skips it when the session was wrapped up without entries', async () => {
    db.session_completions = [{ user_id: TORONTO, date: '2026-11-12', period: 'morning' }]
    await call()
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('still reminds when what was logged is someone else’s, another day’s, or only planned', async () => {
    db.time_entries = [
      { user_id: LONDON, date: '2026-11-12', start_time: '09:00:00', status: 'confirmed' },
      { user_id: TORONTO, date: '2026-11-11', start_time: '09:00:00', status: 'confirmed' },
      { user_id: TORONTO, date: '2026-11-12', start_time: '09:00:00', status: 'pending' },
    ]
    await call()
    expect(sentTo()).toEqual([`${TORONTO}: Log your morning`])
  })

  it('asks about the person’s own date: nine in the evening in Toronto is tomorrow in UTC', async () => {
    jest.setSystemTime(TORONTO_NINE_PM)
    // Logged this evening, on the 12th where they are. The old job looked
    // for entries dated the 13th, found none, and nagged.
    db.time_entries = [{ user_id: TORONTO, date: '2026-11-12', start_time: '19:30:00', status: 'confirmed' }]
    await call()
    expect(sendPush).not.toHaveBeenCalled()

    db.time_entries = []
    await call()
    expect(sentTo()).toEqual([`${TORONTO}: Log your evening`])
  })

  it('sends anyway if it cannot find out', async () => {
    broken = ['time_entries', 'session_completions']
    await call()
    expect(sentTo()).toEqual([`${TORONTO}: Log your morning`])
  })
})

describe('what happens to a send', () => {
  it('forgets a device the browser has dropped, and keeps the rest', async () => {
    ;(sendPush as jest.Mock).mockResolvedValue('gone')
    const res = await call()

    expect(res.body).toMatchObject({ sent: 0, removed: 1 })
    expect(db.push_subscriptions.map((row) => row.user_id)).toEqual([LONDON])
  })

  it('keeps a device after a failure that might pass', async () => {
    ;(sendPush as jest.Mock).mockResolvedValue('failed')
    const res = await call()

    expect(res.body).toMatchObject({ sent: 0, failed: 1, removed: 0 })
    expect(db.push_subscriptions).toHaveLength(2)
  })

  it('answers with counts and never with who: the caller’s log is public', async () => {
    const res = await call()
    const text = JSON.stringify(res.body)

    expect(res.body).toEqual({ success: true, subscribers: 2, due: 1, alreadyLogged: 0, sent: 1, failed: 0, removed: 0 })
    expect(text).not.toContain(TORONTO)
    expect(text).not.toContain('push.example')
  })

  it('fails loudly when it cannot read who is subscribed', async () => {
    broken = ['push_subscriptions']
    jest.spyOn(console, 'error').mockImplementation(() => {})
    expect((await call()).status).toBe(500)
  })
})

describe('the schedule', () => {
  const root = process.cwd()
  const workflow = readFileSync(join(root, '.github/workflows/reminders.yml'), 'utf8')

  it('runs every hour: a job that matches people by their local hour reaches nobody on a daily one', () => {
    expect(workflow).toMatch(/cron: '\d+ \* \* \* \*'/)
    expect(workflow).toContain('/api/cron/reminders')
    expect(workflow).toContain('Authorization: Bearer $CRON_SECRET')
  })

  it('prints the status and not the answer, because the repository is public', () => {
    expect(workflow).toContain('-o /dev/null')
    expect(workflow).not.toMatch(/--fail-with-body|cat .*response|-v\b/)
  })

  it('is the only thing that calls the job: a second daily schedule would send that hour twice', () => {
    const vercel = join(root, 'vercel.json')
    const crons = existsSync(vercel) ? (JSON.parse(readFileSync(vercel, 'utf8')).crons ?? []) : []
    expect(crons).toEqual([])
  })
})

describe('POST /api/push/test', () => {
  beforeEach(() => {
    ;(getAppSession as jest.Mock).mockResolvedValue({ user: { id: TORONTO } })
  })
  const test = () => TEST() as unknown as Promise<Res>

  it('rejects a caller who is not signed in', async () => {
    ;(getAppSession as jest.Mock).mockResolvedValue(null)
    expect((await test()).status).toBe(401)
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('sends one notification to the caller’s own devices and nobody else’s', async () => {
    const res = await test()

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ sent: 1 })
    expect((sendPush as jest.Mock).mock.calls.map(([sub]) => sub.user_id)).toEqual([TORONTO])
    expect((sendPush as jest.Mock).mock.calls[0][1]).toMatchObject({ title: 'Reminders are on' })
  })

  it('says reminders are not on when the account has no device', async () => {
    db.push_subscriptions = [device(LONDON)]
    const res = await test()

    expect(res.status).toBe(409)
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('says the server is not set up when the keys are missing', async () => {
    ;(pushConfigured as jest.Mock).mockReturnValue(false)
    expect((await test()).status).toBe(503)
  })

  it('does not claim success when nothing was delivered, and drops a dead device', async () => {
    ;(sendPush as jest.Mock).mockResolvedValue('gone')
    const res = await test()

    expect(res.status).toBe(502)
    expect(String(res.body.error)).toMatch(/off and on again/)
    expect(db.push_subscriptions.map((row) => row.user_id)).toEqual([LONDON])
  })
})
