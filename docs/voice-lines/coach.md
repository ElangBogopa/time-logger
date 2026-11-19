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
| grounded | judge | 16 |
| on-side | judge | 0 |
| no-scold | judge | 0 |
| forward | judge | 0 |
| not-premature | judge | 0 |

Lines with any checker breach: 0. Lines failing any judge rule: 16.

## session: morning-mind-reaches-target

- Session: Morning. Logged: 4 hours across 1 activity.
- Activities: "Essay draft" (Deep Work) 09:00–13:00, 4 hours.
- Time by kind: Deep Work 4 hours.
- Body is still open: 0 of 45 moderate-equivalent exercise minutes so far.
- Mind reached its target in this session (240 of 240 focused minutes).
- Heart is still open: 0 of 60 minutes with friends or family so far.
- Hours that suit it: 3 hours of 4 hours of focused work fell in the hours that suit it.
- Still ahead later today: the Afternoon session; the Evening session; planned "Read" at 21:00; The dip 13:00–14:00; Second wind 14:00–16:00; Taking things in 16:00–17:00.

> In this session, you reached your Mind target with 240 focused minutes during your "Essay draft" activity. You also had 3 of your 4 hours of Deep Work in the hours that suit it. There's still time later today for your planned "Read" at 21:00.

- note: fine

> You've reached your target for focused minutes in this session with 240 logged during your deep work on the essay draft. Plus, you have three hours of your focused work in the hours that suit it. You still have the evening session ahead, along with your planned reading at 21:00.

- note: fine

> In this session, your Mind reached its target with 240 focused minutes while working on the "Essay draft" for 4 hours, which fell largely in the hours that suit it. Your Body and Heart are still open, with opportunities to engage in moderate exercise or time with friends and family later today. Consider the planned "Read" at 21:00 or the Afternoon session.

- judge: grounded
- note: The claim about Body and Heart being open is misleading as it implies a target was not reached.

## session: quiet-afternoon-plan-upcoming

- Session: Afternoon. Logged: 2 hours 15 minutes across 2 activities.
- Activities: "Nap" (Rest) 14:00–14:45, 45 minutes; "Watching TV" (Entertainment) 15:00–16:30, 1 hour 30 minutes.
- Time by kind: Entertainment 1 hour 30 minutes, Rest 45 minutes.
- Body is still open: 0 of 45 moderate-equivalent exercise minutes so far.
- Mind is still open: 0 of 240 focused minutes so far.
- Heart is still open: 0 of 60 minutes with friends or family so far.
- Still ahead later today: the Evening session; planned "Evening run" at 19:00; Physical peak 17:00–19:00; People 19:00–21:00; Wind-down 21:00–22:00.

> You logged 2 hours 15 minutes today, with 45 minutes for rest and 1 hour 30 minutes for entertainment. The Body, Mind, and Heart rings are still open, with a chance to work toward them later. You have an Evening run planned at 19:00, which could help meet your Body minutes.

- note: fine

> You logged 2 hours and 15 minutes in your session, with 45 minutes for rest and 1 hour and 30 minutes for entertainment. There’s still time to focus on your body with the planned evening run at 19:00.

- note: fine

> You logged 2 hours 15 minutes with 45 minutes of rest and 1 hour 30 minutes of entertainment. The body, mind, and heart have time left today to reach their targets. You still have the evening run planned at 19:00, which aligns well with your physical peak.

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

> You logged 45 minutes on "Emails" in the afternoon, which kept your Admin time on track. The plan to call Mum wasn't done. Later, you can focus on the Evening session between 17:00 and 19:00, where there’s an opportunity for physical activity.

- judge: grounded
- note: The claim about Admin time being 'on track' is invented.

> You logged 45 minutes for "Emails" in your Admin category. The plan to call Mum at 15:00 was not done. There’s still time later for the Evening session, so consider your Physical peak between 17:00 and 19:00.

- judge: grounded
- note: The line incorrectly states the plan was not done without referencing the 'Plan not done' line.

> You logged 45 minutes for "Emails," which kept you engaged in admin tasks. The plan to "Call Mum" was not done, but you still have time in the Evening session to connect with family or focus on some exercise.

- judge: grounded
- note: The comment inaccurately states that the plan to call Mum was not done without acknowledging it is still possible.

## session: evening-heart-reaches-target

- Session: Evening. Logged: 1 hour 30 minutes across 1 activity.
- Activities: "Dinner with family" (Social) 18:30–20:00, 1 hour 30 minutes.
- Time by kind: Social 1 hour 30 minutes.
- Body did not reach its target today: 0 of 45 moderate-equivalent exercise minutes.
- Mind did not reach its target today: 36 of 240 focused minutes.
- Heart reached its target in this session (90 of 60 minutes with friends or family).
- Hours that suit it: 1 hour of 1 hour 30 minutes of time with people fell in the hours that suit it.
- Still ahead tomorrow: the Morning session; Morning movement 06:00–08:00; Plan and refuel 08:00–09:00.

> You reached your heart target with 90 minutes of quality time during dinner with family. There was no plan logged for today, and the minutes for body and mind did not reach their targets. Tomorrow offers the chance to focus on morning movement and a plan to refuel.

- judge: grounded
- note: The claim about no plan logged is incorrect.

> You reached your heart target with 90 minutes spent on dinner with family, which fits well within your optimal hours. While body and mind targets were not reached today, there's still time ahead tomorrow for morning movement.

- note: fine

> You reached your heart target with 90 minutes of dinner with family, which fits perfectly in the hours that suit it. Body and mind targets weren’t reached today, but you still have time tomorrow for morning movement and planning. Tomorrow presents a chance to reset and refuel in the morning session.

- note: fine

## session: thin-evening

- Session: Evening. Logged: 20 minutes across 1 activity.
- Activities: "Tidying" (Chores) 19:00–19:20, 20 minutes.
- Time by kind: Chores 20 minutes.
- Body did not reach its target today: 0 of 45 moderate-equivalent exercise minutes.
- Mind did not reach its target today: 0 of 240 focused minutes.
- Heart did not reach its target today: 0 of 60 minutes with friends or family.
- Still ahead tomorrow: the Morning session; Morning movement 06:00–08:00; Plan and refuel 08:00–09:00.

> You logged 20 minutes for tidying, which is a solid contribution to your chores. There was no plan noted for today, and the targets for Body, Mind, and Heart remain ahead of you. Tomorrow offers the chance for morning movement and planning, which could set the tone for the day.

- judge: grounded
- note: The claim about no plan noted is incorrect.

> You logged 20 minutes for "Tidying" and kept your focus on chores. Tomorrow, the Morning session offers a chance for movement and planning, setting a solid foundation for the day ahead.

- note: fine

> You logged 20 minutes tidying in the evening, which counts towards chores. There was no plan kept today for movement, focused time, or connection with others, but tomorrow offers the chance for morning movement and planning.

- note: The lack of a plan kept is a concern.

## session: earlier-day

- Session: Afternoon. Logged: 3 hours 30 minutes across 2 activities.
- Activities: "Study" (Learning) 13:00–15:00, 2 hours; "Watching TV" (Entertainment) 15:00–16:30, 1 hour 30 minutes.
- Time by kind: Learning 2 hours, Entertainment 1 hour 30 minutes.
- Body did not reach its target today: 0 of 45 moderate-equivalent exercise minutes.
- Mind did not reach its target today: 108 of 240 focused minutes.
- Heart did not reach its target today: 0 of 60 minutes with friends or family.

> In this session, you logged 3 hours and 30 minutes across two activities. The time spent on "Study" reached its target for Learning, totaling 2 hours. The other activity was "Watching TV" for 1 hour and 30 minutes.

- judge: grounded
- note: The claim about reaching the target for Learning is incorrect.

> You logged 3 hours and 30 minutes today, with 2 hours dedicated to "Study" for Learning. The session included 1 hour and 30 minutes of "Watching TV" for Entertainment.

- note: fine

> In this session, you logged 3 hours and 30 minutes across two activities, with 2 hours dedicated to studying. While the session did not reach targets for body, mind, or heart, it clearly showed a commitment to learning.

- note: The targets for mind and heart were not met.

## entry: entry-tv

- Activity: "Watching TV" (Entertainment) 15:00–16:30, 1 hour 30 minutes.
- Logged today so far: 1 hour 30 minutes.
- Entertainment entries today, this one included: 1.

> Watching TV added 1 hour and 30 minutes of entertainment to your day so far.

- note: fine

> Watching TV added 1 hour and 30 minutes of entertainment to your day so far.

- note: fine

> This entertainment entry added 1 hour and 30 minutes towards your leisure target.

- judge: grounded
- note: The mention of a 'leisure target' is invented.

## entry: entry-gym-takes-body-to-target

- Activity: "Gym" (Exercise) 07:00–07:45, 45 minutes.
- Logged today so far: 9 hours 40 minutes.
- Exercise entries today, this one included: 1.
- With this, Body reached its target for today.

> The gym session at 07:00 added a ring to Body's target for today.

- judge: grounded
- note: The claim about adding a ring to Body's target is not supported by the facts.

> The gym session at 07:00 added 45 minutes, bringing Body to its target for today.

- note: fine

> The gym session added a ring to your Body target and took place early in the day.

- judge: grounded
- note: The claim about adding a ring is not supported by the facts.

## entry: entry-nap

- Activity: "Nap" (Rest) 14:00–14:45, 45 minutes.
- Logged today so far: 45 minutes.
- Rest entries today, this one included: 1.

> The 45-minute nap added a ring to your rest target and fits well into your day.

- judge: grounded
- note: The mention of a 'rest target' is invented.

> This 45-minute nap added a ring to your rest target today.

- judge: grounded
- note: The mention of a 'rest target' is invented.

> Your 45-minute nap added a ring to your rest target and fits well into your day.

- judge: grounded
- note: The mention of a 'rest target' is invented.

## entry: entry-third-hour-meetings

- Activity: "Project sync" (Meetings) 15:00–16:00, 1 hour.
- Logged today so far: 3 hours.
- Meetings entries today, this one included: 3.
- Toward Mind: 90 of 240 focused minutes today.

> The project sync added one focused hour toward your Mind target today.

- judge: grounded
- note: The claim about a Mind target is invented.

> This meeting added one hour toward your Mind target, bringing you to 90 focused minutes today.

- judge: grounded
- note: The claim about adding to a target is invented.

> The "Project sync" meeting added one hour toward your Mind target, bringing you to 90 focused minutes today.

- judge: grounded
- note: The claim about the Mind target is not supported by the facts.

