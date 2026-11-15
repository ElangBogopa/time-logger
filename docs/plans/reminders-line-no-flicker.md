# Reminders screen: the line under "When" no longer flickers as the screen opens

> **BUILT - do not run again.** Built on 2026-11-15 in the commit titled "feat: the Reminders line waits for the device check before it says to turn on". It stays as the record of what was asked.

## Goal

On the Reminders screen (More → Reminders), the small line under the "When"
list stops changing a moment after the screen opens. Today, for someone who
has reminders on, it reads "Turn reminders on to choose the times." while
the screen is still checking this device, then switches to "Sent on the
hour…". After this change it reads "Sent on the hour…" while that check is
running, and "Turn reminders on to choose the times." appears only once the
check has finished, reminders are off, and the Turn on button is there.
Only that one line changes.

## What was found before planning (do not re-investigate)

- The screen is `src/app/settings/notifications/page.tsx`
  (`NotificationsPage`). Its tests are
  `src/__tests__/reminders-screen.test.tsx`.
- The screen reads the device's state from `usePushNotifications()`
  (`src/hooks/usePushNotifications.ts`) as `push`. That hook starts with
  `isSubscribed: false`, `permission: 'prompt'` and `isLoading: true`, and
  sets the real values and `isLoading: false` together when its first check
  finishes. That starting state is why the screen reads as "off" for a
  moment. `isLoading` is also true while Turn on or Turn off is being
  carried out, and goes back to false when that ends, whether it worked or
  not.
- Two constants already exist just above the `return` in the page (about
  lines 129–130):
  ```tsx
  const canSwitch = push.isSupported && push.permission !== 'denied'
  const locked = !push.isSubscribed
  ```
- The line to change is the last `<p>` in the page, directly after the
  `<section aria-label="When">` (about lines 236–240). Today it is:
  ```tsx
  <p className="mt-2 text-xs text-muted-foreground">
    {canSwitch && locked
      ? 'Turn reminders on to choose the times.'
      : 'Sent on the hour, give or take a few minutes, and skipped when you have already logged that part of the day.'}
  </p>
  ```
- In the test file, the `push()` helper builds the mocked hook value and
  defaults to `isSupported: true`, `permission: 'granted'`,
  `isSubscribed: true`, `isLoading: false`. Every existing test therefore
  already describes the screen after the check has finished, and none needs
  to change.

## Files

### `src/app/settings/notifications/page.tsx`

Add `&& !push.isLoading` to the condition of that one `<p>`. Nothing else
in the file changes. The result:

```tsx
<p className="mt-2 text-xs text-muted-foreground">
  {canSwitch && locked && !push.isLoading
    ? 'Turn reminders on to choose the times.'
    : 'Sent on the hour, give or take a few minutes, and skipped when you have already logged that part of the day.'}
</p>
```

Do not change `canSwitch` or `locked` themselves: the dimmed list, the
switches, the status line and the button all read them and must behave
exactly as now. Do not add a variable, state, ref, hook or component. Both
strings stay exactly as they are, including the full stop.

### `src/__tests__/reminders-screen.test.tsx`

Add one test at the end of the `describe('when each one arrives', …)`
block, after `'keeps the usual line on a device that cannot receive
them'`. It gives the hook's starting state, exactly as the real hook has
it while its first check runs:

```ts
it('keeps the usual line while this device is still being checked, so it does not change a moment later', async () => {
  await setup(push({ isSubscribed: false, permission: 'prompt', isLoading: true }))

  expect(screen.getByText(/Sent on the hour, give or take a few minutes/)).toBeInTheDocument()
  expect(screen.queryByText('Turn reminders on to choose the times.')).not.toBeInTheDocument()
})
```

No other test in the file changes. In particular `'says to turn reminders
on, instead, while they are off and can be turned on here'` must still
pass untouched: it is the check-finished, reminders-off case.

## Steps

1. `git branch --show-current` must print `dev`. If not, `git switch dev`.
2. Add the test above. Run `npm test -- reminders-screen` and see that the
   new test fails (it finds "Turn reminders on to choose the times.").
3. Make the one edit in `src/app/settings/notifications/page.tsx`.
4. Run `npm test -- reminders-screen` until every test in the file passes.
5. Run the full checks in "Done when".
6. Commit to `dev` as `/do-build` does. Do not push from the build.

## Rules that apply

- **Branches**: work on `dev`; never touch `main`.
- **Principle 8, no loading flash on navigation**: a screen should not show
  one thing and then another as it opens. This fixes that for this line.
- **Principle 5, one type scale**: the line stays `text-xs
  text-muted-foreground` — 12px, full-strength muted, no opacity suffix.
- **Principle 2, muted palette**: no colour is added.
- **Reminders**: who gets them is the push subscription, nothing else. Do
  not read `reminder_enabled`, and do not cache "reminders are on" anywhere
  to guess the answer early.

## Do not

- Do not fix the same flicker anywhere else on the screen. The owner has
  said so in terms: the dimmed "When" list, the status line at the top
  ("Off. Turn them on for a nudge…") and the Turn on / Turn off button are
  left exactly as they are, even though they change the same way as the
  screen opens.
- Do not touch `src/hooks/usePushNotifications.ts`. Its starting values
  stay as they are.
- Do not try to tell the first check apart from a tap on Turn on or Turn
  off. The owner has said it is fine for the usual "Sent on the hour…"
  wording to show for the moment after either tap, which is what
  `!push.isLoading` does.
- Do not change either wording, the line's classes or its position, and do
  not add a spinner, placeholder, icon or empty space in its place while
  checking.
- Do not change what the line says where notifications are blocked or the
  device cannot receive them; those keep "Sent on the hour…".
- Do not change or delete any existing test.
- Do not touch `src/lib/reminders.ts`, the cron job or any API route.
- Do not edit `CLAUDE.md`, `docs/reviews/open.md` or
  `docs/BUSINESS-CONTEXT.md`.
- Do not merge, and do not touch `main`.

## Done when

- `npx tsc --noEmit` is clean.
- `npm test` passes, with one more test than before (the one above).
- `npm run test:tz` passes.
- `npm run lint` stays at 0 errors, 54 warnings.
- `npm run build` succeeds.
- In the app, More → Reminders:
  - with reminders on, open the screen (reload it to be sure): the small
    line under the "When" list reads "Sent on the hour, give or take a few
    minutes, and skipped when you have already logged that part of the
    day." from the first moment and does not change;
  - with reminders off, open the screen: the line reads "Sent on the
    hour…" for a moment, then "Turn reminders on to choose the times."
    once the Turn on button stops spinning;
  - press Turn on: the line reads "Sent on the hour…" and stays;
  - press Turn off: the line stays "Sent on the hour…" while the button
    spins, then reads "Turn reminders on to choose the times.";
  - the dimmed list, the status line at the top and the button look and
    behave as they did before, including their own flicker on opening.

## Not decided

Nothing.

The request says dev is pushed when done. `/do-build` commits and does not
push; the push belongs to `/do-all` at the end of a clean run.

## Who should build and review this

- **Build with Haiku.** One condition and one test, both written out in
  full above; there is no decision left in it.
- **Review with Opus.** What can go wrong is the condition: the turn-on
  line never appearing, or still appearing during the check. That is
  ordinary logic on one screen. No reminder is sent differently and no
  data is touched, so Fable is not needed.
- **Effort: low for both.** The edits are given exactly, and the review is
  one condition and one test to read against this brief.
