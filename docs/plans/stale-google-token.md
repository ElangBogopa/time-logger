# Stop using an expired Google token, and stop the false "session has expired" banner

> **BUILT - do not run again.** Built in `a5312f3` (2026-11-14). It stays as the record of what was asked.

Planned 2026-11-14 on `dev` at `1ecba5e`.

## Goal

The app must never hand Google a token it already knows has expired. Today
it does, in three places, and each one ends in the banner "Your Google
session has expired" — often when a quiet retry would have worked. After
this change the banner appears only when Google has actually refused the
person's grant and signing in again is the only cure.

## What is wrong today (read this before the steps)

1. **Signed in with Google, cookie older than an hour.**
   `getSignInGoogleTokens` in `src/lib/google-token.ts` reads the access
   token straight out of the sign-in cookie with `getToken`. It never looks
   at `accessTokenExpires`. The cookie is only rewritten when the browser
   calls `/api/auth/session` (on load and on window focus); a route handler
   calling `getAppSession()` renews the token in memory but cannot write
   the cookie (NextAuth 4.24, `getServerSession` in the App Router has a
   no-op `setCookie`). So on opening the app after an hour away,
   `/api/calendar/events` can run with the old cookie, send Google a dead
   token, and answer `TOKEN_EXPIRED`.
2. **A linked account whose refresh failed.** In `getGoogleAccessToken`,
   when `refreshConnectionToken` returns `null` the code falls through to
   `return { accessToken: connection.google_access_token, ... }` — the
   expired token. Review 1 logged this as
   `dead-token-after-failed-refresh`.
3. **Any failed refresh is treated as "expired".** `refreshAccessToken` in
   `src/lib/auth.ts` sets `error: 'RefreshAccessTokenError'` for every
   failure, including a network blip, and `GoogleReauthBanner` shows on it.
4. **The banner never clears itself.** `googleTokenExpired` in
   `src/contexts/CalendarContext.tsx` is set to `true` on a failure and
   nothing sets it back, so one bad request shows the banner until reload.

## Files

- **`src/lib/google-refresh.ts`** (new) — the one function that asks Google
  for a new access token. No `next-auth` import, no database.
- **`src/lib/google-token.ts`** — check expiry on the sign-in token and
  renew it here when it is due; never return an expired token on either
  path; say *why* there is no token.
- **`src/lib/auth.ts`** — `refreshAccessToken` uses the new function and
  only sets `RefreshAccessTokenError` when Google refused.
- **`src/app/api/calendar/events/route.ts`** and
  **`src/app/api/tasks/google/route.ts`** — map the new "why" onto a
  response code.
- **`src/contexts/CalendarContext.tsx`** — clear `googleTokenExpired` on a
  successful fetch.
- **`src/__tests__/api/google-refresh.test.ts`** (new),
  **`src/__tests__/api/google-token.test.ts`**,
  **`src/__tests__/auth-deleted-account.test.ts`**,
  **`src/__tests__/calendar-cache-persistence.test.tsx`** — tests, below.
- **`CLAUDE.md`** — one sentence, step 7.

## Steps

### 1. `src/lib/google-refresh.ts`

```ts
export type GoogleRefreshResult =
  | { ok: true; accessToken: string; expiresAt: number | null; refreshToken?: string }
  | { ok: false; reason: 'refused' | 'unavailable' }

export async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleRefreshResult>
```

- POST to `https://oauth2.googleapis.com/token` with exactly the body both
  existing copies send (`client_id`, `client_secret`,
  `grant_type: 'refresh_token'`, `refresh_token`) as `URLSearchParams`, and
  the `Content-Type: application/x-www-form-urlencoded` header.
- Parse the body with `await response.json().catch(() => null)`.
- `response.ok` and a string `access_token` → `ok: true`, with
  `expiresAt = expires_in ? Date.now() + expires_in * 1000 : null` and
  `refreshToken` = the body's `refresh_token` if present.
- Body's `error === 'invalid_grant'` → `{ ok: false, reason: 'refused' }`.
  This is the only "refused". It means the refresh token is dead for good.
- Everything else — fetch threw, 5xx, 429, `invalid_client`, a 200 with no
  `access_token` → `{ ok: false, reason: 'unavailable' }`.
- On failure log once with `console.error('[Google token] Refresh failed:', body?.error ?? response.status)`
  or `console.error('[Google token] Refresh threw:', error)`. Never log a
  token, the refresh token or the client secret.
- Header comment in the house style: what it is for, and why "refused" is
  kept narrow (telling someone to sign in again when Google was merely
  unreachable is the bug this file exists to end).

### 2. `src/lib/google-token.ts`

- Delete `refreshConnectionToken`'s own `fetch`; it calls
  `refreshGoogleAccessToken` and, on `ok`, stores
  `{ google_access_token, token_expires_at }` exactly as it does now
  (`token_expires_at` is the ISO string of `expiresAt`, or `null`).
- Add to the `GoogleAccessToken` interface:
  ```ts
  /** Why there is no token although a Google account is connected.
   *  'reconnect': Google refused the grant; only signing in again fixes it.
   *  'unavailable': Google could not be reached; trying later may work. */
  problem?: 'reconnect' | 'unavailable'
  ```
  Leave `problem` off the object entirely when there is none (existing
  tests compare with `toEqual({ accessToken, source })`).
- `getSignInGoogleTokens` keeps its signature and return shape — the
  account-deletion route and the status route depend on it. Add a private
  helper that returns the decoded JWT (`getToken({ req }).catch(() => null)`)
  and build both functions on it.
- New order inside `getGoogleAccessToken`:
  1. If `session.authProvider === 'google'` and the JWT has an
     `accessToken`:
     - **Still good** when `accessTokenExpires` is missing or `0`, or
       `Date.now() < accessTokenExpires - 60_000`. Return it,
       `source: 'session'`. (No expiry recorded counts as good, the same
       rule the linked-account path already has.)
     - **Due**, and the JWT has a `refreshToken`: call
       `refreshGoogleAccessToken`. On `ok` return the new token,
       `source: 'session'`. It is not stored anywhere — a route cannot
       write the cookie; the browser's next `/api/auth/session` does that.
       Say so in a comment. On failure remember
       `problem = reason === 'refused' ? 'reconnect' : 'unavailable'` and
       carry on to step 2.
     - **Due**, no `refreshToken`: remember `problem = 'reconnect'`, carry on.
  2. The linked account, as now (`!userId` → no token; no row → no token).
     - Not expired → return the stored token.
     - Expired with a refresh token → refresh. On `ok` return the new
       token. On failure **do not return the stored token**; set the
       problem from the reason, unless step 1 already set one.
     - Expired with no refresh token → problem `'reconnect'` unless
       already set.
  3. Return `{ accessToken: null, source: null }`, plus `problem` if one
     was set.

### 3. `src/lib/auth.ts`

Only `refreshAccessToken` changes. Its body becomes:

- `const result = await refreshGoogleAccessToken(token.refreshToken!)`
- `ok` → `{ ...token, accessToken: result.accessToken, accessTokenExpires: result.expiresAt ?? 0, refreshToken: result.refreshToken ?? token.refreshToken, error: undefined }`
- `refused` → `{ ...token, error: 'RefreshAccessTokenError' }`
- `unavailable` → `return token` unchanged, so the next call tries again
  and no banner shows meanwhile.

Leave the `jwt` callback, `accountIsGone`, the "no refresh token" branch
and everything else in the file exactly as they are.

### 4. The two routes

In both `src/app/api/calendar/events/route.ts` and
`src/app/api/tasks/google/route.ts`, take `problem` from
`getGoogleAccessToken` and replace the `if (!accessToken)` block with:

- `problem === 'reconnect'` → status 401,
  `{ error: 'Google access has expired. Please sign in again.', code: 'TOKEN_EXPIRED' }`
- `problem === 'unavailable'` → status 503,
  `{ error: 'Could not reach Google. Try again shortly.', code: 'GOOGLE_UNAVAILABLE' }`
- otherwise → the existing `NO_CALENDAR` 401, unchanged.

Nothing else in either route changes. The client already copes:
`CalendarContext` throws a generic error on a 503 and shows no banner;
`GoogleTasksPicker` shows its `fetch_failed` state.

### 5. `src/contexts/CalendarContext.tsx`

In `fetchCalendarEvents`, after the `if (!response.ok) { ... }` block and
before reading the body, add `setGoogleTokenExpired(false)`. One line.

### 6. Tests

`src/__tests__/api/google-refresh.test.ts` (new, `@jest-environment node`,
mock `global.fetch` the way `google-token.test.ts` does):
- success returns the token, an `expiresAt` about an hour ahead, and the
  new refresh token when Google sends one;
- success with no `expires_in` gives `expiresAt: null`;
- 400 `invalid_grant` → `refused`;
- 400 `invalid_client`, a 500, a 200 without `access_token`, a body that is
  not JSON, and a thrown fetch → each `unavailable`;
- nothing logged contains the refresh token or the client secret.

`src/__tests__/api/google-token.test.ts`:
- Replace the three tests under the comment "The three below pin what
  happens today rather than what would be best" (and delete that comment):
  - Google refuses → `{ accessToken: null, source: null, problem: 'reconnect' }`, nothing stored;
  - Google unreachable → `problem: 'unavailable'`, nothing stored;
  - expired, no refresh token → `problem: 'reconnect'`, Google not asked.
- Keep "never writes a token to the log when a refresh fails" passing.
- Add under "signed in with Google":
  - a JWT token with `accessTokenExpires` an hour ahead is used as is, no
    fetch;
  - expired JWT token + `refreshToken`, Google answers 200 → the fresh
    token, `source: 'session'`, no database read or write;
  - expired, Google answers `invalid_grant`, nothing linked →
    `{ accessToken: null, source: null, problem: 'reconnect' }`;
  - expired, fetch throws, nothing linked → `problem: 'unavailable'`;
  - expired, no `refreshToken` in the JWT, nothing linked →
    `problem: 'reconnect'`, Google not asked;
  - expired, Google refuses, but a good linked account exists → the
    linked token, `source: 'connection'`, no `problem`.
- Every other existing test in the file must pass unedited.

`src/__tests__/auth-deleted-account.test.ts` — add a `describe` for a
refresh that fails (spy on `console.error` so the run stays quiet):
- Google answers 400 `invalid_grant` → `error` is
  `'RefreshAccessTokenError'`;
- fetch rejects → `error` is undefined and the token is returned unchanged;
- a 500 → the same.
The existing tests there must pass unedited.

`src/__tests__/calendar-cache-persistence.test.tsx` — one test: the first
events request answers 401 `{ code: 'TOKEN_EXPIRED' }`, the next answers
ok; a probe reading `googleTokenExpired` from `useCalendar()` shows `true`,
then after calling the context's refresh function (read its exact name in
the provider's value object, near the bottom of `CalendarContext.tsx`)
shows `false`.

### 7. `CLAUDE.md`

Under "Who is signed in", after the first bullet, add one bullet:
`getGoogleAccessToken` never returns a token past its expiry — it renews it
or returns none with a `problem` (`'reconnect'` or `'unavailable'`), and
only `'reconnect'` shows the sign-in-again banner. Add
`google-refresh.ts` to the File Structure list beside `google-token.ts`.

## Rules that apply

- **Branches**: work on `dev`; `/do-build` commits there and does not push.
- **Nothing else imports `next-auth`**: `google-refresh.ts` must not, and
  `session-discipline.test.ts` must still pass with its allowed list
  untouched.
- **Never writes to Google**: a token refresh is not a write; add no other
  Google call.
- **The repository is public**: no token, refresh token, user id or email
  in any new log line.
- **No new table, no migration**: `calendar_connections` keeps its shape.

## Do not

- Do not change the `jwt`, `session`, `signIn` or `redirect` callbacks, or
  `accountIsGone`, in `src/lib/auth.ts` — only `refreshAccessToken`.
- Do not change `getSignInGoogleTokens`'s return shape,
  `src/app/api/account/route.ts`, `src/app/api/calendar/status/route.ts`,
  `src/lib/session.ts` or `src/hooks/useAccount.ts`.
- Do not change `GoogleReauthBanner.tsx` or its wording, or
  `verifyTokenScopes` in the events route.
- Do not add caching of refreshed tokens, a `refetchInterval` on
  `SessionProvider`, or a client-side retry. The server-side renewal is
  the fix; these are separate ideas.
- Do not tidy the `console.log` lines already in these files.
- Do not touch `main`, and do not push.

## Done when

- `npx tsc --noEmit` is clean.
- `npm test` passes, including the new and rewritten tests above and
  `session-discipline.test.ts`.
- `npm run test:tz` passes.
- `npm run lint` stays at **54 warnings, 0 errors**.
- `npm run build` succeeds.
- `grep -rn "oauth2.googleapis.com/token" src --exclude-dir=__tests__`
  finds one file: `src/lib/google-refresh.ts`.
- In the app (the owner, on the `dev` preview, after a push they ask for):
  sign in, leave the app closed for over an hour, open it — the calendar
  loads and no banner shows. The builder cannot check this and should say
  so.

## Not decided

- **Is the Google OAuth app still in "Testing"?** If its publishing status
  in Google Cloud Console is Testing, Google expires every refresh token
  after seven days, and the banner will then appear weekly *correctly* —
  no code fixes that; publishing the app does. The owner should look
  (APIs & Services → OAuth consent screen). This does not block the build.
- A session whose grant Google has refused still asks Google again on
  every request until the person signs in again. It did before this
  change too. Left alone here.

## Who should build and review this

- **Build with Sonnet.** Every branch, return value and test case is
  written out above; there is no design left to choose.
- **Review with Fable.** It changes how the sign-in renews its token, and
  a mistake there is quiet: calendars go empty or people are told to sign
  in again, and only for sessions older than an hour.
- **Effort: medium.** Three small source files and tests; nothing here
  needs more.
