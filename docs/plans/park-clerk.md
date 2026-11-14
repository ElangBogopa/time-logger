# Park the Clerk switch; keep the tidy-up that is already in

> **BUILT - do not run again.** Built in `0c0d1e8` and corrected in
> `8e4890d` (2026-11-14). The status paragraph the Steps below replace no
> longer exists, and `clerk-migration.md` has moved on since; running this
> brief again would overwrite its current status. Kept as the record of
> what was asked. See "What was built beyond this brief" at the end.

## Goal

Stop the move to Clerk where it stands, without undoing anything, so the
time goes to what the app does for people. Record the decision in the Clerk
plan so nobody picks it up by accident, and check that the one part already
built still works.

### Why (so the builder does not second-guess it)

- Nothing of Clerk is in the app: `@clerk/nextjs` is not installed, there
  are no keys and no migration. Sign-in is still NextAuth.
- Only Phase A of `docs/plans/clerk-migration.md` exists (commit `8b733af`,
  on `dev` and `origin/dev`, not on `main`). It is a refactor, not a Clerk
  change: routes read the session through `getAppSession()` in
  `src/lib/session.ts`, screens through `useAccount()` in
  `src/hooks/useAccount.ts`, and the Google token code lives once in
  `src/lib/google-token.ts`. All three wrap NextAuth. It is kept: it
  removed duplicated code, and log lines that printed emails and user ids
  from the API routes. The auth callbacks in `src/lib/auth.ts` and
  `src/lib/auth-adapter.ts` still print them on every sign-in; that is
  "Why" item 6 of the Clerk plan and does not wait for Clerk.
- Phase B (the switch itself) is where the cost is — a Clerk account, a
  domain, Google OAuth re-wiring, importing production users — for things
  no current user is asking for. It is parked, not cancelled.
- Seven of the problems in that plan's "Why" list do not need Clerk: three
  about sign-in (5, 6, 7) and four about onboarding (8, 9, 11, 12). The
  numbers are the "Why" list's, not the Phase C steps', which reuse the
  same numbers for different things. They will be planned separately.
  Item 8 needs `user_preferences.onboarded_at`, which the Clerk plan
  creates in the same migration as `users.clerk_id`; on NextAuth it needs
  a migration of its own that adds only `onboarded_at`.

## Files

- `docs/plans/clerk-migration.md` — the only file edited.
  1. Replace the status paragraph at the top (it begins
     `Status: **Phase A done (uncommitted, on `dev`). Phases B and C not started.**`
     and runs to the end of that paragraph) with:

     > Status: **Parked on 2026-11-14.** Phase A is done and committed
     > (`8b733af`, on `dev`). Phase B is not started and is parked by the
     > owner's decision to work on the app itself; do not build it unless
     > the owner asks for it by name. The problems that do not need Clerk
     > ("Why" items 5, 6, 7, 8, 9, 11, 12 — numbered by the "Why" list,
     > not the Phase C steps) will be planned and built separately, on
     > NextAuth. See `docs/plans/park-clerk.md`.
     >
     > Pick this up again when people ask for a way in other than Google,
     > or when Google's consent screen on every sign-in is visibly losing
     > sign-ups.

     (Done. A later review also added a "PARKED - do not build" marker at
     the top and at the Steps and Phase B headings, spelled out each
     Clerk-free item, and noted that item 8 needs its own migration.)

  2. In the "Not decided" list at the bottom, delete the line
     `Whether Phase A is committed and pushed to `dev` before Phase B.` —
     it is committed and pushed.
  3. Change nothing else in the file.

## Steps

1. Confirm the branch is `dev` (`git branch --show-current`).
2. Confirm nothing of Clerk is in the code:
   `grep -ril clerk src package.json` must print nothing. If it prints
   anything, stop and report it; do not remove it.
3. Make the two edits to `docs/plans/clerk-migration.md` described above.
4. Run the checks in "Done when" in the order listed to confirm Phase A is
   sound. If any fails, stop and report the output. Do not fix it and do
   not revert `8b733af`.
5. Report what was run and its results. Do not commit unless the owner asks.

## Rules that apply

- CLAUDE.md "Branches": work on `dev`; never commit to, push to or merge
  into `main`; commit and push only when asked.
- CLAUDE.md "Before asking for a merge": the five checks, and saying what
  was checked and what was not.

## Do not

- Do not revert or amend `8b733af`, or change `src/lib/session.ts`,
  `src/lib/google-token.ts` or `src/hooks/useAccount.ts`.
- Do not install `@clerk/nextjs` or start any step of Phase B.
- Do not build the Clerk-free fixes ("Why" items 5, 6, 7, 8, 9, 11, 12);
  they get their own briefs.
- Do not delete `docs/plans/clerk-migration.md` or touch the
  `[auth.third_party.clerk]` block in `supabase/config.toml`. It comes
  from the Supabase CLI's default template, not from us, but it is live
  config, not a comment: the header and `enabled = false` are active and
  only `domain` is commented out. It is a disabled provider setting, and
  the `grep` in step 2 does not cover it.
- Do not edit any file under `src/`.

## Done when

- `grep -ril clerk src package.json` prints nothing.
- `npx tsc --noEmit` is clean.
- `npm test` passes (1063 passed / 13 skipped when Phase A was committed;
  no failures and no fewer passing).
- `npm run test:tz` passes in all 7 zones.
- `npm run lint` is at 47 errors / 143 warnings or fewer.
- `npm run build` succeeds.
- `git diff --stat` shows only `docs/plans/clerk-migration.md`.
- For the owner, not the builder — Phase A was renamed by script across 80
  files under `src/` (81 in the commit) and never run in a browser. On the
  Vercel preview for `dev`, on a phone: sign in; Today loads; calendar events appear; log an entry; Review
  opens; More → Reminders → Send a test arrives; sign out lands on the
  login page. `dev` should not be merged into `main` until this has been
  done.

## Not decided

- Which piece of app work comes first now. Candidates are the seven
  Clerk-free fixes, numbered by the Clerk plan's "Why" list. Sign-in: pages
  protected only in the browser (5), auth callbacks logging emails and user
  ids (6), login losing the deep link (7). Onboarding: Today flashing before
  the onboarding sheet (8, which needs its own `onboarded_at` migration),
  "Nothing yet" shown while the calendar is still loading (9), no wake time
  asked so the first plan assumes 6:30 (11), and plans saved one at a time
  with failures ignored (12).
- Whether to merge `dev` into `main` once the phone walk-through passes.

## What was built beyond this brief

Added 2026-11-14, after a review. The Steps above are left as they were
asked; this is what the two commits did that they do not describe.

- `8e4890d` edited more than `clerk-migration.md`, so "`git diff --stat`
  shows only `docs/plans/clerk-migration.md`" was not true of it:
  - `.gitignore`: the six service-worker patterns next-pwa writes into
    `public/` (`sw.js`, `workbox-*.js`, `swe-worker-*.js` and their maps),
    and editor swap files.
  - Six files under `public/` removed from git: `sw.js`, `sw.js.map`,
    `workbox-c18c662b.js`, `workbox-c18c662b.js.map`,
    `swe-worker-5c72df51bb1f6ee0.js` and its map.
  - In `clerk-migration.md`, beyond the status paragraph: two notes about
    not committing `public/sw.js` deleted; a caveat added that the auth
    callbacks still log emails and user ids; the Phase A file count changed
    from 77 to 80 under `src/` (81 in the commit); the Steps heading and
    Phase B marked PARKED.
- The list of Clerk-free items here (under "Why" and "Not decided") is 5,
  6, 7, 8, 9, 11 and 12. It left out items 3 (the `users` row created in
  two places, and the session id falling back to the Google account id)
  and 10 (the name step asking for a name Google already gave). Neither
  needs Clerk; `clerk-migration.md` now lists them, and item 3 should come
  first.
- The pass mark "47 errors / 143 warnings" under "Done when" was counted
  with the generated service worker linted. It is no longer linted; the
  same code is 47 errors / 56 warnings, before or after a build.
- `clerk-migration.md` now numbers its steps B1–B7 and C1–C5, and marks
  Phase C PARKED, so "the Phase C steps reuse the same numbers" no longer
  applies.
