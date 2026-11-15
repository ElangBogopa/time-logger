# Reminders screen: say so when all three times are switched off

> **BUILT - do not run again.** Built on 2026-11-15 in the commit titled "feat: the Reminders screen says nothing will be sent when all three times are off". It stays as the record of what was asked.

## Goal

On the Reminders screen (More → Reminders), when reminders are on for this
device but all three times under "When" are switched off, the small line
under the "When" list says "All three are switched off, so nothing will be
sent." instead of "Sent on the hour…". As soon as one of the three is
switched back on, the usual line returns. This is wording on that one
screen: nothing about what is stored or sent changes.

## What was found before planning (do not re-investigate)

- The screen is `src/app/settings/notifications/page.tsx`
  (`NotificationsPage`). Its tests are
  `src/__tests__/reminders-screen.test.tsx`.
- The three times are the state `reminderTimes` (`ReminderTime[]`, each
  with `enabled: boolean`). The `save` function sets that state at once,
  before the server answers, and puts it back if the save fails. So a line
  computed from `reminderTimes` changes the moment a switch is pressed, in
  both directions, with no extra code.
- Two constants already exist just above the `return`:
  ```tsx
  const canSwitch = push.isSupported && push.permission !== 'denied'
  const locked = !push.isSubscribed
  ```
  "On for this device" is `push.isSubscribed`, i.e. `!locked`.
- The line to change is the last `<p>` of the page column, directly after
  `<section aria-label="When">`. Today it is:
  ```tsx
  <p className="mt-2 text-xs text-muted-foreground">
    {canSwitch && locked && !push.isLoading
      ? 'Turn reminders on to choose the times.'
      : 'Sent on the hour, give or take a few minutes, and skipped when you have already logged that part of the day.'}
  </p>
  ```
- In the test file, `push()` defaults to `isSupported: true`,
  `permission: 'granted'`, `isSubscribed: true`. `beforeEach` sets
  `global.fetch` to answer with `STORED`, in which the third time is off
  and the first two are on. The switches are named 'Log your morning'
  (id `midday`), 'Log your afternoon' (id `evening`) and 'Log your evening'
  (id `night`).

## Decided (the request left these open; they are settled)

- **The sentence goes in the small line under the "When" list**, replacing
  "Sent on the hour…" there. It sits directly under the three switches it
  is talking about.
- **The top line stays "On for this device."** It is still true: the device
  is subscribed, "Turn off" and "Send a test" still apply. It is not
  reworded and the sentence is not repeated there.
- The sentence is plain small grey text like the line it replaces: no
  colour, no icon, no button.
- While reminders are off for this device, the line stays "Turn reminders
  on to choose the times." even if all three stored times are off. The new
  sentence is only for a device that is on.

## Files

### `src/app/settings/notifications/page.tsx`

1. Directly after the line `const locked = !push.isSubscribed`, add:
   ```tsx
   // On for this device, yet every time is switched off: nothing will arrive,
   // and the line under the list must not read as if it will.
   const allOff = push.isSubscribed && reminderTimes.length > 0 && reminderTimes.every((reminder) => !reminder.enabled)
   ```
2. Change only the text inside the one `<p>` shown above. The `className`
   stays exactly as it is. The result:
   ```tsx
   <p className="mt-2 text-xs text-muted-foreground">
     {canSwitch && locked && !push.isLoading
       ? 'Turn reminders on to choose the times.'
       : allOff
         ? 'All three are switched off, so nothing will be sent.'
         : 'Sent on the hour, give or take a few minutes, and skipped when you have already logged that part of the day.'}
   </p>
   ```

The new string is exact, including the full stop. Add no state, hook,
effect or component.

### `src/__tests__/reminders-screen.test.tsx`

All edits are at the end of the `describe('when each one arrives', …)`
block, after the last existing test (`'keeps the usual line while this
device is still being checked, …'`). No existing test changes. Add:

```ts
  describe('with all three switched off', () => {
    const SENTENCE = 'All three are switched off, so nothing will be sent.'

    beforeEach(() => {
      const allOff = STORED.map((reminder) => ({ ...reminder, enabled: false }))
      global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ preferences: { reminder_times: allOff } }) })) as unknown as typeof fetch
    })

    it('says nothing will be sent, in place of the usual line, while reminders are on for this device', async () => {
      await setup()

      expect(await screen.findByText(SENTENCE)).toBeInTheDocument()
      expect(screen.queryByText(/Sent on the hour/)).not.toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('On for this device.')
    })

    it('goes back to the usual line as soon as one is switched on again', async () => {
      await setup()
      await screen.findByText(SENTENCE)

      fireEvent.click(within(when()).getByRole('switch', { name: 'Log your morning' }))

      await waitFor(() => expect(screen.queryByText(SENTENCE)).not.toBeInTheDocument())
      expect(screen.getByText(/Sent on the hour, give or take a few minutes/)).toBeInTheDocument()
      expect(saved().map((r: { enabled: boolean }) => r.enabled)).toEqual([true, false, false])
    })

    it('still says to turn reminders on while they are off for this device', async () => {
      await setup(push({ isSubscribed: false }))
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())

      expect(screen.getByText('Turn reminders on to choose the times.')).toBeInTheDocument()
      expect(screen.queryByText(SENTENCE)).not.toBeInTheDocument()
    })
  })
```

And one more test, directly after the existing test `'switches one off
without touching the others'`, for the moment the last one goes off:

```ts
  it('says nothing will be sent the moment the last one is switched off', async () => {
    const twoOff = STORED.map((reminder) => ({ ...reminder, enabled: reminder.id === 'midday' }))
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ preferences: { reminder_times: twoOff } }) })) as unknown as typeof fetch
    await setup()
    await waitFor(() => expect(within(when()).getByRole('switch', { name: 'Log your afternoon' })).not.toBeChecked())
    expect(screen.getByText(/Sent on the hour/)).toBeInTheDocument()

    fireEvent.click(within(when()).getByRole('switch', { name: 'Log your morning' }))

    expect(await screen.findByText('All three are switched off, so nothing will be sent.')).toBeInTheDocument()
    expect(screen.queryByText(/Sent on the hour/)).not.toBeInTheDocument()
  })
```

`when` and `saved` are the helpers already defined at the top of that
`describe` block; the nested `describe` can use them. If a test fails only
because of timing, fix the waiting in the test (`findByText`, `waitFor`),
not the screen.

## Steps

1. `git branch --show-current` must print `dev`. If not, `git switch dev`.
2. Make the two edits in `src/app/settings/notifications/page.tsx`.
3. Add the four tests. Run `npm test -- reminders-screen` until green.
4. Run the full checks in "Done when".
5. Commit to `dev` as `/do-build` does. Do not push from the build.

## Rules that apply

- **Branches**: work on `dev`; never touch `main`.
- **Reminders**: who gets them is the push subscription, nothing else. "On
  for this device" is `push.isSubscribed`. Do not read `reminder_enabled`.
- **Principle 2, muted palette**: the sentence is neutral
  `text-muted-foreground`. It is not a warning colour.
- **Principle 3, minimal UI**: no new card, border, icon or button.
- **Principle 5, one type scale**: the line stays `text-xs
  text-muted-foreground`, 12px, with no opacity suffix.
- **Principle 8, no loading flash**: the line is computed from the
  `reminderTimes` state, which already starts from the `sessionStorage`
  cache. Add no spinner or loading state.

## Do not

- Do not change what is stored or sent: no edit to `save`, to the
  `/api/preferences` request, to `src/lib/reminders.ts`,
  `src/hooks/usePushNotifications.ts`, the cron job or any API route.
- Do not unsubscribe the device, or switch a time back on, when all three
  are off. The person switched them off; the screen only says so.
- Do not change the top status line ("On for this device." and its other
  wordings), the Turn on / Turn off button, "Send a test" and its note,
  "Show me how", the header, the "When" heading, or the rows, their
  dimming and their disabled states.
- Do not change "Turn reminders on to choose the times." or when it shows,
  or the wording of the usual "Sent on the hour…" line.
- Do not change the line's classes or position.
- Do not change any existing test.
- Do not edit `CLAUDE.md`, `docs/reviews/open.md` or
  `docs/BUSINESS-CONTEXT.md`.
- Do not merge, and do not touch `main`.

## Done when

- `npx tsc --noEmit` is clean.
- `npm test` passes, with four more tests than before (the ones above).
- `npm run test:tz` passes.
- `npm run lint` stays at its current count (0 errors, 54 warnings when
  this was planned; run it before editing to confirm the starting count).
- `npm run build` succeeds.
- In the app, More → Reminders, with reminders on for this device:
  - switch all three times off: the small line under the list reads "All
    three are switched off, so nothing will be sent." and the top line
    still reads "On for this device.";
  - switch any one back on: the line reads "Sent on the hour, give or take
    a few minutes, and skipped when you have already logged that part of
    the day." again;
  - leave all three off, press "Turn off": the line reads "Turn reminders
    on to choose the times.";
  - everything else on the screen looks as it did.

## Not decided

Nothing.

The request says dev is pushed when done. `/do-build` commits and does not
push; the push belongs to `/do-all` at the end of a clean run.

## Who should build and review this

- **Build with Haiku.** One constant, one extra branch in a ternary and
  four tests, each written out in full above; there is no decision left
  in it.
- **Review with Opus.** What can go wrong is the condition (the sentence
  showing on a device that is off, or the usual line lost when one time is
  on), which is ordinary logic on one screen. No reminder is sent
  differently and no data is touched, so Fable is not needed.
- **Effort: low for both.** The edits are given exactly, and the review is
  one condition and four tests to read against this brief.
