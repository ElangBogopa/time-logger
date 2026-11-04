# Two open questions: the logging experience, and privacy

Written 4 Nov 2026, alongside the phone-frame and palette changes. Where a
claim is measured it says so; where it is judgement it says that too.

---

## 1. Why logging on the timeline feels finicky

It is not a tuning problem. These are the conditions in
`components/timeline/constants.ts` that must all be met to create one entry
by dragging:

| condition | value |
|---|---|
| hold still first | 100 ms |
| then hold | 400 ms |
| without moving more than | 5 px |
| then drag at least | 20 px |
| release before this and it is a tap instead | 150 ms |
| grab zone to resize an existing block | the top/bottom 20% of its height |

Half a second of stillness, within a 5-pixel box, on a surface that also
scrolls. On a 45px-per-hour timeline a 15-minute block is 11px tall, so the
resize zones are about 2px. Every one of those numbers exists to stop the
gesture firing by accident while scrolling — which is the tell: **the
timeline is a precision editing surface, and it is being used as the capture
surface.**

Capture and editing want opposite things. Capture wants one tap, no
precision, and no chance of failure. Editing wants exact times and direct
manipulation. Making one control do both is what produces the fidget.

### The split you suggested, made concrete

**The session view becomes capture.** *(Built.)* No dragging at all:

- The day so far as a list of blocks, newest at the bottom.
- **Gap rows.** *(Built — `lib/gaps.ts`.)* Between the last entry and now:
  "10:00 AM – 11:00 AM · 1h unaccounted" as a tappable row. Tap it and the
  quick-log sheet opens with those times already set; answer it and the row
  disappears. The day visibly closes up, and you are answering a question
  rather than operating a canvas. It never asks about the hours before the
  first thing you logged (the morning session starts at midnight), about
  time that has not happened yet, or about a stretch a calendar event
  already covers.
- **Chips above the keyboard**: the three suggestions `/api/suggestions`
  already returns (same weekday, same time, last four weeks), plus the
  repeat card that is already there. One tap, pre-filled times, done.
- **One "+" button** that opens the quick-log sheet with the start time
  already set to the end of the last entry, because that is the answer
  nine times out of ten.

**The calendar closes when you are not using it.** *(Built.)* The grid was
always open: 1080 pixels of mostly empty night in a 500-pixel window,
dominating the screen whether or not anything was being edited. The resting
state is now the day as one band — coloured for what was logged, dashed for
what is only planned, with a current-time mark — over a list of the day's
items you can tap to change. "Open" gives you the grid, cropped by
`lib/day-window.ts` to the hours that have something in them rather than all
twenty-four, with "show the whole day" a tap away.

**The calendar view is the planner.** *(Built.)* On a future date it says
"Plan Tomorrow" and carries a tray of that day's tasks that have no time
yet; tapping one gives it a time and it moves onto the grid. The dashboard's
YOUR PLAN section and the end of the day review both point at it — until
now nothing did.

**The calendar view stays precision.** *(Built — `/calendar`, which already
existed and was reachable only from Settings. The session view now links to
it for the day you are looking at.)* Drag, resize, ghost events, calendar
sync, planning ahead: a surface where a deliberate gesture is expected.

One thing to check when you are next signed in: in a stubbed harness the
calendar's timeline rendered as an empty panel — the hour labels are in the
DOM but painted outside their clipping box. Neutralising the phone-frame CSS
changed nothing, and the same component renders correctly in the session
view, so it is not the frame; it may be an artifact of the stub or a
pre-existing issue on that page.

### If the timeline stays in the session view

Three changes would fix most of it without the split:

1. **Tap an empty slot to create**, rather than hold-and-drag. A tap makes a
   30-minute block at that time; adjust it after. Nothing to hold, nothing
   to cancel.
2. **Explicit grab handles** on a selected block — a visible bar at each end
   — instead of invisible 20% edge zones that are 2px tall on short entries.
3. **Snap to 15 minutes** and show the time as you move, so the gesture
   cannot land on 11:03 and does not need to be precise.

**Plan against actual.** *(Built — `lib/plan-adherence.ts`.)* Whether a task
happened is recorded explicitly, because you tick it in the post-session
popup; what was never recorded is whether it happened *when you said it
would*. The day review now says "1 of 3 kept · 1 moved", and per task:
"Gym — planned 6:00 PM, you logged Netflix". A plan you did at another time
is **moved**, not missed, because calling it missed would be the app being
wrong about a day that went fine. Deliberately not a score: it replaced a
"Productivity 67%" headline with a progress bar that sat directly under
Body / Mind / Heart and read as a fifth metric.

My recommendation: do the split. The gap rows are the single highest-value
piece, and they work on their own, before any of the rest — which is why
they went in first. What is left of the split is moving the drag timeline
out of the session view into a calendar tab of its own.

---

## 2. Privacy: what you can see, and what to do about it

You are right to stop and think about this before sharing it. Time logs are
as revealing as a diary — "Therapy", "Job interview", "Argument with M" —
and today **you can read every word of every user's log** in the Supabase
dashboard. That is not a bug; it is how the app is built. Every table is
`FOR ALL USING (false)` with the server holding the service-role key, which
keeps *other users* out and leaves the operator — you — fully able to read.

There is a second thing worth knowing: entry text already leaves your
infrastructure. Categorisation, commentary and the reviews all send activity
names to OpenAI. Per OpenAI's API docs, that data is **not used to train
their models**, and abuse-monitoring logs are kept **up to 30 days** unless
you are approved for Zero Data Retention, which is not self-serve.

### What apps like this actually do

The pattern in privacy-first journaling apps (Standard Notes, Day One,
OwnJournal) is the same: **encrypt on the device with a key derived from a
password the server never sees.** The honest test of whether an app really
does this is the password reset — if support can restore your entries from
an email link, they hold your keys.

The catch for *this* app is that the product is the AI. A model cannot read
ciphertext. So the real question is not "should we encrypt" but "what does
the server need to see, and for how long".

### Four tiers, cheapest first

**Tier 1 — stop being able to read it casually.** No schema change.
- Don't browse production data; if you need to debug, query by your own
  user id.
- Audit what leaks into logs: `console.error` calls that include entries,
  and Sentry, which can capture request bodies.
- Write down the policy in the app, so friends know what you can see. This
  is the honest minimum before sharing it with anyone.

**Tier 2 — encrypt the sensitive columns at rest, server-side.** `activity`,
`description` and `commentary` encrypted with a key in a KMS, decrypted in
memory by the API. Protects against a database dump, a stolen backup, a
Supabase breach and casual browsing. Does **not** protect against you, and
does not change a line of product behaviour. This is the best
effort-to-protection ratio on the list.

**Tier 3 — client-side encryption of the free text only.** The structural
insight: the app's scoring does not need the words. Body, Mind and Heart,
the week, the year grid — all of it runs on `category`, `duration_minutes`
and times. So:

- Encrypt `activity`, `description`, `commentary` in the browser.
- Keep `category`, duration and times in plaintext, because that is what the
  metrics read.
- Categorisation happens **ephemerally at log time**: the client posts the
  text, the server asks the model, returns the category, stores nothing.
- Commentary becomes client-initiated: the client sends the day's text when
  you ask for a remark, and the server stores the reply encrypted.

You keep every number, the grid, the trends. You lose the nightly cron that
pre-generates commentary, any server-side search, and push notifications
that quote an activity by name. And you inherit the hard part: **lose the
password and the entries are gone**, so this needs a recovery key the user
saves somewhere.

**Tier 4 — don't hold the data.** Each person runs their own instance, or
brings their own storage. Highest privacy, no product.

### What I would do

**Tier 1 now**, before sharing it with a single friend: it costs an hour and
it is the difference between "I could read your diary" and "I have arranged
not to".

**Tier 2 next**, because it is invisible to the product and removes the
whole class of "the database leaked" risk.

**Tier 3 only if this goes past friends.** It is a real architectural
change — key management, recovery, reworking three AI paths and both cron
jobs — and it would be a mistake to take it on while the thing is still
finding its shape.

Whatever you pick, say it plainly in the app. The category of user who cares
about this cares more about an accurate answer than a reassuring one.

---

## Sources

- OpenAI, [API data controls](https://developers.openai.com/api/docs/guides/your-data)
  — no training on API data by default; abuse logs up to 30 days; ZDR by approval
- [Standard Notes](https://standardnotes.com/) — end-to-end encrypted notes
- [OwnJournal](https://ownjournal.app/) and its
  [source](https://github.com/Recsty-AB/ownjournal) — encrypt-on-device, user's own storage
- [Privacy-first journaling apps compared](https://medium.com/@didrik.hellman23/privacy-first-journaling-apps-how-the-main-options-actually-compare-7e21a316be2c)
  — the password-reset test for real zero-knowledge
- [Pseudonymization in AI](https://censinet.com/perspectives/pseudonymization-ai-protecting-patient-data)
  — key custody and segmented access when a service must read plaintext
- [WHOOP brand and design guidelines](https://developer.whoop.com/assets/files/WHOOP%20-%20Brand%20&%20Design%20Guidelines-bdea3554e94b4ea09e68695b1e8dc8e7.pdf)
  — black canvas, white text, a narrow set of data colours
- [WHOOP design breakdown](https://www.925studios.co/blog/whoop-design-breakdown)
  — why a dark, data-dense interface reads as simple
