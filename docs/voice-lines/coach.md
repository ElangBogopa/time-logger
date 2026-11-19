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
| empty | checker | 0 |
| invented-target | checker | 0 |
| ring-state | checker | 0 |
| no-plan | checker | 0 |
| plan-not-ahead | checker | 0 |
| looks-ahead | checker | 0 |
| grounded | judge | 2 |
| on-side | judge | 0 |
| no-scold | judge | 0 |
| forward | judge | 0 |
| not-premature | judge | 0 |

Lines with any checker breach: 0. Lines failing any judge rule: 2.

**Lines not true to their facts: 2 of 30** (a checker rule from invented-target, ring-state, no-plan, plan-not-ahead, looks-ahead, or the judge's `grounded`).

## The judge, checked against lines whose answer is known

Judge model: `gpt-4o`. 16 of 16 fixed lines got the right answer from the checker and the judge together. The judge by itself was right on 16.

| fixed line | true to its facts? | checker | judge | answer |
|---|---|---|---|---|
| entertainment-target | no (invented-target) | invented-target | not grounded: "entertainment target": There is no target for entertainment. | right |
| rest-target | no (invented-target) | invented-target | not grounded: "all of it toward your rest target": Nothing has a target except a ring that a line names. | right |
| admin-target | no (invented-target) | invented-target | not grounded: "which reached its target for admin time": Nothing has a target except a ring that a line names. | right |
| missed-rings-called-open | no (ring-state) | ring-state | not grounded: "The Body and Mind targets are still open.": The facts say 'Body did not reach its target today' and 'Mind did not reach its target today', indicating they are not open. | right |
| as-planned-without-a-plan | no (no-plan) | no-plan | not grounded: "as planned": There is no fact indicating that tidying was planned. | right |
| no-plan-logged | no (no-plan) | no-plan | not grounded: "with no plan logged for today": There is no fact stating that there was no plan for today. | right |
| day-over-time-left-today | no (looks-ahead) | looks-ahead | not grounded: "but there is still time left today to engage in those areas.": The day of this session is over. No time is left in it. | right |
| day-over-time-left-in-the-day | no (looks-ahead) | looks-ahead | not grounded: "but there's still time left in the day": The day of this session is over. No time is left in it. | right |
| plan-not-done-still-offered | no (plan-not-ahead) | plan-not-ahead | not grounded: "You could still make that call to Mum": The 'Plan not done' line indicates that the time for the call has passed, and there is no 'Still ahead' line suggesting it can still be done. | right |
| two-open-rings-named | yes | nothing | grounded | right |
| rings-all-still-open | yes | nothing | grounded | right |
| the-rings-are-all-still-open | yes | nothing | grounded | right |
| no-body-or-mind-target-met | yes | nothing | grounded | right |
| no-rings-reached | yes | nothing | grounded | right |
| twelve-hour-clock | yes | nothing | grounded | right |
| minds-own-target | yes | nothing | grounded | right |

## session: morning-mind-reaches-target

- Session: Morning. Logged: 4 hours across 1 activity.
- Activities: "Essay draft" (Deep Work) 09:00–13:00, 4 hours.
- Time by kind: Deep Work 4 hours.
- Body is still open: 0 of 45 moderate-equivalent exercise minutes so far.
- Mind reached its target in this session (240 of 240 focused minutes).
- Heart is still open: 0 of 60 minutes with friends or family so far.
- Hours that suit it: 3 hours of 4 hours of focused work fell in the hours that suit it.
- Still ahead later today: the Afternoon session; the Evening session; planned "Read" at 21:00; The dip 13:00–14:00; Second wind 14:00–16:00; Taking things in 16:00–17:00.

> Mind reached its target with 240 focused minutes logged on the "Essay draft" activity. You also have time left for Body and Heart today, with 45 minutes of moderate-equivalent exercise and 60 minutes with friends or family still open. The planned "Read" at 21:00 is still ahead.

- note: fine

> You reached your Mind target with 240 focused minutes on your essay draft from 09:00 to 13:00. Three of those focused hours landed in the hours that suit you. You still have time for the planned "Read" at 21:00 later today.

- note: fine

> You reached your Mind target with 240 focused minutes logged during the session on your essay draft. There’s still time for Body and Heart activities later today, along with your planned reading at 21:00.

- note: fine

## session: quiet-afternoon-plan-upcoming

- Session: Afternoon. Logged: 2 hours 15 minutes across 2 activities.
- Activities: "Nap" (Rest) 14:00–14:45, 45 minutes; "Watching TV" (Entertainment) 15:00–16:30, 1 hour 30 minutes.
- Time by kind: Entertainment 1 hour 30 minutes, Rest 45 minutes.
- Body is still open: 0 of 45 moderate-equivalent exercise minutes so far.
- Mind is still open: 0 of 240 focused minutes so far.
- Heart is still open: 0 of 60 minutes with friends or family so far.
- Still ahead later today: the Evening session; planned "Evening run" at 19:00; Physical peak 17:00–19:00; People 19:00–21:00; Wind-down 21:00–22:00.

> You logged 2 hours and 15 minutes today, including a 45-minute nap and 1 hour and 30 minutes of watching TV. All rings for Body, Mind, and Heart are still open, with no minutes logged towards their targets yet. You have the opportunity to go for your planned evening run at 19:00.

- note: fine

> In this session, you logged 2 hours and 15 minutes, including 45 minutes of rest with a nap and 1 hour and 30 minutes of watching TV. The Body, Mind, and Heart rings are still open, with time left to reach your targets. You have an evening run planned at 19:00, which could be a good fit for your physical peak.

- note: fine

> You logged 2 hours and 15 minutes today, with a solid block of rest from 14:00 to 14:45 and 1 hour and 30 minutes of entertainment. Body, Mind, and Heart still have minutes open, but the Evening run at 19:00 is still ahead.

- note: fine

## session: afternoon-plan-not-done

- Session: Afternoon. Logged: 45 minutes across 1 activity.
- Activities: "Emails" (Admin) 13:00–13:45, 45 minutes.
- Time by kind: Admin 45 minutes.
- Body is still open: 0 of 45 moderate-equivalent exercise minutes so far.
- Mind is still open: 0 of 240 focused minutes so far.
- Heart is still open: 0 of 60 minutes with friends or family so far.
- Plan not done: "Call Mum" (15:00). Its time has passed.
- Still ahead later today: the Evening session; Physical peak 17:00–19:00; People 19:00–21:00; Wind-down 21:00–22:00.

> You logged 45 minutes for "Emails" in your admin time today. Body, Mind, and Heart targets are still open. Later, you can focus on the Evening session, particularly during your Physical peak from 17:00 to 19:00.

- note: fine

> You logged 45 minutes for "Emails," completing your admin work for the afternoon. Body, Mind, and Heart are all still open, with no minutes logged yet. You have the Evening session ahead, which is a great chance to focus on your physical activity or connect with people.

- note: fine

> In this session, you logged 45 minutes for the "Emails" activity, which keeps your Admin time on track. There are still open targets for Body, Mind, and Heart. Later today, you have the Evening session ahead, with time for Physical activities from 17:00 to 19:00.

- judge: grounded
- note: "which keeps your Admin time on track": There is no target for Admin time in the facts.

## session: evening-heart-reaches-target

- Session: Evening. Logged: 1 hour 30 minutes across 1 activity.
- Activities: "Dinner with family" (Social) 18:30–20:00, 1 hour 30 minutes.
- Time by kind: Social 1 hour 30 minutes.
- Body did not reach its target today: 0 of 45 moderate-equivalent exercise minutes.
- Mind did not reach its target today: 36 of 240 focused minutes.
- Heart reached its target in this session (90 of 60 minutes with friends or family).
- Hours that suit it: 1 hour of 1 hour 30 minutes of time with people fell in the hours that suit it.
- Still ahead tomorrow: the Morning session; Morning movement 06:00–08:00; Plan and refuel 08:00–09:00.

> Your Heart ring reached its target with 90 minutes spent having dinner with family. You logged 1 hour and 30 minutes of social time during the evening, which aligns with the hours that suit it. Tomorrow, you have the opportunity for Morning movement from 06:00 to 08:00.

- note: fine

> Your Heart reached its target during dinner with family, logging 90 minutes of quality time. Body and Mind did not reach their targets today. Tomorrow opens up the possibility for Morning movement and a chance to refuel.

- note: fine

> You reached your Heart target during dinner with family, logging 90 minutes of quality time. While Body and Mind did not meet their targets today, you did spend 1 hour of your time with others in the hours that suit it. Tomorrow, the Morning movement session opens up the possibility for some physical activity.

- note: fine

## session: thin-evening

- Session: Evening. Logged: 20 minutes across 1 activity.
- Activities: "Tidying" (Chores) 19:00–19:20, 20 minutes.
- Time by kind: Chores 20 minutes.
- Body did not reach its target today: 0 of 45 moderate-equivalent exercise minutes.
- Mind did not reach its target today: 0 of 240 focused minutes.
- Heart did not reach its target today: 0 of 60 minutes with friends or family.
- Still ahead tomorrow: the Morning session; Morning movement 06:00–08:00; Plan and refuel 08:00–09:00.

> You logged 20 minutes of tidying during your evening session. Body, Mind, and Heart did not reach their targets today. Tomorrow, the morning session opens up the possibility for movement time and planning.

- note: fine

> You logged 20 minutes tidying during the evening. The Body, Mind, and Heart rings did not reach their targets today. Tomorrow includes the opportunity for Morning movement and a plan to refuel.

- note: fine

> You logged 20 minutes tidying, but none of the rings reached their targets today. Tomorrow has the Morning session ahead, which includes time for Morning movement and a chance to plan and refuel.

- note: fine

## session: earlier-day

- Session: Afternoon. Logged: 3 hours 30 minutes across 2 activities.
- Activities: "Study" (Learning) 13:00–15:00, 2 hours; "Watching TV" (Entertainment) 15:00–16:30, 1 hour 30 minutes.
- Time by kind: Learning 2 hours, Entertainment 1 hour 30 minutes.
- Body did not reach its target today: 0 of 45 moderate-equivalent exercise minutes.
- Mind did not reach its target today: 108 of 240 focused minutes.
- Heart did not reach its target today: 0 of 60 minutes with friends or family.
- The day of this session is over. No time is left in it.

> In this session, you logged 3 hours and 30 minutes across two activities, with 2 hours spent on studying and 1 hour and 30 minutes on watching TV. None of the targets for Body, Mind, or Heart were reached today.

- note: fine

> In this session, you logged 3 hours and 30 minutes across two activities: 2 hours of study and 1 hour and 30 minutes of watching TV. None of the targets for Body, Mind, or Heart were reached today.

- note: fine

> In this session, you logged 3 hours 30 minutes across two activities, with 2 hours dedicated to studying and 1 hour 30 minutes for watching TV. None of the targets for Body, Mind, or Heart were reached today.

- note: fine

## entry: entry-tv

- Activity: "Watching TV" (Entertainment) 15:00–16:30, 1 hour 30 minutes.
- Logged today so far: 1 hour 30 minutes.
- Entertainment entries today, this one included: 1.
- Rings: this activity counts toward none of Body, Mind or Heart. It has no target.

> You logged an hour and a half of TV watching this afternoon, adding a nice break to your day.

- note: fine

> You enjoyed 1 hour and 30 minutes of TV from 3:00 PM to 4:30 PM.

- note: fine

> You spent an hour and a half watching TV this afternoon, adding some relaxation to your day.

- note: fine

## entry: entry-gym-takes-body-to-target

- Activity: "Gym" (Exercise) 07:00–07:45, 45 minutes.
- Logged today so far: 9 hours 40 minutes.
- Exercise entries today, this one included: 1.
- With this, Body reached its target for today.

> The gym session added 45 minutes, reaching Body's target for today.

- note: fine

> The gym session at 07:00 added to Body and reached its target for today.

- note: fine

> The gym session at 07:00 added 45 minutes, reaching Body's target for today.

- note: fine

## entry: entry-nap

- Activity: "Nap" (Rest) 14:00–14:45, 45 minutes.
- Logged today so far: 45 minutes.
- Rest entries today, this one included: 1.
- Rings: this activity counts toward none of Body, Mind or Heart. It has no target.

> You took a 45-minute nap at 2 PM, giving yourself a solid rest today.

- note: fine

> You took a 45-minute nap at 2:00 PM, adding some much-needed rest to your day.

- note: fine

> You took a 45-minute nap today at 2 PM, adding some much-needed rest to your day.

- note: fine

## entry: entry-third-hour-meetings

- Activity: "Project sync" (Meetings) 15:00–16:00, 1 hour.
- Logged today so far: 3 hours.
- Meetings entries today, this one included: 3.
- Toward Mind: 90 of 240 focused minutes today.

> The "Project sync" meeting contributed focused minutes to your Mind, adding to your total so far.

- note: fine

> The meeting from 15:00 to 16:00 added one hour toward your Mind's target.

- note: fine

> The "Project sync" meeting at 15:00 added an hour toward your Mind target, keeping you on track.

- judge: grounded
- note: "keeping you on track": The facts do not state that the Mind target is on track or met.

