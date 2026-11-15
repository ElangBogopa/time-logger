# Reminders screen: the line under "When" says what to do while reminders are off

> **BUILT - do not run again.** Built on 2026-11-14 in the commit titled "feat: the Reminders line says to turn them on while they are off". It stays as the record of what was asked.

## Goal

On the Reminders screen (More → Reminders), while reminders are off and the
"Turn on" button is on the screen, the small line under the "When" list
says "Turn reminders on to choose the times." Once reminders are on it goes
back to today's wording. Where the person cannot turn them on from this
screen (notifications blocked, or a device that cannot receive them) the
line keeps today's wording. Nothing else on the screen changes.

## What was found before planning (do not re-investigate)

- The screen is `src/app/settings/notifications/page.tsx`
  (`NotificationsPage`). Its tests are `src/__tests__/reminders-screen.test.tsx`.
- Two constants already exist just above the `return` (about lines 129–130):
  ```tsx
  const canSwitch = push.isSupported && push.permission !== 'denied'
  const locked = !push.isSubscribed
  ```
  `canSwitch` is exactly what puts the Turn on / Turn off button on the
  screen (`{canSwitch && (<Button …>`), and that button reads "Turn on"
  when `push.isSubscribed` is false. So "reminders are off and the Turn on
  button is on the screen" is `canSwitch && locked`.
- The line to change is the last `<p>` before the closing `</div>` of the
  page column, directly after the `<section aria-label="When">`:
  ```tsx
  <p className="mt-2 text-xs text-muted-foreground">
    Sent on the hour, give or take a few minutes, and skipped when you have already logged that part of the day.
  </p>
  ```
- The wording appears nowhere else in `src` except the one test named below.

## Files

### `src/app/settings/notifications/page.tsx`

Change only the text inside that one `<p>`. The `className` stays exactly as
it is. The result:

```tsx
<p className="mt-2 text-xs text-muted-foreground">
  {canSwitch && locked
    ? 'Turn reminders on to choose the times.'
    : 'Sent on the hour, give or take a few minutes, and skipped when you have already logged that part of the day.'}
</p>
```

Use the existing `canSwitch` and `locked` constants. Do not add a new
variable, state, hook or component. Do not use `locked` alone: that would
show the new line where notifications are blocked or unsupported, which the
owner has ruled out. Both strings are exact, including the full stop.

### `src/__tests__/reminders-screen.test.tsx`

All edits are in the `describe('when each one arrives', …)` block, at its
end. In this file `push()` defaults to `isSupported: true`,
`permission: 'granted'`, `isSubscribed: true`.

1. Keep the existing last test, `'says they go out on the hour and are
   skipped once that part is logged'`, and add one assertion to its end:
   ```ts
   expect(screen.queryByText('Turn reminders on to choose the times.')).not.toBeInTheDocument()
   ```
2. Add these three tests directly after it:
   ```ts
   it('says to turn reminders on, instead, while they are off and can be turned on here', async () => {
     await setup(push({ isSubscribed: false }))

     expect(screen.getByRole('button', { name: 'Turn on' })).toBeInTheDocument()
     expect(screen.getByText('Turn reminders on to choose the times.')).toBeInTheDocument()
     expect(screen.queryByText(/Sent on the hour/)).not.toBeInTheDocument()
   })

   it('keeps the usual line where notifications are blocked, since there is nothing to turn on here', async () => {
     await setup(push({ isSubscribed: false, permission: 'denied' }))

     expect(screen.getByText(/Sent on the hour, give or take a few minutes/)).toBeInTheDocument()
     expect(screen.queryByText('Turn reminders on to choose the times.')).not.toBeInTheDocument()
   })

   it('keeps the usual line on a device that cannot receive them', async () => {
     await setup(push({ isSupported: false, isSubscribed: false, permission: 'unsupported' }), { platform: 'ios', standalone: false })

     expect(screen.getByText(/Sent on the hour, give or take a few minutes/)).toBeInTheDocument()
     expect(screen.queryByText('Turn reminders on to choose the times.')).not.toBeInTheDocument()
   })
   ```

No other test in the file changes.

## Steps

1. `git branch --show-current` must print `dev`. If not, `git switch dev`.
2. Make the one edit in `src/app/settings/notifications/page.tsx`.
3. Make the test edits. Run `npm test -- reminders-screen` until green.
4. Run the full checks in "Done when".
5. Commit to `dev` as `/do-build` does. Do not push from the build.

## Rules that apply

- **Branches**: work on `dev`; never touch `main`.
- **Principle 5, one type scale**: the line stays `text-xs
  text-muted-foreground` — 12px, full-strength muted, no opacity suffix.
- **Principle 2, muted palette**: no colour is added; the line is neutral
  in every state.
- **Reminders**: who gets them is the push subscription, nothing else — so
  "off" on this screen means `!push.isSubscribed`, the existing `locked`.
  Do not read `reminder_enabled`.

## Do not

- Do not change the status line at the top ("Off. Turn them on for a
  nudge…"), the Turn on / Turn off button, "Show me how", "Send a test",
  the header, the "When" heading, or the list's rows, dimming or disabled
  states. The list stays dimmed whenever `locked` is true, as now.
- Do not change the wording shown while reminders are on.
- Do not change the line's classes or position, and do not add an icon,
  link or button to it.
- Do not write new wording for the blocked or unsupported cases; they keep
  today's line.
- Do not try to fix the moment on opening when the screen reads as off
  while it checks the subscription. The new line may show for that same
  moment. The owner has said that is a separate matter; leave
  `push.isLoading` out of the condition.
- Do not touch `src/hooks/usePushNotifications.ts`, `src/lib/reminders.ts`,
  the cron job or any API route.
- Do not edit `CLAUDE.md`, `docs/reviews/open.md` or
  `docs/BUSINESS-CONTEXT.md`.
- Do not merge, and do not touch `main`.

## Done when

- `npx tsc --noEmit` is clean.
- `npm test` passes, with three more tests than before (the ones above).
- `npm run test:tz` passes.
- `npm run lint` stays at 0 errors, 54 warnings.
- `npm run build` succeeds.
- In the app, More → Reminders:
  - with reminders off and a "Turn on" button showing, the small line under
    the dimmed "When" list reads "Turn reminders on to choose the times.";
  - after pressing "Turn on", it reads "Sent on the hour, give or take a
    few minutes, and skipped when you have already logged that part of the
    day.";
  - after "Turn off", it reads the new line again;
  - with notifications blocked for the site in the browser's settings (no
    Turn on button, top line says they are blocked), the small line reads
    "Sent on the hour…" as it does today;
  - everything else on the screen looks as it did.

## Not decided

Nothing.

The request says dev is pushed when done. `/do-build` commits and does not
push; the push belongs to `/do-all` at the end of a clean run.

## Who should build and review this

- **Build with Haiku.** One ternary and four test edits, each written out
  in full above; there is no decision left in it.
- **Review with Opus.** The owner wants this reviewed. What can go wrong is
  the condition (the new line showing where there is no Turn on button, or
  the usual line lost while reminders are on), which is ordinary logic on
  one screen. No reminder is sent differently and no data is touched, so
  Fable is not needed.
- **Effort: low for both.** The build's edits are given exactly, and the
  review is one condition and three tests to read against this brief.
