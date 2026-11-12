# Going to market

Written 12 November 2026. An earlier draft of this document aimed at exam
candidates; that was my suggestion, and it was the wrong reading of what the
app is for. The audience below is the owner's.

Figures marked **(vendor)** come from the company's own page;
**(third-party)** from comparison sites and blogs, which disagreed with each
other often enough that each should be checked before it is relied on.

## Who it is for

> People who want their life to have a structure, and who care — more than
> most — about *when* is the best time to do each thing.

They read about circadian rhythm and deep work. Many wear a WHOOP or an
Oura. They have tried time-blocking and a habit tracker and a calendar
tool, and what they actually want is one answer to "what should this hour
be for, and why?"

They are easy to find and they pay for this. r/Biohackers has roughly
750,000–880,000 members and r/HubermanLab about 245,000; r/QuantifiedSelf
is small, about 27,000, but is the most exactly on target
**(third-party, approximate)**.

## What they can buy today, and what none of it does

| | What it does | Price | What is missing |
|---|---|---|---|
| **RISE** | Predicts your energy peaks and dips from your sleep | $69.99/yr, no free tier **(vendor)** | Tells you the curve; does not plan the day, and does not record what you did with it |
| **Lifestack** | Builds an energy curve from wearable data and schedules tasks into it | $7/mo or $50/yr, $120 lifetime **(vendor blog)** | Reviewers call it close to useless without a wearable |
| **Owaves, Timefuel, Kairos, Peaks** | Chronotype or "body clock" day planners | mostly cheap or free | Thin on evidence — one estimates your chronotype from your birth date |
| **Motion, Reclaim, Sunsama, Akiflow** | Schedule work tasks around meetings | about $10–34/mo **(third-party)** | No idea what kind of hour it is; work only |
| **WHOOP, Oura** | Score recovery, sleep and strain | $199–359/yr; $69.99/yr **(third-party)** | Measure the body; say nothing about the day's plan |

The gap between them is Better's position:

1. **The whole day, not just sleep or just work.** Focus, the body and
   people, on one page.
2. **It says why, with the source.** Every suggested hour carries its
   reason and the study behind it. For an audience that has been sold a
   great many protocols, a tool that shows its evidence — and admits where
   the evidence is thin — is the differentiator, not a detail.
3. **No wearable required.** It learns your usual hours and when you wake
   from your own log.
4. **It closes the loop.** Plan, do, record, review. The others stop at the
   recommendation.
5. **It works around your real calendar** and never writes to it.

## What the product needs for this audience

It already suggests times with reasons, learns your habits and cites its
research. Three things were missing that this audience will look for first.
All three are now built (November 2026); they are kept here because they
are also the three things the homepage should show.

1. **Windows that move with you.** The ideal-day table is in clock time:
   deep work from nine, exercise at five. Someone who wakes at five, or at
   ten, is being given another person's day. The app already learns when
   you wake; the windows should be anchored to that. This is the single
   most important change, and it needs no database work.
2. **Today's windows, shown.** The answer to "what is this hour best for?"
   as a view of its own: peak focus, the post-lunch dip, the physical peak,
   wind-down — for *your* day, each with its reason. Today it only appears
   as a line of text on a suggestion. For this audience it is the front
   door.
3. **Whether you used them.** In the review: "70% of your deep work fell
   inside your peak hours." Stated as a fact, not a fourth score. Both
   reviews carry it as time — "2h of 3h" — for focused work, exercise and
   time with people, with a note that it is a guide and not a mark.

Later, in rough order: a deeper library (caffeine, light, meals, naps,
sleep regularity) with the strength of each finding labelled honestly;
sleep imported from a wearable; and small self-experiments ("deep work at
ten against two, for a fortnight").

One caution that belongs in the product, not just here: circadian findings
are averages across people. The app should keep saying so, and keep letting
a person's own log outrank the textbook. Overclaiming is how this category
loses the trust of exactly these users.

## Branding

- **Promise.** "The right hour for everything." Or, shorter: "Know when."
- **Stance.** Evidence, not protocols. Every number has a source; 100 is
  out of reach on purpose; your own pattern beats the average.
- **Voice.** The one the app already has — plain, dry, never guilt-inducing.
  Not hustle, and not wellness.
- **Mark.** The three rings, and the day's curve.
- **Name.** "Better" cannot be searched for and sits beside Better.com,
  BetterHelp, BetterUp and BetterMe. Choose a distinctive one before
  anything public and have trademarks checked properly; I have not checked
  any. Criteria: short, says something about time or rhythm rather than
  productivity, a domain you can own, clear in the App Store's health and
  productivity categories.

## Monetization

This audience is anchored at $50–70 a year for a single-purpose app (RISE,
Oura, Lifestack) and far more for hardware.

- **Free:** logging, the three rings, Next up, the daily review, and the
  whole of The Science. The research is the marketing; do not put it
  behind a wall.
- **Paid, about $59–69 a year or $7–8 a month:** windows fitted to you,
  automatic planning around the calendar, the timing analysis, the weekly
  review and full history.
- **A lifetime price for early users**, around $120, while it is young.
- **A trial of the paid tier**, 14 days, started at the first plan.
- **No ads and no data sales**, stated on the pricing page.
- **Stripe on the web**: no store commission while it is a web app.

Do not charge until the retention number below holds.

## Before anyone outside your friends signs up

1. **Google verification.** The hard gate.
   - In *Testing*, only up to 100 listed users can sign in and each
     authorisation expires after seven days.
   - Published but unverified, an app asking for calendar access shows an
     "unverified app" warning and is capped at 100 users over its lifetime.
   - Calendar read access is a *sensitive* scope, not a *restricted* one,
     so there is no paid security assessment — but verification needs a
     homepage on a domain you own, a privacy policy, and a video of the
     consent flow and what the access is used for.
   - Google quotes 3–5 business days in one place and 10 in another;
     developers report weeks when something is sent back.
   Check which state your project is in today. If it is Testing, friends
   will be signed out every week.
2. **A homepage**, which verification requires and the content below needs.
3. **Export and delete-account.** Built (November 2026): More → Export your
   data, More → Delete account, and the privacy page now says so. Deleting
   also hands back the app's Google access. Not yet run against the real
   database or a real Google token — do one end-to-end pass with a
   throwaway Google account before pointing anyone at it.
4. **The name.**
5. **iPhone install.** As a web app it has to be added to the Home Screen
   by hand from Safari's Share menu, and notifications only work once it
   is. Put the instruction in onboarding.

## Sequence

**1. Ten to twenty people you know who are like this.** Free. One number:
of those who finish onboarding, how many complete the loop — plan, do,
review — on four or more days in their second week. Under a third, fix the
product before telling anyone else.

**2. The question as the front door.** This audience searches for it
constantly: the best time to work out, to study, to drink coffee, to do
deep work. One page per question — a short answer, the studies, how strong
the evidence really is, and a small tool that turns a wake time into *your*
window. Each one is useful without the app and leads to it. I have not
measured search demand for these; treat it as the hypothesis to test first
with three or four pages.

**3. Communities, with something to show.** r/QuantifiedSelf first, where
people who build tools are welcome; then r/HubermanLab and r/Biohackers,
where an advert will be removed and a careful, cited post will not. A
"Show HN" suits a planner that cites its sources. Product Hunt after that.

**4. January.** Structure-seekers start in the first week of the year.
That is seven weeks away: enough for the windows work, the homepage and
verification if verification is started now, not enough for a rename and a
native app as well.

**5. No paid acquisition** until step 1's number holds and people are
paying.

## What could sink it

- **The science is softer than the category pretends.** Guard against it
  by labelling evidence honestly; it is also the position.
- **RISE and Lifestack are ahead on wearables.** Do not fight there. Win on
  the whole day, the evidence and the loop.
- **These users try everything and keep little.** Retention is the whole
  game, which is why the sequence starts with it.
- **Google verification stalls.** It is the one item on the critical path
  you do not control; start early.
- **The log is private and readable by you.** Export, delete and a plain
  privacy page are the minimum; see `docs/LOGGING-AND-PRIVACY.md`.
- **One person.** Every stage above is sized for evenings.

## A segment for later

People studying for professional exams around a full-time job are this
audience with a deadline: hundreds of hours to place, and strong feelings
about when they study best. An exam target with a pace line would serve
them. It is a second market, not the first.

## Sources

- Google: [production readiness overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview) · [manage app audience](https://support.google.com/cloud/answer/15549945?authuser=7) · [sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification?authuser=0) · [OAuth app verification help](https://SUPPORT.GOOGLE.COM/cloud/answer/9110914) · [Nylas on costs and timelines](https://www.nylas.com/blog/google-oauth-app-verification/)
- Timing and energy apps: [RISE on what it costs and does](https://www.risescience.com/blog/rise-app-review) · [RISE vs Sleep Cycle](https://www.risescience.com/blog/rise-app-vs-sleep-cycle) · [Lifestack review, Saner.AI](https://www.saner.ai/blogs/lifestack-review) · [Lifestack review, MakerStack](https://makerstack.co/reviews/lifestack-review/) · [Lifestack on energy calendars](https://lifestack.ai/blog/energy-calendar) · [Lifestack vs Temporal](https://temporal.day/blog/lifestack-vs-temporal-2026) · [Owaves](https://apps.apple.com/app/id869648628) · [Kairos](https://apps.apple.com/app/id6759920668) · [Timefuel](https://apps.apple.com/gb/app/timefuel/id6757319084) · [Peaks](https://apps.apple.com/app/peaks-biorhythm-tracker/id6446705377)
- Schedulers: [Temporal comparison](https://temporal.day/blog/motion-vs-reclaim-vs-clockwise-vs-akiflow-vs-sunsama) · [Arch on Motion alternatives](https://blog.archcalendar.com/7-best-motion-alternatives-in-2026-ranked-by-price-and-control/)
- Wearables: [Oura membership cost](https://www.lilachbullock.com/oura-membership-cost/) · [WHOOP pricing compared](https://trackervs.com/pricing/whoop-pricing/)
- Communities: [r/Biohackers](https://thehiveindex.com/communities/r-biohackers/) · [r/HubermanLab](https://thehiveindex.com/communities/r-hubermanlab/) · [r/QuantifiedSelf](https://thehiveindex.com/communities/r-quantifiedself/)
- iPhone: [iOS web push requirements](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications) · [PWA limits on iOS](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
