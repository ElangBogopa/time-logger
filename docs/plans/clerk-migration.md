# Move sign-in to Clerk, and fix onboarding on the way

Status: **Parked on 2026-11-14.** Phase A is done and committed
(`8b733af`, on `dev`). Phase B is not started and is parked by the
owner's decision to work on the app itself; do not build it unless
the owner asks for it by name. Phase C's items that do not need
Clerk (8, 9, 11, 12 below) will be planned and built separately, on
NextAuth. See `docs/plans/park-clerk.md`.

Pick this up again when people ask for a way in other than Google,
or when Google's consent screen on every sign-in is visibly losing
sign-ups.

## Goal

Let people sign in with Google, Apple or an emailed code, ask for calendar
access only when the app explains why, end sessions from the server, and
give a new person a first plan built around their own calendar and wake time.

### Why (the review this came from)

Sign-in (`src/lib/auth.ts`, `src/app/login/page.tsx`):
1. Google is the only way in. The first tap asks for Calendar and Tasks with
   `prompt: 'consent'`, so the full consent screen shows on every sign-in.
2. The Google refresh token lives only in the sign-in cookie, so a new device
   has none unless consent is forced again — which is why `prompt: 'consent'`
   is there.
3. The `users` row is created in two places (the `signIn` callback and
   `createUser` in `src/lib/auth-adapter.ts`), and if the lookup in `jwt()`
   fails the session id falls back to the Google account id
   (`id: dbUser?.id || profile?.sub`). `deleteAccountData` already carries
   code for such ids, so some may exist.
4. Sessions cannot be ended from the server; a deleted account stays signed
   in elsewhere for up to an hour (`accountIsGone`, `DeletedAccountGuard`).
5. Pages are protected only in the browser (`router.push('/login')` in each
   page); `src/middleware.ts` does CSRF only.
6. Auth callbacks log email addresses and user ids in production.
7. Login always returns to `/`, losing a deep link.

Onboarding (`src/components/OnboardingModal.tsx`, `src/hooks/useDashboardState.ts`):
8. "Onboarded" is `productivity_target` being set, checked in the browser
   after Today renders, so Today flashes before the sheet.
9. The calendar step ignores `isLoading` from `CalendarContext`, so a new
   account sees "Nothing yet. A clear day…" while events are loading.
10. The name step asks for a name Google already gave.
11. No wake time is asked, so the first plan uses the 6:30 default.
12. Plans are POSTed one by one and failures are ignored.

## Phase A — done

Everything that reads the signed-in person now goes through three helpers.
Behaviour is unchanged except the logging noted below. Still NextAuth.

New files:
- `src/lib/session.ts` — `getAppSession(): Promise<AppSession | null>` and the
  `AppSession` type (`user.id`, `user.email`, `user.name`,
  `user.preferredName`, `authProvider`, `error`). Today it returns
  `getServerSession(authOptions)`.
- `src/lib/google-token.ts` — `getGoogleAccessToken(request, session)`
  (sign-in token if `authProvider === 'google'`, else `calendar_connections`,
  refreshing it if expired) and `getSignInGoogleTokens(request)` (the
  access/refresh tokens in the sign-in cookie, via `getToken`).
- `src/hooks/useAccount.ts` — `useAccount()` returning `{ data, status }`
  (same shape as `useSession`), `signOutTo(path)`, `reconnectGoogle()`.

Changed:
- All 34 route files under `src/app/api/` that called
  `getServerSession(authOptions)` now call `getAppSession()`; their
  `next-auth` and `@/lib/auth` imports are gone. (Not `api/auth/[...nextauth]`.)
- `src/app/api/calendar/events/route.ts` and `src/app/api/tasks/google/route.ts`:
  their identical copies of `getCalendarAccessToken` are deleted and replaced
  by `getGoogleAccessToken`; unused `supabase` imports removed; the
  "User ID … Auth provider" log lines removed.
- `src/app/api/calendar/status/route.ts`: uses `getSignInGoogleTokens`; two log
  lines that printed the user id removed.
- `src/app/api/account/route.ts`: reads tokens through `getSignInGoogleTokens`.
  Its `SESSION_COOKIE` cookie-clearing is unchanged.
- 17 client files moved from `next-auth/react` to `@/hooks/useAccount`:
  `src/contexts/CalendarContext.tsx`, `src/hooks/useTimezoneSync.ts`,
  `src/app/{page,guide/page,settings/page,settings/connections/page,settings/notifications/page,calendar/page,library/page,review/page,log/[period]/page,pixels/page,goal/[id]/page}.tsx`,
  `src/components/{GoogleReauthBanner,AccountSheets,OnboardingModal}.tsx`,
  `src/components/review/{WeeklyReviewContent,DayReviewContent}.tsx`.
  `signOut({ callbackUrl: X })` became `signOutTo(X)`; `signIn('google')`
  became `reconnectGoogle()`.
- `src/hooks/useDashboardState.ts`: `Session` type replaced by `AppSession`.
- Tests: 11 API tests now mock `@/lib/session` (`getAppSession`) instead of
  `next-auth`; 13 component tests mock `@/hooks/useAccount` instead of
  `next-auth/react`; `account-sheets.test.tsx` expects `signOutTo('/login')`.
  The `jest.mock('@/lib/auth', …)` lines are still there.
- Still on NextAuth directly: `src/lib/auth.ts`, `src/lib/auth-adapter.ts`,
  `src/app/api/auth/[...nextauth]/route.ts`, `src/app/login/page.tsx`,
  `src/components/Providers.tsx`, and the three helpers.

Checked: `npx tsc --noEmit` clean; `npm test` 1063 passed / 13 skipped (same
as before); `npm run test:tz` passes in all 7 zones; `npm run build`
succeeds; `npm run lint` 47 errors / 143 warnings, identical to before the
change (all pre-existing). Not checked: running the app, the preview, a phone.

`npm run build` rewrites `public/sw.js` and `public/sw.js.map`; they show as
modified and must not be committed with this work.

### Phase A — what I am not sure about

- **A small behaviour change in errors.** `getSignInGoogleTokens` catches a
  failing `getToken`. Before, a throw there in `calendar/events` or
  `tasks/google` gave a 500; now it falls through to `calendar_connections`
  and, with none, a 401 `NO_CALENDAR`. I believe that is better, but it is a
  change.
- **Logs changed.** Lines that printed user ids, emails and token-refresh
  responses are gone; the refresh failure now logs only Google's error code.
  If anyone relies on those lines in Vercel logs, they will miss them.
- **`useAccount` returns a fresh object each render.** Every caller
  destructures it, and `data`/`status` themselves are stable, so no effect
  should re-run — but I did not test every screen in a browser.
- **No new tests for the three helpers.** They are covered only through the
  existing route and screen tests.
- **The rename was done by script.** Typecheck, tests and build pass, but I
  have not read all 77 changed files line by line after it.
- My earlier count of "33 client files" was wrong: it is 17 source files plus
  13 tests and one hook.

## Answers to the owner's questions

**User ids — how do existing accounts keep their data?**
Our ids do not change. Every table keeps `users.id`. Clerk's own id
(`user_…`) is stored in a new column `users.clerk_id`, and each Clerk user's
`externalId` is set to our `users.id`. A session-token claim
`{ "uid": "{{user.external_id}}" }` lets `getAppSession()` read our id with no
database lookup. Existing accounts are created in Clerk ahead of time by a
one-off script (`createUser` with their email and `externalId: users.id`), so
when they sign in with Google, Clerk matches the verified email and they land
on their own id and data. Two things I do not know yet: (a) whether any rows
in the `text`-keyed tables (`time_entries` etc.) are stored under a Google
account id rather than a uuid — run
`select count(*) from time_entries where user_id !~ '^[0-9a-f-]{36}$'` and the
same for each `text` table in `ACCOUNT_TABLES`; if any, Phase B must move
them to the matching `users.id` via `users.google_id` first; (b) exactly how
Clerk behaves if an imported email has no verified-email match — to be
checked on the preview with a test account.

**Google Calendar — where does the token come from, and does read-only still work?**
Clerk keeps the Google tokens on its servers and refreshes them. The server
asks for a current access token with
`clerkClient.users.getUserOauthAccessToken(clerkUserId, …)` inside
`getGoogleAccessToken` in `src/lib/google-token.ts`; the routes do not change.
Clerk does not hand over the refresh token. `calendar.readonly` and
`tasks.readonly` still work: they are added as extra scopes on Clerk's Google
connection, which requires using our own Google client id/secret there
(Clerk's shared credentials do not allow custom scopes). The plan asks for
the calendar scope during onboarding instead of at sign-in, using Clerk's
"reauthorize with additional scopes". Not known until tried: whether every
existing user is shown Google's consent screen once (I expect so), and the
exact provider argument name in the installed SDK version (`'google'` vs
`'oauth_google'` — read the installed types). `calendar_connections`
(a second Google account linked separately) is untouched.

**Delete account — what changes?**
In `src/app/api/account/route.ts`:
- Tokens to revoke: the access token from `getUserOauthAccessToken` (revoking
  any token of a grant revokes the whole grant) plus `storedGoogleToken(userId)`
  as today. There is no refresh token to read any more.
- Order: `deleteAccountData(userId, email)` (unchanged, `users` row last) →
  `revokeGoogleAccess(tokens)` → `clerkClient.users.deleteUser(clerkUserId)`.
  If the data delete fails, stop before Clerk, as now, so the person can sign
  in and ask again. If the Clerk delete fails, answer 500 and say "try again";
  a retry finds nothing left to delete in Supabase and tries Clerk again.
- Remove the `SESSION_COOKIE` cookie-clearing loop; deleting the Clerk user
  ends every session.
In `src/lib/account-data.ts`: `ACCOUNT_TABLES` does not change.
`ACCOUNT_TABLES_BY_OTHER_KEY` keeps `verification_tokens` (a NextAuth table;
harmless to keep deleting). The `google_id` branch for non-uuid ids can go
once the check in "User ids" shows no such ids remain. The `users` export
should not include `clerk_id`. `account-data.test.ts` must keep passing.
`docs` / the Privacy page must name Clerk as holding email and sign-in data.

**The deleted-account guard (`accountIsGone`) — what replaces it?**
Clerk itself. Deleting the Clerk user revokes all its sessions, and Clerk's
session tokens live about a minute, so another device loses access within
roughly a minute instead of an hour. `accountIsGone`, the `AccountDeleted`
token state, `DeletedAccountGuard` in `Providers.tsx` and
`src/__tests__/auth-deleted-account.test.ts` are removed. One thing the guard
did that Clerk does not: call `forgetThisDevice()` to clear what the device
kept. Replacement: `useAccount` calls `forgetThisDevice()` when the status
goes from signed in to signed out without the person tapping Sign out. Not
yet verified: the exact session-token lifetime on our Clerk plan.

**`push_subscriptions` and `calendar_connections` reference `users(id)` as a uuid — still true?**
Yes. `users.id` stays the uuid primary key, and those tables (and
`pending_calendar_connections`) keep their foreign keys. Only the new
`users.clerk_id` column holds Clerk's id. The rule that keeps it true: the
provisioning code in `getAppSession()` must only ever return a `users.id`,
never a Clerk or Google id.

**What the owner must do**
- Create a Clerk account and application. Enable Google, Apple and email
  code. Add the session-token claim `{ "uid": "{{user.external_id}}" }`.
- Google: in Clerk's Google connection, use the existing `GOOGLE_CLIENT_ID` /
  `GOOGLE_CLIENT_SECRET`, add the scopes, and add Clerk's redirect URI to the
  OAuth client in Google Cloud Console.
- Apple: production Sign in with Apple needs an Apple Developer account
  (paid yearly) for the service id and key. If you don't want that, leave
  Apple out.
- Production domain: as far as I know a Clerk production instance needs a
  domain you own (DNS records), not a `*.vercel.app` address. Check this
  before planning the switch.
- Vercel keys: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` —
  development-instance keys for Preview, production-instance keys for
  Production. Also put the development ones in `.env.local`. Keep
  `GOOGLE_CLIENT_ID`/`SECRET` (the `calendar_connections` flow uses them).
  `NEXTAUTH_SECRET`/`NEXTAUTH_URL` can be removed after the switch.
- Cost: Clerk has a free tier measured in monthly active users, then paid
  plans. I don't know the current limits or prices — check clerk.com/pricing.
- Google verification: still needed, and Clerk doesn't change that.
  `calendar.readonly` is a sensitive scope, and verification belongs to your
  Google Cloud project, not to Clerk. I don't know your project's current
  status. If the consent screen is still in "Testing", only listed test
  users can sign in and their tokens expire after 7 days.
- Run the import script once against production, after Phase B works on
  the preview.

## Files (Phases B and C)

- `package.json` — add `@clerk/nextjs`; remove `next-auth` at the end of B.
- `supabase/migrations/0xx_clerk_id_and_onboarded_at.sql` — `users.clerk_id text unique`;
  `user_preferences.onboarded_at timestamptz`, backfilled from
  `productivity_target is not null`; if the check above finds any, move rows
  keyed by Google account id to `users.id`.
- `src/lib/session.ts` — `getAppSession()` from Clerk `auth()`: `uid` claim,
  else find by `clerk_id`, else by verified email (set `clerk_id`), else
  insert; then `clerkClient.users.updateUser(clerkId, { externalId })`.
  `authProvider` = `'google'` when the Clerk user has a Google account.
- `src/lib/google-token.ts` — sign-in token from `getUserOauthAccessToken`;
  `getSignInGoogleTokens` returns only `accessToken`.
- `src/hooks/useAccount.ts` — Clerk `useUser`/`useClerk`; `signOutTo`,
  `reconnectGoogle` (reauthorize with scopes), `forgetThisDevice` on an
  unrequested sign-out.
- `src/middleware.ts` — `clerkMiddleware` around the existing CSRF code;
  public: `/login`, `/privacy`, `/terms`, `/api/cron/*`, service worker,
  manifest, static files; others redirect to `/login?redirect_url=…`.
- `src/components/Providers.tsx` — `ClerkProvider`; remove `DeletedAccountGuard`.
- `src/app/login/page.tsx` — Clerk `<SignIn routing="hash">` themed from the
  CSS tokens; keep the tagline, `InstallHintLink`, the "reads, never writes"
  line and the Terms/Privacy line; honour `redirect_url`.
- `src/app/api/account/route.ts`, `src/lib/account-data.ts` — as in "Delete account".
- Delete `src/lib/auth.ts`, `src/lib/auth-adapter.ts`,
  `src/app/api/auth/[...nextauth]/`, `src/__tests__/auth-deleted-account.test.ts`;
  drop `jest.mock('@/lib/auth', …)` lines from tests.
- Each page's `router.push('/login')` effect — remove (middleware does it).
- `scripts/import-users-to-clerk.ts` — one-off, run by the owner.
- `src/app/privacy/page.tsx`, `.env.example`, `CLAUDE.md` — name Clerk, new keys.
- Phase C: `src/components/OnboardingModal.tsx`, `src/hooks/useDashboardState.ts`,
  `src/app/api/plans/route.ts`, `src/app/api/preferences/route.ts`.

## Steps

Phase B
1. Run the non-uuid `user_id` check (owner, in Supabase). Write the migration.
2. Install `@clerk/nextjs`; read its types for `getUserOauthAccessToken` and
   `reauthorize`.
3. Rewrite `session.ts`, `google-token.ts`, `useAccount.ts` on Clerk; add tests
   for `getAppSession` (claim present; claim missing → links by email; creates
   a row; never returns a non-uuid).
4. `Providers.tsx`, `middleware.ts` (test: `/api/cron/reminders` passes with no
   session; CSRF still enforced), `login/page.tsx`.
5. Account deletion order and its test (rows → revoke → Clerk delete; Clerk
   delete not called if rows failed).
6. Remove NextAuth files, per-page login redirects, `next-auth` dependency.
7. Import script; Privacy page; `.env.example`; `CLAUDE.md`.

Phase C
8. `onboarded_at`: `finish()` sets it, `useDashboardState` reads it, Today shows
   its skeleton until known; stop writing `productivity_target`.
9. Skip the name step when Clerk has a first name (still save `preferred_name`).
10. Calendar step: if no Google calendar scope, explain and offer
    **Connect Google Calendar** (`reconnectGoogle`); show a loading row while
    `isLoading`. Tasks scope only where Tasks are imported.
11. Wake time row on the plan step via `useWakeTime` (`src/hooks/useWakeTime.ts`).
12. `/api/plans` POST accepts `{ plans: [{ date, title }] }` in one insert;
    `finish()` uses it and shows errors; add a test.

## Rules that apply

- CLAUDE.md "Branches": all work on `dev`; never commit, push or merge to
  `main`; commit only when asked.
- "A new table is also something to export and to delete": `users.clerk_id`
  and `onboarded_at` are columns, not tables, but deletion must still clear
  everything and now also the Clerk user.
- "It never writes to Google": only read scopes; revocation is the one
  non-read call and stays so.
- Reminders: `/api/cron/*` must stay reachable without a session.
- Design principles 1, 3 (one primary button, sheets from the bottom), 8 (no
  loading flash), 12 (windows follow the person's wake time).
- Every OpenAI route still checks the session first and rate-limits by user id.

## Do not

- Do not change `users.id` or any `user_id` column type.
- Do not touch `calendar_connections` / `pending_calendar_connections` flows
  or `src/app/api/auth/merge-accounts` beyond what removing NextAuth forces.
- Do not commit `public/sw.js` or `public/sw.js.map` build output.
- Do not log emails, user ids or tokens.
- Do not push Phase B to `dev` before the Clerk keys are set in Vercel Preview.

## Done when

- `npx tsc --noEmit` clean; `npm test` passes with the new tests;
  `npm run test:tz` passes; `npm run lint` stays at 47 errors / 143 warnings
  or fewer; `npm run build` succeeds.
- On the Vercel preview, on an iPhone in Safari and as a Home Screen app: a new
  Google user goes through onboarding, connects the calendar, sees real
  events, and is handed to `/calendar?…&suggest=1`; an email-code user
  connects Google during onboarding; an imported existing user signs in and
  sees their old entries and calendar; deleting on one device signs the
  other out within about a minute.

## Not decided

- Whether to offer Apple sign-in (needs a paid Apple Developer account).
- Which domain the Clerk production instance uses.
- Whether any data is stored under Google account ids (needs the check above).
