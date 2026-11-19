# Review voice lines

Date: 2026-11-19. 45 lines, 3 per scenario. Each scenario is a read made by `dayRead` / `weekRead` from an invented log; the model was given `buildReadSystemPrompt` and `describeRead`.

Day params: `{"model":"gpt-4o-mini","max_tokens":120,"temperature":0.4}`
Week params: `{"model":"gpt-4o-mini","max_tokens":160,"temperature":0.4}`

| rule | kind | lines breaching |
|---|---|---|
| ungrounded | checker (any line fails) | 0 |
| nothing-advice | checker (any line fails) | 0 |
| cause | checker (any line fails) | 0 |
| empty | checker (any line fails) | 0 |
| absence-unsaid | checker (any line fails) | 0 |
| banned-word | checker | 0 |
| verdict | checker | 0 |
| exclamation | checker | 0 |
| question | checker | 0 |
| emoji | checker | 0 |
| score-talk | checker | 0 |
| relative-day | checker | 0 |
| advice | checker | 0 |
| correction | checker | 0 |
| hard-day | checker | 0 |
| false-absence | checker | 0 |
| day-absence | checker | 0 |
| absence-wording | checker | 0 |
| partial-week-absence | checker | 0 |
| label-read-back | checker | 0 |
| too-long | checker | 0 |
| list | checker | 0 |
| grounded | judge | 1 |
| no_evaluation | judge | 1 |
| no_consolation | judge | 1 |
| no_advice | judge | 0 |

Lines breaching a rule that fails the run: 0. Lines breaching any other checker rule: 0 of 45 (limit 2). Lines failing any judge rule: 2.

## day: no-movement-three-days (change-no-movement)

- fact: No movement was logged on 3 days in a row: Sat 14 Nov, Sun 15 Nov and Mon 16 Nov.
- fact: In the four weeks before, movement was logged on 5 days, usually around 6:00 PM.
- fact: One option: Run at 6:00 PM.

> Movement was not logged on 3 days in a row: Sat 14 Nov, Sun 15 Nov and Mon 16 Nov. One option is to run at 6:00 PM.

- note: fine

> No movement was logged on 3 days in a row: Sat 14 Nov, Sun 15 Nov and Mon 16 Nov. One option: Run at 6:00 PM.

- note: fine

> Movement was not logged on 3 days in a row: Sat 14 Nov, Sun 15 Nov and Mon 16 Nov. One option is to run at 6:00 PM.

- note: fine

## day: focus-in-the-evenings (change-focus-outside-window)

- fact: On 3 days in a row, less than half of the focused work fell inside the focus windows (9:00 AM–12:00 PM and 2:00 PM–4:00 PM).
- fact: On this day it was 0m of 2h.
- fact: One option: Essay draft at 9:00 AM.

> On 3 days in a row, less than half of the focused work fell inside the focus windows. One option: Essay draft at 9:00 AM.

- note: The line lacks specific details about the day's focused work.

> On 3 days in a row, less than half of the focused work fell inside the focus windows. One option: Essay draft at 9:00 AM.

- note: The line lacks specific details about the day in question.

> On 3 days in a row, less than half of the focused work fell inside the focus windows. One option: Essay draft at 9:00 AM.

- note: The line lacks the specific time measurement for the day.

## day: long-focus-block (keep-long-focus)

- fact: The longest focused block was 2h 30m on "Thesis chapter", starting at 9:15 AM.
- fact: The usual longest block over the last four weeks is 1h.
- fact: It started inside the focus window (9:00 AM–12:00 PM).

> A focused block of 2h 30m on "Thesis chapter" started at 9:15 AM inside the focus window. The usual longest block over the last four weeks is 1h, and that hour is there to use again.

- note: fine

> A focused block of 2h 30m on "Thesis chapter" started at 9:15 AM and occurred inside the focus window. The usual longest block over the last four weeks is 1h, and that hour is there to use again.

- note: fine

> A focused block of 2h 30m on "Thesis chapter" started at 9:15 AM and was longer than the usual longest block of 1h over the last four weeks. The focus window is available again.

- note: fine

## day: movement-target-reached (keep-movement-target)

- fact: 70 moderate-equivalent minutes of movement, most of it "Run" at 5:30 PM, which reaches the movement target of 45.
- fact: The usual over the last four weeks is 0 minutes a day.
- fact: It fell inside the Physical peak window (5:00 PM–7:00 PM).

> Seventy moderate-equivalent minutes of movement, most of it "Run" at 5:30 PM, reached the movement target of 45. This activity fell inside the Physical peak window.

- note: fine

> Seventy moderate-equivalent minutes of movement were logged, most of it "Run" at 5:30 PM, which reached the movement target of 45. This activity fell inside the Physical peak window.

- note: fine

> Seventy moderate-equivalent minutes of movement occurred, mostly from a run at 5:30 PM, reaching the movement target of 45. This activity fell inside the Physical peak window.

- note: fine

## day: evening-with-family (keep-people-time)

- fact: 2h 30m with friends or family, the longest "Dinner with family" at 7:00 PM.
- fact: The usual over the last four weeks is 20 minutes a day.

> Two hours and thirty minutes were spent with friends or family, including the longest "Dinner with family" at 7:00 PM. The usual over the last four weeks is 20 minutes a day, so this hour is there to use again.

- judge: no_evaluation, no_consolation
- note: The line implies a positive evaluation of the time spent.

> Two hours and thirty minutes were spent with friends or family, including the longest "Dinner with family" at 7:00 PM. The usual over the last four weeks is 20 minutes a day to use again.

- note: fine

> Two hours and thirty minutes with friends or family included the longest "Dinner with family" at 7:00 PM. The usual over the last four weeks is 20 minutes a day, and that hour is there to use again.

- judge: grounded
- note: The line includes an invented fact about reusing the hour.

## day: ordinary-day (nothing-ordinary)

- fact: An ordinary day: nothing in it stands apart from the last four weeks.
- fact: Most of the logged time went to Deep Work (1h) and Shallow Work (45m).

> The day was ordinary. Most of the logged time went to Deep Work (1h) and Shallow Work (45m).

- note: fine

> The day was ordinary. Most of the logged time went to Deep Work (1h) and Shallow Work (45m).

- note: fine

> The day was ordinary. Most of the logged time went to Deep Work (1h) and Shallow Work (45m).

- note: fine

## day: ordinary-day-thin-history (nothing-ordinary)

- fact: An ordinary day. There is too little history yet to say what is usual.
- fact: Most of the logged time went to Shallow Work (1h 30m) and Errands (40m).

> It was an ordinary day. Most of the logged time went to Shallow Work for 1 hour and 30 minutes and Errands for 40 minutes.

- note: fine

> It was an ordinary day. Most of the logged time went to Shallow Work for 1 hour and 30 minutes and Errands for 40 minutes.

- note: fine

> It was an ordinary day. Most of the logged time went to Shallow Work for 1 hour and 30 minutes and Errands for 40 minutes.

- note: fine

## week: movement-on-one-day (week-change-movement-few-days)

- fact: Movement was logged on 1 of the 6 days.
- fact: In the four weeks before, it was logged on 5 days, usually around 6:00 PM.
- fact: One option: Run at 6:00 PM.

> Movement was logged on 1 of the 6 days. One option is to run at 6:00 PM.

- note: fine

> Movement was logged on 1 of the 6 days. One option is to run at 6:00 PM.

- note: fine

> Movement was logged on 1 of the 6 days. One option is to run at 6:00 PM.

- note: fine

## week: focus-outside-on-three-days (week-change-focus-outside-window)

- fact: On 3 days (Mon, Wed and Thu), less than half of the focused work fell inside the focus windows (9:00 AM–12:00 PM and 2:00 PM–4:00 PM).
- fact: Over the week it was 2h of 8h.
- fact: One option: Essay draft at 9:00 AM.

> This week covered 3 days. Less than half of the focused work fell inside the focus windows. One option was the essay draft at 9:00 AM.

- note: fine

> Over 3 days, less than half of the focused work fell inside the focus windows. It was 2h of 8h. One option: Essay draft at 9:00 AM.

- note: fine

> Over 3 days, less than half of the focused work fell inside the focus windows. It was 2h of 8h. One option: Essay draft at 9:00 AM.

- note: fine

## week: mind-on-target-early-starts (week-keep-focus-start)

- fact: Mind reached its target on Tue and Thu.
- fact: On both days focused work began around 9:15 AM.
- fact: On the other 2 days it did not reach it.

> Mind reached its target on Tue and Thu. Focused work began around 9:15 AM on both days. On the other 2 days it did not reach it.

- note: fine

> Mind reached its target on Tue and Thu. Focused work began around 9:15 AM on both days. On the other 2 days it did not reach it.

- note: fine

> Focused work reached its target on Tue and Thu. It began around 9:15 AM on both days. On the other 2 days it did not reach it.

- note: fine

## week: movement-target-four-days (week-keep-movement-days)

- fact: The movement target was reached on 4 days: Mon, Wed, Fri and Sat.
- fact: In the four weeks before, it was reached on 0 days in all.

> The movement target was reached on 4 days: Mon, Wed, Fri and Sat. The previous four weeks showed 0 days where the target was reached.

- note: fine

> The movement target was reached on 4 days: Mon, Wed, Fri and Sat. The previous four weeks had 0 days where the target was reached.

- note: fine

> The movement target was reached on 4 days: Mon, Wed, Fri and Sat. The previous four weeks saw the target reached on 0 days in all.

- note: fine

## week: ordinary-week (week-nothing-ordinary)

- fact: An ordinary week: its shape matches the four before it.
- fact: Heart reached its target on 1 day.

> It was an ordinary week. Heart reached its target on 1 day.

- note: fine

> It was an ordinary week. Heart reached its target on 1 day.

- note: fine

> It was an ordinary week. Heart reached its target on 1 day.

- note: fine

## week: keep-week-no-friends-or-family (week-keep-movement-days)

- fact: The movement target was reached on 3 days: Mon, Wed and Fri.
- fact: In the four weeks before, it was reached on 0 days in all.
- fact: Those sessions began around 6:00 PM.
- fact: No time with friends or family was logged this week.

> The movement target was reached on 3 days: Mon, Wed and Fri. Those sessions began around 6:00 PM. No time with friends or family was logged this week.

- note: fine

> The movement target was reached on 3 days: Mon, Wed and Fri. No time with friends or family was logged this week.

- note: fine

> The movement target was reached on 3 days: Mon, Wed and Fri. Those sessions began around 6:00 PM. No time with friends or family was logged this week.

- note: fine

## week: nothing-week-no-friends-or-family (week-nothing-ordinary)

- fact: An ordinary week: its shape matches the four before it.
- fact: No time with friends or family was logged this week.

> It was an ordinary week. No time with friends or family was logged this week.

- note: fine

> It was an ordinary week: its shape matches the four before it. No time with friends or family was logged this week.

- note: fine

> It was an ordinary week. No time with friends or family was logged this week.

- note: fine

## week: week-in-progress (week-nothing-ordinary)

- fact: The week is still in progress.
- fact: An ordinary week: its shape matches the four before it.

> It has been an ordinary week. The week is still in progress.

- note: fine

> It has been an ordinary week. Its shape matches the four before it. The week is still in progress.

- note: fine

> It has been an ordinary week. Its shape matches the four before it.

- note: fine

