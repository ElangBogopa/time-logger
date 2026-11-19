# Coach voice lines

Date: 2026-11-19. 30 lines, 3 per scenario.

Session params: `{"model":"gpt-4o-mini","max_tokens":150,"temperature":0.7}`
Entry params: `{"model":"gpt-4o-mini","max_tokens":40,"temperature":0.7}`

| rule | kind | lines breaching |
|---|---|---|
| banned-word | checker | 0 |
| scold | checker | 0 |
| score-number | checker | 0 |
| emoji | checker | 0 |
| exclamation | checker | 0 |
| too-long | checker | 0 |
| looks-ahead | checker | 0 |
| empty | checker | 0 |
| grounded | judge | 7 |
| on-side | judge | 0 |
| no-scold | judge | 0 |
| forward | judge | 0 |
| not-premature | judge | 0 |

Lines with any checker breach: 0. Lines failing any judge rule: 7.

## session: morning-mind-reaches-target

- Session: Morning. Logged: 4 hours across 1 activity.
- Activities: "Essay draft" (Deep Work) 09:00–13:00, 4 hours.
- Time by kind: Deep Work 4 hours.
- Body is still open: 0 of 45 moderate-equivalent exercise minutes so far.
- Mind reached its target in this session (240 of 240 focused minutes).
- Heart is still open: 0 of 60 minutes with friends or family so far.
- Hours that suit it: 3 hours of 4 hours of focused work fell in the hours that suit it.
- Still ahead later today: the Afternoon session; the Evening session; planned "Read" at 21:00; The dip 13:00–14:00; Second wind 14:00–16:00; Taking things in 16:00–17:00.

> You logged 4 hours of Deep Work on your essay draft and reached your Mind target with 240 focused minutes. There’s still time to engage with your Body and Heart later today, including your planned reading at 21:00.

- note: fine

> You reached your Mind target with 240 focused minutes while working on your essay draft. Four hours of Deep Work landed in the hours that suit it. There’s still the Evening session and a planned "Read" at 21:00 ahead.

- note: fine

> You reached your Mind target with 240 focused minutes spent on your essay draft, and 3 of your 4 hours of Deep Work landed in the hours that suit it. You still have time for your planned "Read" at 21:00.

- note: fine

## session: quiet-afternoon-plan-upcoming

- Session: Afternoon. Logged: 2 hours 15 minutes across 2 activities.
- Activities: "Nap" (Rest) 14:00–14:45, 45 minutes; "Watching TV" (Entertainment) 15:00–16:30, 1 hour 30 minutes.
- Time by kind: Entertainment 1 hour 30 minutes, Rest 45 minutes.
- Body is still open: 0 of 45 moderate-equivalent exercise minutes so far.
- Mind is still open: 0 of 240 focused minutes so far.
- Heart is still open: 0 of 60 minutes with friends or family so far.
- Still ahead later today: the Evening session; planned "Evening run" at 19:00; Physical peak 17:00–19:00; People 19:00–21:00; Wind-down 21:00–22:00.

> You logged 2 hours and 15 minutes today, with a solid block of 1 hour and 30 minutes for watching TV. Both Body and Mind are still open, with no minutes logged towards their targets yet. You still have the chance for an evening run at 19:00, aligning with your physical peak.

- judge: grounded
- note: The claim about Body and Mind being open is incorrect.

> You logged 2 hours 15 minutes, including a 45-minute nap and 1 hour 30 minutes of watching TV. Body, Mind, and Heart are all still open, with time left for exercise, focused work, and connecting with others. The evening session still has the planned run at 19:00.

- note: fine

> You logged 2 hours 15 minutes today, with 45 minutes of rest for a nap and 1 hour 30 minutes watching TV. The Body, Mind, and Heart rings are all still open, leaving room for your evening run at 19:00, which aligns well with your physical peak.

- note: fine

## session: afternoon-plan-not-done

- Session: Afternoon. Logged: 45 minutes across 1 activity.
- Activities: "Emails" (Admin) 13:00–13:45, 45 minutes.
- Time by kind: Admin 45 minutes.
- Body is still open: 0 of 45 moderate-equivalent exercise minutes so far.
- Mind is still open: 0 of 240 focused minutes so far.
- Heart is still open: 0 of 60 minutes with friends or family so far.
- Plan not done: "Call Mum" (15:00).
- Still ahead later today: the Evening session; Physical peak 17:00–19:00; People 19:00–21:00; Wind-down 21:00–22:00.

> You logged 45 minutes on "Emails" in the Admin category. The Body, Mind, and Heart rings are all still open, with no time logged yet. You have the Evening session ahead, with a Physical peak at 17:00.

- note: fine

> You logged 45 minutes of Admin time for Emails. The Body, Mind, and Heart rings are still open, with no minutes logged yet. You have the Evening session ahead, with a Physical peak from 17:00 to 19:00.

- judge: grounded
- note: The claim about the rings being open is not fully accurate.

> You logged 45 minutes on emails, which is a solid chunk of Admin. The Body, Mind, and Heart rings are all still open, giving you time to engage in those areas. You could still make that call to Mum or connect with others in the evening session.

- judge: grounded
- note: The claim about the rings being 'all still open' is misleading.

## session: evening-heart-reaches-target

- Session: Evening. Logged: 1 hour 30 minutes across 1 activity.
- Activities: "Dinner with family" (Social) 18:30–20:00, 1 hour 30 minutes.
- Time by kind: Social 1 hour 30 minutes.
- Body did not reach its target today: 0 of 45 moderate-equivalent exercise minutes.
- Mind did not reach its target today: 36 of 240 focused minutes.
- Heart reached its target in this session (90 of 60 minutes with friends or family).
- Hours that suit it: 1 hour of 1 hour 30 minutes of time with people fell in the hours that suit it.
- Still ahead tomorrow: the Morning session; Morning movement 06:00–08:00; Plan and refuel 08:00–09:00.

> You reached your Heart target with 90 minutes of social time during dinner with family. Tomorrow, you'll have the chance to focus on Morning movement and refueling your plan.

- note: fine

> You reached your Heart target tonight with 90 minutes of time spent with family during dinner. While Body and Mind did not reach their targets, you did log 1 hour and 30 minutes in a suited time for social activity. Tomorrow's morning session offers a chance to focus on movement and planning.

- note: fine

> You had a solid dinner with family, reaching your Heart target with 90 minutes logged. While there was no Body or Mind target met today, the time spent in social connection was well-placed. Tomorrow offers the chance for Morning movement and a Plan session to set you up for the day ahead.

- judge: grounded
- note: The claim about Body and Mind targets not being met is misleading.

## session: thin-evening

- Session: Evening. Logged: 20 minutes across 1 activity.
- Activities: "Tidying" (Chores) 19:00–19:20, 20 minutes.
- Time by kind: Chores 20 minutes.
- Body did not reach its target today: 0 of 45 moderate-equivalent exercise minutes.
- Mind did not reach its target today: 0 of 240 focused minutes.
- Heart did not reach its target today: 0 of 60 minutes with friends or family.
- Still ahead tomorrow: the Morning session; Morning movement 06:00–08:00; Plan and refuel 08:00–09:00.

> You logged 20 minutes of tidying in the evening. No rings reached their targets today, but tomorrow offers the chance for morning movement from 06:00 to 08:00, which can help you make progress on your Body target.

- judge: grounded
- note: The mention of 'no rings reached their targets' is not grounded.

> You logged 20 minutes for tidying in the evening. Body, Mind, and Heart did not reach their targets today. Tomorrow presents the opportunity for morning movement and refueling your plans.

- note: The comment accurately reflects the session details.

> You logged 20 minutes doing "Tidying" from 19:00 to 19:20. None of the Body, Mind, or Heart rings reached their targets today. Tomorrow, the Morning session gives you a chance to focus on movement and planning.

- note: fine

## session: earlier-day

- Session: Afternoon. Logged: 3 hours 30 minutes across 2 activities.
- Activities: "Study" (Learning) 13:00–15:00, 2 hours; "Watching TV" (Entertainment) 15:00–16:30, 1 hour 30 minutes.
- Time by kind: Learning 2 hours, Entertainment 1 hour 30 minutes.
- Body did not reach its target today: 0 of 45 moderate-equivalent exercise minutes.
- Mind did not reach its target today: 108 of 240 focused minutes.
- Heart did not reach its target today: 0 of 60 minutes with friends or family.

> In this session, you logged 3 hours and 30 minutes across two activities, with 2 hours dedicated to studying. The Body, Mind, and Heart targets were not reached, but there is still time left today to engage in those areas.

- note: fine

> You logged 3 hours and 30 minutes across two activities this afternoon, with 2 hours dedicated to studying. Body, Mind, and Heart targets were not reached today.

- note: The comment accurately reflects the logged activities and targets.

> You logged 3 hours and 30 minutes across two activities, with 2 hours dedicated to studying. No targets were reached for Body, Mind, or Heart in this session, but there's still time left in the day.

- note: fine

## entry: entry-tv

- Activity: "Watching TV" (Entertainment) 15:00–16:30, 1 hour 30 minutes.
- Logged today so far: 1 hour 30 minutes.
- Entertainment entries today, this one included: 1.
- Rings: this activity counts toward none of Body, Mind or Heart. It has no target.

> You spent an hour and a half watching TV this afternoon, adding a nice break to your day.

- note: fine

> You spent an hour and a half watching TV this afternoon, adding a nice break to your day.

- note: fine

> You spent an hour and a half watching TV from 3:00 to 4:30, adding a nice break to your day.

- judge: grounded
- note: The time logged is incorrect.

## entry: entry-gym-takes-body-to-target

- Activity: "Gym" (Exercise) 07:00–07:45, 45 minutes.
- Logged today so far: 9 hours 40 minutes.
- Exercise entries today, this one included: 1.
- With this, Body reached its target for today.

> The gym session added 45 minutes to Body, reaching its target for today.

- note: fine

> The gym session this morning helped Body reach its target for today.

- note: fine

> The gym session this morning added 45 minutes to Body, reaching its target for the day.

- note: fine

## entry: entry-nap

- Activity: "Nap" (Rest) 14:00–14:45, 45 minutes.
- Logged today so far: 45 minutes.
- Rest entries today, this one included: 1.
- Rings: this activity counts toward none of Body, Mind or Heart. It has no target.

> You took a 45-minute nap at 14:00, adding valuable rest to your day.

- note: fine

> You took a solid 45-minute nap in the early afternoon, adding a refreshing break to your day.

- note: fine

> You took a 45-minute nap at 2 PM, adding valuable rest to your day.

- note: fine

## entry: entry-third-hour-meetings

- Activity: "Project sync" (Meetings) 15:00–16:00, 1 hour.
- Logged today so far: 3 hours.
- Meetings entries today, this one included: 3.
- Toward Mind: 90 of 240 focused minutes today.

> The "Project sync" meeting added another hour toward your focused Mind minutes today.

- note: fine

> "Project sync" added a solid hour toward your Mind focus, bringing you closer to your target.

- judge: grounded
- note: The target for Mind focus is not stated in the facts.

> "Project sync" added one hour of focused time, contributing to your Mind progress today.

- note: fine

