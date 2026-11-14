# Park the Clerk switch; keep the tidy-up that is already in

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
  removed duplicated code and log lines that printed emails and user ids.
- Phase B (the switch itself) is where the cost is — a Clerk account, a
  domain, Google OAuth re-wiring, importing production users — for things
  no current user is asking for. It is parked, not cancelled.
- Four of Phase C's onboarding fixes do not need Clerk (items 8, 9, 11 and
  12 in that plan's "Why" list). They will be planned separately.

## Files

- `docs/plans/clerk-migration.md` — the only file edited.
  1. Replace the status paragraph at the top (it begins
     `Status: **Phase A done (uncommitted, on `dev`). Phases B and C not started.**`
     and runs to the end of that paragraph) with:

     > Status: **Parked on 2026-11-14.** Phase A is done and committed
     > (`8b733af`, on `dev`). Phase B is not started and is parked by the
     > owner's decision to work on the app itself; do not build it unless
     > the owner asks for it by name. Phase C's items that do not need
     > Clerk (8, 9, 11, 12 below) will be planned and built separately, on
     > NextAuth. See `docs/plans/park-clerk.md`.
     >
     > Pick this up again when people ask for a way in other than Google,
     > or when Google's consent screen on every sign-in is visibly losing
     > sign-ups.

  2. In the "Not decided" list at the bottom, delete the line
     `Whether Phase A is committed and pushed to `dev` before Phase B.` —
     it is committed and pushed.
  3. Change nothing else in the file.
- `public/sw.js`, `public/sw.js.map` — not edited; restored (step 1).

## Steps

1. Confirm the branch is `dev` (`git branch --show-current`). Run
   `git status --short`. If `public/sw.js` and `public/sw.js.map` show as
   modified, restore them: `git checkout -- public/sw.js public/sw.js.map`.
   They are build output and must not be committed.
2. Confirm nothing of Clerk is in the code:
   `grep -ril clerk src package.json` must print nothing. If it prints
   anything, stop and report it; do not remove it.
3. Make the two edits to `docs/plans/clerk-migration.md` described above.
4. Run the checks in "Done when" to confirm Phase A is sound. If any fails,
   stop and report the output. Do not fix it and do not revert `8b733af`.
5. `npm run build` rewrites `public/sw.js` and `public/sw.js.map` again;
   restore them as in step 1.
6. Report what was run and its results. Do not commit unless the owner asks.

## Rules that apply

- CLAUDE.md "Branches": work on `dev`; never commit to, push to or merge
  into `main`; commit and push only when asked.
- CLAUDE.md "Before asking for a merge": the five checks, and saying what
  was checked and what was not.

## Do not

- Do not revert or amend `8b733af`, or change `src/lib/session.ts`,
  `src/lib/google-token.ts` or `src/hooks/useAccount.ts`.
- Do not install `@clerk/nextjs` or start any step of Phase B.
- Do not build the onboarding fixes (Phase C items); they get their own
  brief.
- Do not delete `docs/plans/clerk-migration.md` or touch the commented
  `[auth.third_party.clerk]` block in `supabase/config.toml` (it is the
  Supabase CLI's default template, not ours).
- Do not edit any file under `src/`.
- Do not commit `public/sw.js` or `public/sw.js.map`.

## Done when

- `git diff --stat` shows only `docs/plans/clerk-migration.md`.
- `grep -ril clerk src package.json` prints nothing.
- `npx tsc --noEmit` is clean.
- `npm test` passes (1063 passed / 13 skipped when Phase A was committed;
  no failures and no fewer passing).
- `npm run test:tz` passes in all 7 zones.
- `npm run lint` is at 47 errors / 143 warnings or fewer.
- `npm run build` succeeds.
- For the owner, not the builder — Phase A was renamed by script across 77
  files and never run in a browser. On the Vercel preview for `dev`, on a
  phone: sign in; Today loads; calendar events appear; log an entry; Review
  opens; More → Reminders → Send a test arrives; sign out lands on the
  login page. `dev` should not be merged into `main` until this has been
  done.

## Not decided

- Which piece of app work comes first now. A candidate is the four
  Clerk-free onboarding fixes: Today flashing before the onboarding sheet
  (8), "Nothing yet" shown while the calendar is still loading (9), no wake
  time asked so the first plan assumes 6:30 (11), and plans saved one at a
  time with failures ignored (12).
- Whether to merge `dev` into `main` once the phone walk-through passes.
