# Review voice lines

Date: 2026-11-15. 60 lines, 3 per scenario.

Day params: `{"model":"gpt-4o-mini","max_tokens":150,"temperature":0.4}`
Week params: `{"model":"gpt-4o-mini","max_tokens":200,"temperature":0.4}`

| rule | kind | lines breaching |
|---|---|---|
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
| absence-unsaid | checker | 4 |
| partial-week-absence | checker | 0 |
| label-read-back | checker | 0 |
| too-long | checker | 2 |
| list | checker | 0 |
| empty | checker | 0 |
| no_evaluation | judge | 1 |
| grounded | judge | 1 |
| no_consolation | judge | 3 |
| no_advice | judge | 0 |
| one_suggestion | judge | 0 |
| total_not_judged | judge | 23 |

Lines with any checker breach: 6. Lines failing any judge rule: 23.

Full-week lines with no time with friends or family in the input: 12. Of those, lines that say "friends or family": 8.

## day: focus-heavy

- hours: Deep Work 240 min, Meals 60 min, Sleep 450 min
- focus session: 150 min on "Essay draft"
- plan: 3 kept, 0 moved, 0 missed
- scores (not shown to the model after the rewrite): Body 52, Mind 84, Heart 20

> The day included 7 hours and 30 minutes of sleep and 1 hour for meals. There were 4 hours of deep work, with a 2-hour and 30-minute focus session on the essay draft, which included a longest focus session of 150 minutes. Three timed blocks were planned and all were kept.

- note: fine

> The day included 7 hours and 30 minutes of sleep and 1 hour for meals. There were 4 hours of deep work, with a 2-hour and 30-minute focus session on the "Essay draft" and a longest focus session of 150 minutes on the same task. Three timed blocks were planned and all were kept.

- note: fine

> The day included 7 hours and 30 minutes of sleep. There were 4 hours of deep work, with a focus session of 2 hours and 30 minutes on the "Essay draft" and a longest focus session of 150 minutes on the same task. Meals took 1 hour, and all 3 planned timed blocks were kept.

- note: fine

## day: full-day

- hours: Deep Work 180 min, Exercise 60 min, Social 120 min, Meals 90 min, Sleep 480 min
- mood: great
- scores (not shown to the model after the rewrite): Body 88, Mind 82, Heart 85

> The day included 8 hours of sleep and 3 hours of deep work. There were 2 hours of social activity and 1 hour of exercise. Meals took 1 hour and 30 minutes.

- note: fine

> The day included 8 hours of sleep and 3 hours of deep work. There were 2 hours spent on social activities and 1 hour of exercise. Meals took 1 hour and 30 minutes.

- note: fine

> The day included 8 hours of sleep and 3 hours of deep work. There were 2 hours of social activities and 1 hour of exercise. Meals took 1 hour and 30 minutes.

- note: fine

## day: thin

- hours: Shallow Work 45 min
- scores (not shown to the model after the rewrite): Body 20, Mind 25, Heart 5

> The day included 45 minutes of shallow work. Time tracked was 0 hours and 45 minutes.

- note: fine

> The day included 45 minutes of shallow work. Time tracked was 0 hours and 45 minutes.

- note: fine

> The day included 45 minutes of shallow work. Time tracked was 0 hours and 45 minutes.

- note: fine

## day: leisure

- hours: Entertainment 300 min, Meals 60 min, Sleep 540 min
- scores (not shown to the model after the rewrite): Body 35, Mind 5, Heart 5

> The day included 9 hours of sleep and 1 hour for meals. There were 5 hours spent on entertainment. Time tracked was 15 hours.

- note: fine

> The day included 9 hours of sleep and 1 hour for meals. There were 5 hours spent on entertainment. Time tracked was 15 hours.

- note: fine

> The day included 9 hours of sleep and 1 hour for meals. There were 5 hours spent on entertainment. Time tracked was 15 hours.

- note: fine

## day: low-mood

- hours: Deep Work 60 min, Entertainment 240 min
- mood: low
- scores (not shown to the model after the rewrite): Body 20, Mind 40, Heart 5

> The day included 4 hours of entertainment and 1 hour of deep work. The evening mood was low.

- note: fine

> Four hours were spent on entertainment. One hour was dedicated to deep work. The evening mood was low.

- note: fine

> The day included 4 hours of entertainment and 1 hour of deep work. The logged time totaled 5 hours. The evening mood was low.

- note: fine

## day: plan-missed

- hours: Meetings 240 min, Admin 90 min
- plan: 0 kept, 1 moved, 3 missed
- scores (not shown to the model after the rewrite): Body 15, Mind 30, Heart 10

> Four hours were spent in meetings. One hour and thirty minutes were dedicated to admin tasks. The plan included four timed blocks, with none kept, one completed at a different time, and three not done.

- note: fine

> Four hours were spent in meetings. One hour and thirty minutes were dedicated to admin tasks. Four timed blocks were planned, with one completed at a different time and three not done.

- note: fine

> Four hours of meetings took place. One hour and thirty minutes was spent on admin tasks. Four timed blocks were planned; none were kept, one was done at another time, and three were not done.

- note: fine

## day: body-day

- hours: Exercise 120 min, Chores 120 min, Calls 45 min
- scores (not shown to the model after the rewrite): Body 80, Mind 10, Heart 45

> The day included 2 hours of exercise and 2 hours of chores. There were also 45 minutes spent on calls. Time tracked was 4 hours and 45 minutes.

- note: fine

> Two hours were spent on exercise and two hours were dedicated to chores. There were 45 minutes of calls. Time tracked was 4 hours and 45 minutes.

- note: fine

> The day included 2 hours of exercise and 2 hours of chores. There were also 45 minutes spent on calls. Time tracked was 4 hours and 45 minutes.

- note: fine

## day: work-only

- hours: Deep Work 360 min, Shallow Work 120 min, Meals 30 min
- focus session: 200 min on "Quarterly model"
- scores (not shown to the model after the rewrite): Body 25, Mind 90, Heart 0

> The day included 6 hours of deep work, with the longest focus session lasting 200 minutes on the "Quarterly model." There were also 2 hours of shallow work and 30 minutes for meals. Time tracked was 8 hours and 30 minutes.

- note: fine

> Six hours of deep work included a 200-minute focus session on the "Quarterly model." Two hours were spent on shallow work. Meals took 30 minutes.

- note: fine

> Six hours of deep work, including a 200-minute focus session on "Quarterly model." Two hours of shallow work and 30 minutes for meals were logged.

- note: fine

## day: sleep-only

- hours: Sleep 480 min
- scores (not shown to the model after the rewrite): Body 40, Mind 0, Heart 0

> The day included 8 hours of sleep. A total of 8 hours was tracked.

- note: fine

> The day included 8 hours of sleep. A total of 8 hours was tracked.

- note: fine

> The day included 8 hours of sleep. Time tracked was 8 hours.

- note: fine

## day: even

- hours: Learning 150 min, Movement 30 min, Social 60 min, Rest 60 min
- mood: okay
- scores (not shown to the model after the rewrite): Body 45, Mind 55, Heart 50

> The day included 2 hours and 30 minutes of learning, 1 hour of social time, and 1 hour of rest. There was also 30 minutes of movement. The evening mood was okay.

- note: fine

> The day included 2 hours and 30 minutes of learning and 1 hour of social activity. There was also 1 hour of rest and 30 minutes of movement. The evening mood was okay.

- note: fine

> The day included 2 hours and 30 minutes of learning and 1 hour of social activity. There was also 1 hour of rest and 30 minutes of movement. The evening mood was okay.

- note: fine

## day: faith-day

- hours: Faith 60 min, Deep Work 180 min, Meals 60 min

> Three hours of deep work were logged. One hour was spent on faith activities. Meals took one hour.

- note: fine

> Three hours of deep work were logged. One hour was spent on faith activities, and one hour was dedicated to meals. Time tracked for the day totaled five hours.

- note: fine

> Three hours of deep work were logged. One hour was spent on faith activities, and one hour was dedicated to meals. Time tracked totaled five hours.

- note: fine

## day: meetings-and-faith

- hours: Meetings 240 min, Faith 30 min

> Four hours of meetings occurred during the day. There was also 30 minutes dedicated to faith. Time tracked was 4 hours and 30 minutes.

- note: fine

> Four hours of meetings took place. There was also 30 minutes dedicated to faith. Time tracked was 4 hours and 30 minutes.

- note: fine

> The day included 4 hours of meetings and 30 minutes dedicated to faith. The total time tracked was 4 hours and 30 minutes.

- note: fine

## week: full-week

- week: finished
- hours: Sleep 52h, Deep Work 22h, Meetings 8h, Exercise 4h, Social 6h, Meals 9h, Entertainment 7h
- best days: Tuesday, Thursday; best hours: 9 AM, 10 AM

> You spent 22 hours on deep work, with best focus hours at 9 AM and 10 AM on Tuesday and Thursday. You also logged 8 hours in meetings and 9 hours for meals. The data shows that your best focus days were Tuesday and Thursday. You might consider scheduling more deep work sessions during the best focus hours next week.

- judge: total_not_judged
- note: total hours logged are judged

> You spent 22 hours on deep work, with best focus hours at 9 AM and 10 AM on Tuesday and Thursday. You also logged 8 hours in meetings and 9 hours for meals. Best focus days were Tuesday and Thursday. You might consider scheduling more deep work during the 9 AM hour on those days.

- judge: total_not_judged
- note: total hours logged are judged

> You spent 22 hours on deep work, with best focus hours at 9 AM and 10 AM on Tuesday and Thursday. You also logged 8 hours in meetings and 9 hours for meals. The data shows that your best focus days were Tuesday and Thursday. You could schedule more deep work during your best focus hours next week.

- judge: total_not_judged
- note: total hours logged are judged

## week: focus-only

- week: finished
- hours: Deep Work 38h, Shallow Work 10h, Sleep 44h, Meals 5h
- best days: Tuesday, Thursday; best hours: 8 AM, 9 AM

> You spent 38 hours on deep work and 10 hours on shallow work. Your best focus days were Tuesday and Thursday, with the best focus hours at 8 AM and 9 AM. There was no time with friends or family logged this week. You could plan to use the 8 AM hour on Tuesday for a specific project.

- judge: total_not_judged
- note: The total hours logged are judged.

> You spent 38 hours on deep work and 10 hours on shallow work. Your best focus days were Tuesday and Thursday, with the best focus hours at 8 AM and 9 AM. You logged no time with friends or family this week. Consider scheduling some time with friends on a best focus day next week.

- judge: total_not_judged
- note: The total hours logged were judged.

> You spent 38 hours on deep work and 10 hours on shallow work. Your best focus days were Tuesday and Thursday, with your best focus hours at 8 AM and 9 AM. You logged no time with friends or family this week. You might consider scheduling some shallow work during your best focus hours on Tuesday.

- judge: total_not_judged
- note: The total hours logged are praised.

## week: partial

- week: in progress
- hours: Deep Work 9h, Sleep 22h, Exercise 1h
- best days: Monday; best hours: 9 AM, 10 AM

> You spent 9 hours on deep work, with your best focus hours on Monday at 9 AM and 10 AM. You also logged 1 hour of exercise. You might consider scheduling another deep work session on Monday during your best focus hours.

- judge: no_evaluation, total_not_judged
- note: The total hours logged are praised.

> You spent 9 hours on deep work, with best focus hours at 9 AM and 10 AM on Monday. You also logged 1 hour of exercise. The data shows that your best focus day was Monday. You might consider scheduling another deep work session on Monday morning at 9 AM.

- judge: total_not_judged
- note: The total hours logged are praised.

> This week held 9 hours of deep work, with your best focus on Monday during the hours of 9 AM and 10 AM. You also logged 1 hour of exercise and 22 hours of sleep. Your focused work fell primarily on Monday. You could schedule another session of deep work on Monday at 9 AM.

- judge: grounded, no_consolation, total_not_judged
- note: The grounding rule is broken due to invented phrases.

## week: leisure-week

- week: finished
- hours: Entertainment 30h, Sleep 60h, Meals 10h, Shallow Work 6h
- best days: Wednesday; best hours: 2 PM

> This week held 30 hours of entertainment and 6 hours of shallow work. You spent your best focus day on Wednesday, with your best focus hour at 2 PM. You did not log any time with friends or family. You could consider scheduling a focused work session on Wednesday at 2 PM.

- judge: total_not_judged
- note: total hours logged are judged

> This week held 30 hours of entertainment, 10 hours for meals, and 6 hours of shallow work. Your best focus day was Wednesday, with focused work occurring primarily at 2 PM. You could consider scheduling some time with friends or family next week.

- judge: no_consolation, total_not_judged
- note: No consolation should be present.

> This week held 30 hours of entertainment and 10 hours for meals. You spent 6 hours on shallow work. The best focus day was Wednesday, with the best focus hour at 2 PM. You could plan to do focused work on Wednesday at 2 PM.

- checker: absence-unsaid ("")
- judge: total_not_judged
- note: Total hours logged are judged.

## week: thin-week

- week: finished
- hours: Deep Work 3h, Meals 1h
- best days: Monday; best hours: 10 AM

> This week held 3 hours of deep work and 1 hour for meals. Your best focus day was Monday, with the best focus hour at 10 AM. You could consider scheduling more deep work sessions on Monday at 10 AM.

- checker: absence-unsaid ("")
- judge: total_not_judged
- note: Total hours logged were judged.

> This week held 3 hours of deep work and 1 hour for meals. Your best focus day was Monday, with focused work occurring at 10 AM. You could consider scheduling additional deep work on Monday at 10 AM next week.

- checker: absence-unsaid ("")
- judge: total_not_judged
- note: Total hours logged were judged.

> This week held 3 hours of deep work and 1 hour for meals. The best focus day was Monday, with focused work occurring at 10 AM. You could consider scheduling another deep work session on Monday at 10 AM.

- checker: absence-unsaid ("")
- note: fine

## week: sleep-heavy

- week: finished
- hours: Sleep 63h, Rest 10h, Calls 3h, Chores 6h
- best days: none; best hours: none

> You spent 10 hours resting, 6 hours on chores, and 3 hours on calls. The data shows that you had no focused work logged this week. You could schedule some focused work time on your best focus hours next week.

- judge: total_not_judged
- note: Total hours logged are criticized.

> You spent 10 hours resting, 6 hours on chores, and 3 hours on calls. The data shows that you had no focused work logged this week. You could schedule some focused work time on one of the best focus hours next week.

- judge: no_consolation, total_not_judged
- note: The suggestion implies a lack of focused work.

> You spent 10 hours resting and 6 hours on chores. There were also 3 hours dedicated to calls. You had your best focus hours during chores. Consider scheduling more time for calls next week.

- judge: total_not_judged
- note: Total hours are judged.

## week: meetings-week

- week: finished
- hours: Sleep 50h, Deep Work 20h, Meetings 14h, Meals 7h
- best days: Tuesday, Thursday; best hours: 9 AM, 10 AM

> You spent 20 hours on deep work, with best focus days on Tuesday and Thursday. The best focus hours were at 9 AM and 10 AM. You logged 14 hours in meetings and 7 hours for meals. No time with friends or family was logged this week. 
> 
> You could schedule some deep work at 9 AM on Tuesday.

- checker: too-long ("5 sentences")
- judge: total_not_judged
- note: fine

> You spent 20 hours on deep work, with best focus days on Tuesday and Thursday. Your best focus hours were at 9 AM and 10 AM. No time with friends or family was logged this week. You could plan to schedule more time for meals on Tuesday.

- judge: total_not_judged
- note: The total hours logged are praised.

> You spent 20 hours on deep work, with significant focus on Tuesday and Thursday, particularly at 9 AM and 10 AM. You also logged 14 hours in meetings and 7 hours for meals. No time with friends or family was logged this week. You could consider scheduling some time with friends on Thursday.

- judge: total_not_judged
- note: The total hours logged were not judged.

## week: faith-week

- week: finished
- hours: Sleep 52h, Deep Work 18h, Faith 5h, Meals 8h
- best days: Tuesday, Thursday; best hours: 9 AM, 10 AM

> You spent 18 hours on deep work, with your best focus days being Tuesday and Thursday. Your best focus hours were at 9 AM and 10 AM. You also spent 8 hours on meals and 5 hours on faith. Consider scheduling more deep work during your best focus hours next week.

- judge: total_not_judged
- note: total hours logged are judged

> This week held 18 hours of deep work, with best focus hours at 9 AM and 10 AM on Tuesday and Thursday. You spent 8 hours on meals and 5 hours on faith. The focused work primarily occurred in the morning. You could schedule more deep work during the 9 AM hour on Tuesday.

- judge: total_not_judged
- note: Total hours logged are judged.

> You spent 18 hours on deep work, with your best focus days being Tuesday and Thursday. Your best focus hours were at 9 AM and 10 AM. You logged 8 hours for meals and 5 hours for faith. You slept for 52 hours. 
> 
> For next week, consider scheduling deep work sessions at 9 AM on Tuesday.

- checker: too-long ("5 sentences")
- judge: total_not_judged
- note: Total hours logged are judged.

