/**
 * Everything the app holds about one person, in one list.
 *
 * Two things read it: the export, which hands a person their data, and
 * delete-account, which removes it. They share the list on purpose. A table
 * added to the app and forgotten here would be missing from the file someone
 * downloads — and, worse, would survive the deletion they were told was
 * complete. `account-data.test.ts` fails when the code reads a table this
 * list does not know.
 *
 * Server-only: it uses the service-role client.
 */

import { supabase } from './supabase-server'

export interface AccountTable {
  table: string
  /**
   * How the owner column is typed. A `uuid` column rejects an id that is not
   * one — an old sign-in cookie can carry a Google account id instead — so
   * those tables are skipped for such an id rather than asked and failed.
   */
  ownerType: 'text' | 'uuid'
  /** The key it goes under in an export and the columns that go; null when nothing of it belongs in a file. */
  export: { as: string; columns: string } | null
}

/** In the order they are deleted: what points at something goes before the thing it points at. */
export const ACCOUNT_TABLES: AccountTable[] = [
  { table: 'time_entries', ownerType: 'text', export: { as: 'entries', columns: '*' } },
  { table: 'commentary_replies', ownerType: 'text', export: { as: 'commentaryReplies', columns: '*' } },
  { table: 'daily_plans', ownerType: 'text', export: { as: 'plans', columns: '*' } },
  { table: 'user_goals', ownerType: 'text', export: { as: 'goals', columns: '*' } },
  { table: 'day_reviews', ownerType: 'text', export: { as: 'dayReviews', columns: '*' } },
  { table: 'session_completions', ownerType: 'text', export: { as: 'sessionCompletions', columns: '*' } },
  { table: 'mood_checkins', ownerType: 'text', export: { as: 'moodCheckins', columns: '*' } },
  { table: 'feedback', ownerType: 'text', export: { as: 'feedback', columns: '*' } },
  { table: 'weekly_targets', ownerType: 'text', export: { as: 'weeklyTargets', columns: '*' } },
  { table: 'user_streaks', ownerType: 'text', export: { as: 'streaks', columns: '*' } },
  { table: 'user_intentions', ownerType: 'text', export: { as: 'intentions', columns: '*' } },
  { table: 'user_preferences', ownerType: 'text', export: { as: 'preferences', columns: '*' } },
  // Named columns only: the row also holds Google access tokens.
  { table: 'calendar_connections', ownerType: 'uuid', export: { as: 'calendarConnections', columns: 'google_email, connected_at' } },
  { table: 'pending_calendar_connections', ownerType: 'uuid', export: null },
  { table: 'push_subscriptions', ownerType: 'uuid', export: null },
]

/**
 * Tables that are deleted by something other than a `user_id`, and so are
 * handled by name below rather than through the list.
 */
export const ACCOUNT_TABLES_BY_OTHER_KEY = ['users', 'verification_tokens']

/** What an export says it left out, so the file does not pretend to be more than it is. */
const NOT_INCLUDED = [
  'The access tokens for a connected Google account. They are secrets, and they are deleted with your account.',
  'The keys your devices use to receive notifications.',
  'Things kept only on a device, such as a wake time you set there and tasks you skipped.',
]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PAGE = 1000
/** A stop for a runaway loop, far past any real log: 200,000 rows. */
const MAX_PAGES = 200

type DbError = { code?: string; message?: string } | null

/**
 * The repository's migrations and the live database are not guaranteed to
 * hold the same tables — some here were retired, some may never have been
 * applied. A table that is not there has nothing of anyone's in it.
 */
function isMissingTable(error: DbError): boolean {
  return error?.code === 'PGRST205' || error?.code === '42P01'
}

function skips(table: AccountTable, userId: string): boolean {
  return table.ownerType === 'uuid' && !UUID.test(userId)
}

type Row = Record<string, unknown>

/** Every row of a table that belongs to this person. Supabase hands back a thousand at a time. */
async function allRows(table: string, columns: string, ownerColumn: string, userId: string): Promise<Row[]> {
  const rows: Row[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq(ownerColumn, userId)
      .order('id', { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (error) {
      if (isMissingTable(error)) return []
      // An export that quietly leaves a table out is worse than one that fails.
      throw new Error(`Could not read ${table}: ${error.message ?? error.code ?? 'unknown error'}`)
    }
    const batch = (data ?? []) as unknown as Row[]
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return columns === '*' ? rows : rows.map((row) => only(row, columns))
}

/**
 * Keep the named columns and nothing else. The query already asked for only
 * these; this is the same promise made a second time, here, so that whether
 * a token or a password hash reaches someone's export never rests on what a
 * database layer chose to send back.
 */
function only(row: Row, columns: string): Row {
  const out: Row = {}
  for (const column of columns.split(',').map((name) => name.trim())) {
    if (column in row) out[column] = row[column]
  }
  return out
}

/** The file is already one person's; it does not need their id on every row. */
function withoutOwner(rows: Row[]): Row[] {
  return rows.map((row) => {
    const rest = { ...row }
    delete rest.user_id
    return rest
  })
}

export interface AccountExport {
  exportedAt: string
  /** Bumped if the shape of this file ever changes. */
  version: 1
  account: Row | null
  notIncluded: string[]
  [section: string]: unknown
}

/** Everything held about this person, as one object. */
export async function collectAccountData(userId: string): Promise<AccountExport> {
  const result: AccountExport = {
    exportedAt: new Date().toISOString(),
    version: 1,
    account: null,
    notIncluded: NOT_INCLUDED,
  }

  if (UUID.test(userId)) {
    const account = await allRows('users', 'email, preferred_name, auth_provider, created_at', 'id', userId)
    result.account = account[0] ?? null
  }

  for (const table of ACCOUNT_TABLES) {
    if (!table.export) continue
    result[table.export.as] = skips(table, userId)
      ? []
      : withoutOwner(await allRows(table.table, table.export.columns, 'user_id', userId))
  }

  return result
}

const CSV_COLUMNS = ['date', 'start_time', 'end_time', 'duration_minutes', 'activity', 'category', 'status', 'description', 'commentary']

/**
 * One cell. Quoted when it must be, and never allowed to open with a
 * character a spreadsheet would run as a formula: an activity called
 * "=HYPERLINK(…)" is text, and should still be text in Excel.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** The log as a spreadsheet: one row per entry, oldest first. */
export function entriesToCsv(entries: Row[]): string {
  const sorted = [...entries].sort((a, b) =>
    `${a.date ?? ''} ${a.start_time ?? ''}`.localeCompare(`${b.date ?? ''} ${b.start_time ?? ''}`)
  )
  const lines = [CSV_COLUMNS.join(',')]
  for (const entry of sorted) lines.push(CSV_COLUMNS.map((column) => csvCell(entry[column])).join(','))
  return lines.join('\r\n') + '\r\n'
}

export interface DeleteAccountResult {
  ok: boolean
  /** Tables that could not be cleared. Empty when `ok`. */
  failed: string[]
}

/**
 * Remove everything held about this person.
 *
 * There is no transaction to wrap this in from here, so the order does the
 * work a transaction would: the data first, and the account row last and
 * only if everything before it went. A failure part-way therefore leaves an
 * account that still exists and can simply ask again — never an orphaned
 * log with nobody able to sign in and remove it. Every step is a delete by
 * owner, so asking twice is harmless.
 */
export async function deleteAccountData(userId: string, email: string | null): Promise<DeleteAccountResult> {
  const failed: string[] = []

  for (const table of ACCOUNT_TABLES) {
    if (skips(table, userId)) continue
    const { error } = await supabase.from(table.table).delete().eq('user_id', userId)
    if (error && !isMissingTable(error)) {
      console.error(`[Account] Could not clear ${table.table}:`, error.message ?? error.code)
      failed.push(table.table)
    }
  }

  if (email) {
    const { error } = await supabase.from('verification_tokens').delete().eq('identifier', email.toLowerCase())
    if (error && !isMissingTable(error)) {
      console.error('[Account] Could not clear verification_tokens:', error.message ?? error.code)
      failed.push('verification_tokens')
    }
  }

  if (failed.length > 0) return { ok: false, failed }

  // The account itself. An id that is not a uuid is a Google account id
  // from an old sign-in cookie; the row, if there is one, is found by that.
  const { error } = UUID.test(userId)
    ? await supabase.from('users').delete().eq('id', userId)
    : await supabase.from('users').delete().eq('google_id', userId)
  if (error && !isMissingTable(error)) {
    console.error('[Account] Could not remove the account row:', error.message ?? error.code)
    return { ok: false, failed: ['users'] }
  }

  return { ok: true, failed: [] }
}

/** The Google token saved for someone who connected a calendar after signing in another way. */
export async function storedGoogleToken(userId: string): Promise<string | null> {
  if (!UUID.test(userId)) return null
  const { data, error } = await supabase
    .from('calendar_connections')
    .select('google_refresh_token')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return (data as { google_refresh_token?: string | null }).google_refresh_token ?? null
}

/**
 * Hand back the access Google gave the app.
 *
 * The app only ever reads from Google; this is the one call that is not a
 * read, and it changes nothing of the person's — it ends the app's own
 * permission. Deleting an account while keeping a live grant to someone's
 * calendar would be a strange kind of leaving. Revoking either token of a
 * grant revokes the grant, so the first that succeeds is enough.
 *
 * Returns true if Google confirmed it, false if it could not be confirmed,
 * and null when there was nothing to revoke.
 */
export async function revokeGoogleAccess(tokens: (string | null | undefined)[]): Promise<boolean | null> {
  const held = [...new Set(tokens.filter((token): token is string => !!token))]
  if (held.length === 0) return null

  for (const token of held) {
    try {
      const response = await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
        signal: AbortSignal.timeout(5000),
      })
      if (response.ok) return true
    } catch {
      /* try the next token; the caller is told if none worked */
    }
  }
  return false
}
