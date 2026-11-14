# Review voice lines

Date: 2026-11-14. 48 lines, 3 per scenario.

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
| too-long | checker | 0 |
| list | checker | 0 |
| empty | checker | 0 |
| no_evaluation | judge | 1 |
| grounded | judge | 2 |
| no_consolation | judge | 2 |
| no_advice | judge | 0 |
| one_suggestion | judge | 0 |
| total_not_judged | judge | 16 |

Lines with any checker breach: 1. Lines failing any judge rule: 19.

## day: focus-heavy

- hours: Deep Work 240 min, Meals 60 min, Sleep 450 min
- focus session: 150 min on "Essay draft"
- plan: 3 kept, 0 moved, 0 missed
- scores (not shown to the model after the rewrite): Body 52, Mind 84, Heart 20

> The day included 7 hours and 30 minutes of sleep and 4 hours of deep work, with a 2-hour and 30-minute focus session on the essay draft. Meals took 1 hour. Time with people: none logged.

- judge: grounded
- note: The focus session duration is incorrect.

> The day included 7 hours and 30 minutes of sleep. There were 4 hours of deep work, with a 2-hour and 30-minute focus session on the essay draft, and the longest focus session lasted 150 minutes. One hour was spent on meals, and no time with people was logged.

- note: fine

> The day included 7 hours and 30 minutes of sleep and 4 hours of deep work, with a 2-hour and 30-minute focus session on the essay draft. There was 1 hour spent on meals. Time with people: none logged.

- judge: grounded
- note: The focus session duration is incorrect.

## day: full-day

- hours: Deep Work 180 min, Exercise 60 min, Social 120 min, Meals 90 min, Sleep 480 min
- mood: great
- scores (not shown to the model after the rewrite): Body 88, Mind 82, Heart 85

> The day included 8 hours of sleep, 3 hours of deep work, and 2 hours of social time. There was also 1 hour and 30 minutes spent on meals and 1 hour of exercise.

- note: fine

> The day included 8 hours of sleep and 3 hours of deep work. There were 2 hours of social time, 1 hour and 30 minutes for meals, and 1 hour of exercise. The evening mood was great.

- checker: banned-word ("great")
- judge: no_evaluation
- note: The line implies a positive evaluation of the day.

> The day included 8 hours of sleep and 3 hours of deep work. There were 2 hours of social time, 1 hour and 30 minutes for meals, and 1 hour of exercise.

- note: fine

## day: thin

- hours: Shallow Work 45 min
- scores (not shown to the model after the rewrite): Body 20, Mind 25, Heart 5

> There was 45 minutes of shallow work logged. Time with people was not logged.

- note: fine

> There was 45 minutes of shallow work logged. Time with people: none logged.

- note: fine

> There was 45 minutes of shallow work logged. Time with people was not logged.

- note: fine

## day: leisure

- hours: Entertainment 300 min, Meals 60 min, Sleep 540 min
- scores (not shown to the model after the rewrite): Body 35, Mind 5, Heart 5

> The day included 9 hours of sleep and 1 hour for meals. There were 5 hours spent on entertainment. Time with people: none logged.

- note: fine

> The day included 9 hours of sleep and 1 hour for meals. There were 5 hours spent on entertainment. Time with people: none logged.

- note: fine

> The day included 9 hours of sleep and 5 hours of entertainment. There was 1 hour spent on meals. Time with people: none logged.

- note: fine

## day: low-mood

- hours: Deep Work 60 min, Entertainment 240 min
- mood: low
- scores (not shown to the model after the rewrite): Body 20, Mind 40, Heart 5

> Four hours of entertainment were logged. There was one hour of deep work. Time with people: none logged.

- note: fine

> The day included 4 hours of entertainment and 1 hour of deep work. There was no time with people logged. The evening mood was low.

- note: fine

> Four hours were spent on entertainment and one hour on deep work. There was no time with people logged. The evening mood was low.

- note: fine

## day: plan-missed

- hours: Meetings 240 min, Admin 90 min
- plan: 0 kept, 1 moved, 3 missed
- scores (not shown to the model after the rewrite): Body 15, Mind 30, Heart 10

> The day included 4 hours of meetings and 1 hour and 30 minutes of admin work. There was no time with people logged. Four timed blocks were planned, with one completed at a different time and three not done.

- note: fine

> The day included 4 hours of meetings and 1 hour and 30 minutes of admin work. There was no time with people logged. Four timed blocks were planned, with one completed at a different time and three not done.

- note: fine

> The day included 4 hours of meetings and 1 hour and 30 minutes of admin work. There was no time with people logged. Four timed blocks were planned, with one completed at a different time and three not done.

- note: fine

## day: body-day

- hours: Exercise 120 min, Chores 120 min, Calls 45 min
- scores (not shown to the model after the rewrite): Body 80, Mind 10, Heart 45

> The day included 2 hours of exercise and 2 hours of chores. There were also 45 minutes spent on calls. Time tracked was 4 hours and 45 minutes.

- note: fine

> The day included 2 hours of exercise and 2 hours spent on chores. There were also 45 minutes dedicated to calls. Time tracked was 4 hours and 45 minutes.

- note: fine

> The day included 2 hours of exercise and 2 hours spent on chores. There were also 45 minutes of calls. Time tracked was 4 hours and 45 minutes.

- note: fine

## day: work-only

- hours: Deep Work 360 min, Shallow Work 120 min, Meals 30 min
- focus session: 200 min on "Quarterly model"
- scores (not shown to the model after the rewrite): Body 25, Mind 90, Heart 0

> The day included 6 hours of deep work and 2 hours of shallow work. There was 30 minutes allocated for meals. Time with people: none logged.

- note: fine

> The day included 6 hours of deep work and 2 hours of shallow work. There was a 30-minute meal break. Time with people: none logged.

- note: fine

> The day included 6 hours of deep work, with the longest focus session lasting 200 minutes on the "Quarterly model." There were 2 hours of shallow work and 30 minutes for meals. Time with people: none logged.

- note: fine

## day: sleep-only

- hours: Sleep 480 min
- scores (not shown to the model after the rewrite): Body 40, Mind 0, Heart 0

> The day included 8 hours of sleep. There was no time with people logged. Time tracked was 8 hours.

- note: fine

> The day included 8 hours of sleep. No time with people was logged. A total of 8 hours was tracked.

- note: fine

> The day included 8 hours of sleep. There was no time with people logged. Time tracked for the day was 8 hours.

- note: fine

## day: even

- hours: Learning 150 min, Movement 30 min, Social 60 min, Rest 60 min
- mood: okay
- scores (not shown to the model after the rewrite): Body 45, Mind 55, Heart 50

> The day included 2 hours and 30 minutes of learning and 1 hour of social activity. There was also 1 hour of rest and 30 minutes of movement. The evening mood was okay.

- note: fine

> The day included 2 hours and 30 minutes of learning and 1 hour of social activity. There was also 1 hour of rest and 30 minutes of movement. The evening mood was okay.

- note: fine

> The day included 2 hours and 30 minutes of learning and 1 hour of social activity. There was also 1 hour of rest and 30 minutes of movement. The evening mood was okay.

- note: fine

## week: full-week

- days covered: all 7; days with anything logged: 7
- hours: Sleep 52h, Deep Work 22h, Meetings 8h, Exercise 4h, Social 6h, Meals 9h, Entertainment 7h
- best days: Tuesday, Thursday; best hours: 9 AM, 10 AM

> This week included 22 hours of deep work, with best focus days on Tuesday and Thursday. The best focus hours were logged at 9 AM and 10 AM. You could consider scheduling more deep work during those best focus hours next week.

- judge: total_not_judged
- note: Total hours logged were judged.

> This week included 22 hours of deep work, with best focus days on Tuesday and Thursday. The best focus hours were logged at 9 AM and 10 AM. You could consider scheduling more deep work during those best focus hours on Tuesday.

- judge: total_not_judged
- note: Total hours logged are judged.

> This week included 22 hours of deep work, with best focus days on Tuesday and Thursday. The best focus hours were logged at 9 AM and 10 AM. You might consider scheduling more deep work during those best focus hours next week.

- judge: total_not_judged
- note: Total hours logged are judged.

## week: focus-only

- days covered: all 7; days with anything logged: 7
- hours: Deep Work 38h, Shallow Work 10h, Sleep 44h, Meals 5h
- best days: Tuesday, Thursday; best hours: 8 AM, 9 AM

> This week included 38 hours of deep work and 10 hours of shallow work. The best focus days were Tuesday and Thursday, with focused work occurring primarily at 8 AM and 9 AM. You could consider scheduling more focused work during those best focus hours next week.

- judge: total_not_judged
- note: Total hours logged are judged.

> This week included 38 hours of deep work and 10 hours of shallow work. You had your best focus days on Tuesday and Thursday, with focused hours at 8 AM and 9 AM. There was no time with people logged. You might consider scheduling more deep work sessions during those best focus hours next week.

- judge: total_not_judged
- note: The total hours logged were judged.

> This week included 38 hours of deep work and 10 hours of shallow work. The best focus days were Tuesday and Thursday, with the best focus hours logged at 8 AM and 9 AM. You might consider scheduling more deep work during those best focus hours next week.

- judge: total_not_judged
- note: Total hours logged are judged.

## week: partial

- days covered: 3 of 7 (in progress); days with anything logged: 3
- hours: Deep Work 9h, Sleep 22h, Exercise 1h
- best days: Monday; best hours: 9 AM, 10 AM

> This week held three days of logging, with 9 hours of deep work recorded, primarily on Monday during the best focus hours of 9 AM and 10 AM. There was no time logged with people. You could consider scheduling additional deep work sessions on Monday during the morning hours.

- judge: total_not_judged
- note: The total hours logged are criticized.

> This week held 9 hours of deep work, all logged on Monday during the best focus hours of 9 AM and 10 AM. There was no time with people logged. You might consider scheduling more deep work hours on Monday next week.

- judge: total_not_judged
- note: The total hours logged are criticized.

> This week held three days of logging, with nine hours of deep work primarily on Monday during the best focus hours of 9 AM and 10 AM. There was no time with people logged. You may consider focusing on deep work again on Monday during the same hours.

- judge: total_not_judged
- note: The total hours logged are praised.

## week: leisure-week

- days covered: all 7; days with anything logged: 7
- hours: Entertainment 30h, Sleep 60h, Meals 10h, Shallow Work 6h
- best days: Wednesday; best hours: 2 PM

> This week included 30 hours of entertainment, 60 hours of sleep, and 10 hours for meals. The best focus day was Wednesday, with the best focus hours at 2 PM. You could consider scheduling some focused work during the best focus hours on Wednesday.

- judge: total_not_judged
- note: Total hours logged are criticized.

> This week included 30 hours of entertainment, 60 hours of sleep, and 10 hours for meals. Wednesday was the best focus day, with the best focus hours logged at 2 PM. You could consider scheduling focused work during the best focus hours on Wednesday.

- judge: total_not_judged
- note: Total hours logged are criticized.

> This week included 30 hours of entertainment, 60 hours of sleep, and 10 hours for meals. Wednesday was your best focus day, with the best focus hours at 2 PM. You logged no time with people. You could consider scheduling focused work during the best focus hours on Wednesday.

- judge: total_not_judged
- note: Total hours logged are criticized.

## week: thin-week

- days covered: all 7; days with anything logged: 2
- hours: Deep Work 3h, Meals 1h
- best days: Monday; best hours: 10 AM

> This week included 3 hours of deep work, all logged on Monday during the best focus hour of 10 AM. There was 1 hour logged for meals. The best focus day was Monday, with no time logged for people. For next week, you could consider scheduling more deep work on Monday at 10 AM.

- note: fine

> This week included 3 hours of deep work, primarily on Monday at 10 AM. Meals accounted for 1 hour. The best focus day was Monday, with the majority of logged work occurring during that time. You could consider scheduling more focused work on Monday at 10 AM next week.

- note: fine

> This week included 3 hours of deep work, with the best focus day on Monday at 10 AM. There was only one hour logged for meals. You could consider scheduling more focused work on Monday at 10 AM next week.

- judge: total_not_judged
- note: Total hours logged are judged.

## week: sleep-heavy

- days covered: all 7; days with anything logged: 7
- hours: Sleep 63h, Rest 10h, Calls 3h, Chores 6h
- best days: none; best hours: none

> You logged 63 hours of sleep and 10 hours of rest this week. You spent 3 hours on calls and 6 hours on chores. There is no data on best focus days or hours. You could consider scheduling more focused work time on one of the days next week.

- judge: total_not_judged
- note: fine

> You logged 63 hours of sleep, 10 hours of rest, and 3 hours of calls this week. There were 6 hours spent on chores. There is no data on best focus days or hours. You might consider scheduling more focused work time next week.

- judge: no_consolation, total_not_judged
- note: The reassurance about scheduling is a problem.

> You logged 63 hours of sleep, 10 hours of rest, and 3 hours of calls this week. You also recorded 6 hours spent on chores. There is no data on best focus days or hours. You might consider scheduling more focused work time next week.

- judge: no_consolation, total_not_judged
- note: The reassurance undermines the review.

