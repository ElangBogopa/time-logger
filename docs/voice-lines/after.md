# Review voice lines

Date: 2026-11-15. 60 lines, 3 per scenario.

Day params: `{"model":"gpt-4o-mini","max_tokens":150,"temperature":0.4}`
Week params: `{"model":"gpt-4o-mini","max_tokens":200,"temperature":0.4}`

| rule | kind | lines breaching |
|---|---|---|
| banned-word | checker | 1 |
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
| absence-unsaid | checker | 2 |
| partial-week-absence | checker | 0 |
| label-read-back | checker | 0 |
| too-long | checker | 2 |
| list | checker | 0 |
| empty | checker | 0 |
| no_evaluation | judge | 0 |
| grounded | judge | 0 |
| no_consolation | judge | 2 |
| no_advice | judge | 0 |
| one_suggestion | judge | 0 |
| total_not_judged | judge | 19 |

Lines with any checker breach: 5. Lines failing any judge rule: 19.

Full-week lines with no time with friends or family in the input: 12. Of those, lines that say "friends or family": 10.

## day: focus-heavy

- hours: Deep Work 240 min, Meals 60 min, Sleep 450 min
- focus session: 150 min on "Essay draft"
- plan: 3 kept, 0 moved, 0 missed
- scores (not shown to the model after the rewrite): Body 52, Mind 84, Heart 20

> The day included 7 hours and 30 minutes of sleep and 1 hour for meals. There were 4 hours of deep work, with a 2-hour and 30-minute focus session on the "Essay draft" and a longest focus session of 150 minutes on the same task. Three timed blocks were planned and all were kept.

- note: fine

> The day included 7 hours and 30 minutes of sleep and 1 hour for meals. There were 4 hours of deep work, with a 2-hour and 30-minute focus session on the essay draft, and the longest focus session was 150 minutes on the same task. Three timed blocks were planned and all were kept.

- note: fine

> The day included 7 hours and 30 minutes of sleep and 1 hour for meals. There were 4 hours of deep work, with a focus session of 2 hours and 30 minutes on the essay draft, which included a longest session of 150 minutes. Three timed blocks were planned and all were kept.

- note: fine

## day: full-day

- hours: Deep Work 180 min, Exercise 60 min, Social 120 min, Meals 90 min, Sleep 480 min
- mood: great
- scores (not shown to the model after the rewrite): Body 88, Mind 82, Heart 85

> The day included 8 hours of sleep and 3 hours of deep work. There were 2 hours of social activities and 1 hour of exercise, along with 1 hour and 30 minutes for meals. The evening mood was great.

- checker: banned-word ("great")
- note: fine

> The day included 8 hours of sleep and 3 hours of deep work. There were 2 hours of social activities and 1 hour of exercise. Meals took 1 hour and 30 minutes.

- note: fine

> The day included 8 hours of sleep and 3 hours of deep work. There were 2 hours spent on social activities and 1 hour of exercise. Meals took 1 hour and 30 minutes.

- note: fine

## day: thin

- hours: Shallow Work 45 min
- scores (not shown to the model after the rewrite): Body 20, Mind 25, Heart 5

> The day included 45 minutes of shallow work. Time tracked was 45 minutes.

- note: fine

> The day included 45 minutes of shallow work. Time tracked was 45 minutes.

- note: fine

> There were 45 minutes of shallow work logged. No other activities were recorded.

- note: fine

## day: leisure

- hours: Entertainment 300 min, Meals 60 min, Sleep 540 min
- scores (not shown to the model after the rewrite): Body 35, Mind 5, Heart 5

> The day included 9 hours of sleep and 1 hour for meals. There were 5 hours spent on entertainment. Time tracked was 15 hours.

- note: fine

> The day included 9 hours of sleep and 1 hour for meals. There were 5 hours spent on entertainment. Time tracked was 15 hours.

- note: fine

> The day included 9 hours of sleep and 5 hours of entertainment. One hour was spent on meals. Time tracked was 15 hours.

- note: fine

## day: low-mood

- hours: Deep Work 60 min, Entertainment 240 min
- mood: low
- scores (not shown to the model after the rewrite): Body 20, Mind 40, Heart 5

> The day included 4 hours of entertainment and 1 hour of deep work. The evening mood was low.

- note: fine

> The day included 4 hours of entertainment and 1 hour of deep work. The total time tracked was 5 hours. The evening mood was low.

- note: fine

> The day included 4 hours of entertainment and 1 hour of deep work. The evening mood was low.

- note: fine

## day: plan-missed

- hours: Meetings 240 min, Admin 90 min
- plan: 0 kept, 1 moved, 3 missed
- scores (not shown to the model after the rewrite): Body 15, Mind 30, Heart 10

> The day included 4 hours of meetings and 1 hour and 30 minutes of admin work. Four timed blocks were planned, with one completed at a different time and three not done. Time tracked was 5 hours and 30 minutes.

- note: fine

> Four hours were spent in meetings. One hour and thirty minutes were dedicated to admin tasks. Four timed blocks were planned; none were kept, one was done at another time, and three were not done.

- note: fine

> Four hours were spent in meetings. One hour and thirty minutes were allocated to admin tasks. Four timed blocks were planned; none were kept, one was done at another time, and three were not done.

- note: fine

## day: body-day

- hours: Exercise 120 min, Chores 120 min, Calls 45 min
- scores (not shown to the model after the rewrite): Body 80, Mind 10, Heart 45

> The day included 2 hours of exercise and 2 hours of chores. There were also 45 minutes spent on calls. Time tracked was 4 hours and 45 minutes.

- note: fine

> The day included 2 hours of exercise and 2 hours spent on chores. There were also 45 minutes dedicated to calls. Time tracked was 4 hours and 45 minutes.

- note: fine

> The day included 2 hours of exercise and 2 hours of chores. There were also 45 minutes spent on calls. Time tracked was 4 hours and 45 minutes.

- note: fine

## day: work-only

- hours: Deep Work 360 min, Shallow Work 120 min, Meals 30 min
- focus session: 200 min on "Quarterly model"
- scores (not shown to the model after the rewrite): Body 25, Mind 90, Heart 0

> The day included 6 hours of deep work, with the longest focus session lasting 200 minutes on the "Quarterly model." There were also 2 hours of shallow work and 30 minutes allocated for meals. Time tracked was 8 hours and 30 minutes.

- note: fine

> The day included 6 hours of deep work and 2 hours of shallow work. There was a 30-minute meal break. The longest focus session lasted 200 minutes on the "Quarterly model."

- note: fine

> The day included 6 hours of deep work, with the longest focus session lasting 200 minutes on the "Quarterly model." There were also 2 hours of shallow work and 30 minutes spent on meals. Time tracked totaled 8 hours and 30 minutes.

- note: fine

## day: sleep-only

- hours: Sleep 480 min
- scores (not shown to the model after the rewrite): Body 40, Mind 0, Heart 0

> The day included 8 hours of sleep. Time tracked was 8 hours.

- note: fine

> The day included 8 hours of sleep. A total of 8 hours was tracked.

- note: fine

> The day included 8 hours of sleep. Time tracked was 8 hours.

- note: fine

## day: even

- hours: Learning 150 min, Movement 30 min, Social 60 min, Rest 60 min
- mood: okay
- scores (not shown to the model after the rewrite): Body 45, Mind 55, Heart 50

> The day included 2 hours and 30 minutes of learning, 1 hour of social activities, and 1 hour of rest. There was also 30 minutes of movement. The evening mood was okay.

- note: fine

> The day included 2 hours and 30 minutes of learning and 1 hour of social activity. There was also 1 hour of rest and 30 minutes of movement. The evening mood was okay.

- note: fine

> The day included 2 hours and 30 minutes of learning, 1 hour of social activity, and 1 hour of rest. There was also 30 minutes of movement. The evening mood was okay.

- note: fine

## day: faith-day

- hours: Faith 60 min, Deep Work 180 min, Meals 60 min

> Three hours of deep work were logged. One hour was spent on faith activities, and one hour was dedicated to meals.

- note: fine

> Three hours of deep work were logged. One hour was spent on faith activities. One hour was dedicated to meals.

- note: fine

> Three hours of deep work were logged. One hour was dedicated to faith activities, and one hour was spent on meals. Time tracked for the day was five hours.

- note: fine

## day: meetings-and-faith

- hours: Meetings 240 min, Faith 30 min

> The day included 4 hours of meetings. There was also 30 minutes dedicated to faith activities. Time tracked was 4 hours and 30 minutes.

- note: fine

> The day included 4 hours of meetings and 30 minutes dedicated to faith. The total time tracked was 4 hours and 30 minutes.

- note: fine

> Four hours of meetings occurred. There was also 30 minutes dedicated to faith activities. Time tracked for the day was 4 hours and 30 minutes.

- note: fine

## week: full-week

- days covered: all 7; days with anything logged: 7
- hours: Sleep 52h, Deep Work 22h, Meetings 8h, Exercise 4h, Social 6h, Meals 9h, Entertainment 7h
- best days: Tuesday, Thursday; best hours: 9 AM, 10 AM

> This week held 22 hours of deep work, with best focus days on Tuesday and Thursday. The best focus hours were at 9 AM and 10 AM. You logged all seven days, with no hours unaccounted for. Consider scheduling more deep work during your best focus hours next week.

- judge: total_not_judged
- note: Total hours logged are judged.

> This week held 22 hours of deep work, with best focus days on Tuesday and Thursday. The best focus hours were logged at 9 AM and 10 AM. You could consider scheduling more deep work during those best focus hours next week.

- judge: total_not_judged
- note: Total hours logged are judged.

> This week included 22 hours of deep work, with the best focus days being Tuesday and Thursday. The best focus hours were logged at 9 AM and 10 AM. You logged 8 hours of meetings and 4 hours of exercise. Consider scheduling more deep work during the 9 AM hour on Tuesday.

- judge: total_not_judged
- note: Total hours logged are judged.

## week: focus-only

- days covered: all 7; days with anything logged: 7
- hours: Deep Work 38h, Shallow Work 10h, Sleep 44h, Meals 5h
- best days: Tuesday, Thursday; best hours: 8 AM, 9 AM

> This week held 38 hours of deep work and 10 hours of shallow work. You logged all seven days, with Tuesday and Thursday being your best focus days. Your best focus hours were consistently at 8 AM and 9 AM. You did not log any time with friends or family this week. 
> 
> You could consider scheduling some time with friends or family on Saturday.

- checker: too-long ("5 sentences")
- judge: total_not_judged
- note: The total hours logged were judged.

> This week included 38 hours of deep work and 10 hours of shallow work, with all seven days logged. The best focus days were Tuesday and Thursday, with the best focus hours at 8 AM and 9 AM. You logged no time with friends or family this week. You could consider scheduling some shallow work during your best focus hours on Tuesday.

- note: fine

> This week included 38 hours of deep work and 10 hours of shallow work. You logged all seven days, with Tuesday and Thursday identified as your best focus days. Your best focus hours were at 8 AM and 9 AM. You did not log any time with friends or family this week. 
> 
> Next week, you could consider scheduling more deep work during your best focus hours on Tuesday.

- checker: too-long ("5 sentences")
- judge: total_not_judged
- note: Total hours logged were praised.

## week: partial

- days covered: 3 of 7 (in progress); days with anything logged: 3
- hours: Deep Work 9h, Sleep 22h, Exercise 1h
- best days: Monday; best hours: 9 AM, 10 AM

> This week held three days of logging, with 9 hours of deep work recorded. The best focus day was Monday, with focused hours at 9 AM and 10 AM. You logged a total of 22 hours of sleep and 1 hour of exercise. You might consider scheduling additional focused work on Monday during the best focus hours.

- judge: total_not_judged
- note: The total hours logged are judged.

> This week held 9 hours of deep work, all logged on Monday during the best focus hours of 9 AM and 10 AM. Sleep accounted for 22 hours, and there was 1 hour of exercise. The best focus day was Monday, where all deep work occurred. You could consider logging additional activities on Tuesday or Wednesday.

- judge: total_not_judged
- note: The total hours logged are judged.

> This week held three days of logging, with a total of 9 hours of deep work. The best focus day was Monday, with the best focus hours at 9 AM and 10 AM. You logged 22 hours of sleep and 1 hour of exercise. Consider focusing on deep work during the best focus hours next Monday.

- judge: total_not_judged
- note: total hours logged are judged

## week: leisure-week

- days covered: all 7; days with anything logged: 7
- hours: Entertainment 30h, Sleep 60h, Meals 10h, Shallow Work 6h
- best days: Wednesday; best hours: 2 PM

> This week included 30 hours of entertainment, 60 hours of sleep, and 10 hours for meals. The best focus day was Wednesday, with the best focus hours logged at 2 PM. You logged no time with friends or family this week. You might consider planning some time with friends on a day when you have fewer hours logged for entertainment.

- judge: total_not_judged
- note: The total hours logged were judged.

> This week held 30 hours of entertainment, 60 hours of sleep, and 10 hours for meals. Wednesday was the best focus day. You might consider logging some time with friends or family on a day like Saturday.

- judge: total_not_judged
- note: Total hours logged are judged.

> This week held 30 hours of entertainment, 60 hours of sleep, and 10 hours for meals. Wednesday was your best focus day, with the best focus hours at 2 PM. You did not log any time with friends or family this week. You might consider scheduling some time for shallow work on Wednesday at 2 PM.

- judge: total_not_judged
- note: Total hours logged are criticized.

## week: thin-week

- days covered: all 7; days with anything logged: 2
- hours: Deep Work 3h, Meals 1h
- best days: Monday; best hours: 10 AM

> This week included 3 hours of deep work and 1 hour for meals. The best focus day was Monday, with the best focus hours logged at 10 AM. You could consider scheduling more deep work sessions on Monday at 10 AM next week.

- checker: absence-unsaid ("")
- note: fine

> This week included 3 hours of deep work, logged primarily on Monday during the best focus hour of 10 AM. Only two days had any time logged, and no time with friends or family was recorded. You could consider scheduling additional focused work on Monday at 10 AM next week.

- note: fine

> This week included 3 hours of deep work, all logged on Monday during the best focus hour of 10 AM. You logged 1 hour for meals. There were only 2 days with any time logged. You could consider adding more activities on Wednesday, as it currently has no logged hours.

- checker: absence-unsaid ("")
- note: fine

## week: sleep-heavy

- days covered: all 7; days with anything logged: 7
- hours: Sleep 63h, Rest 10h, Calls 3h, Chores 6h
- best days: none; best hours: none

> You logged 63 hours of sleep and 10 hours of rest this week. You also spent 3 hours on calls and 6 hours on chores. There is not enough data to determine your best focus days or hours. You might consider logging more focused work next week.

- judge: no_consolation, total_not_judged
- note: The reassurance about logging more focused work is unnecessary.

> You logged 63 hours of sleep, 10 hours of rest, 3 hours of calls, and 6 hours of chores. There is not enough data to identify best focus days or hours. You might consider logging focused work next week to capture more details.

- judge: no_consolation, total_not_judged
- note: The reassurance about logging focused work is a problem.

> You logged 63 hours of sleep, 10 hours of rest, 3 hours of calls, and 6 hours of chores this week. There is not enough data to determine your best focus days or hours. You could consider logging focused work hours on one of the days next week.

- note: fine

## week: meetings-week

- days covered: all 7; days with anything logged: 7
- hours: Sleep 50h, Deep Work 20h, Meetings 14h, Meals 7h
- best days: Tuesday, Thursday; best hours: 9 AM, 10 AM

> This week included 20 hours of deep work, with the best focus days being Tuesday and Thursday. The best focus hours were logged at 9 AM and 10 AM. You did not log any time with friends or family this week. You might consider scheduling some time with friends on the weekend.

- judge: total_not_judged
- note: The total hours logged were judged.

> This week included 20 hours of deep work, with best focus days on Tuesday and Thursday. The best focus hours were logged at 9 AM and 10 AM. No time with friends or family was logged this week. You could consider scheduling some time with friends on a weekend afternoon.

- judge: total_not_judged
- note: The suggestion to schedule time with friends is unnecessary.

> This week included 20 hours of deep work and 14 hours of meetings. You logged time on all seven days, with your best focus days being Tuesday and Thursday, and your best focus hours at 9 AM and 10 AM. You did not log any time with friends or family. You could consider scheduling a break or social activity on a day when you have fewer meetings.

- judge: total_not_judged
- note: The total hours logged are not judged.

## week: faith-week

- days covered: all 7; days with anything logged: 7
- hours: Sleep 52h, Deep Work 18h, Faith 5h, Meals 8h
- best days: Tuesday, Thursday; best hours: 9 AM, 10 AM

> This week included 18 hours of deep work, with best focus days on Tuesday and Thursday. The best focus hours were logged at 9 AM and 10 AM. You could consider scheduling more deep work during those best focus hours on Tuesday.

- judge: total_not_judged
- note: The total hours logged are judged.

> This week included 18 hours of deep work, with a focus on Tuesday and Thursday. You logged 5 hours for faith and 8 hours for meals. Your best focus hours were at 9 AM and 10 AM on those days. You could consider scheduling more deep work during those best focus hours next week.

- judge: total_not_judged
- note: The total hours logged are judged.

> This week held 18 hours of deep work, with best focus days on Tuesday and Thursday. The best focus hours were consistently at 9 AM and 10 AM. You logged 5 hours for faith and 8 hours for meals. You might consider scheduling more deep work during the best focus hours next week.

- judge: total_not_judged
- note: The total hours logged are judged.

