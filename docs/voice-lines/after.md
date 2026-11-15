# Review voice lines

Date: 2026-11-15. 63 lines, 3 per scenario.

Day params: `{"model":"gpt-4o-mini","max_tokens":150,"temperature":0.4}`
Week params: `{"model":"gpt-4o-mini","max_tokens":200,"temperature":0.4}`

| rule | kind | lines breaching |
|---|---|---|
| banned-word | checker | 2 |
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
| absence-unsaid | checker | 3 |
| partial-week-absence | checker | 0 |
| label-read-back | checker | 0 |
| too-long | checker | 0 |
| list | checker | 0 |
| empty | checker | 0 |
| no_evaluation | judge | 0 |
| grounded | judge | 0 |
| no_consolation | judge | 0 |
| no_advice | judge | 0 |
| one_suggestion | judge | 0 |
| total_not_judged | judge | 0 |

Lines with any checker breach: 5. Lines failing any judge rule: 0.

Full-week lines with no time with friends or family in the input: 12. Of those, lines that say "friends or family": 9.

## Judge check: total_not_judged on lines with a known answer

Lines NOT quoted in the rule (the real test): kept graded kept 10 of 10; broken graded broken 11 of 11.
Lines that quote the rule (*, weaker): kept graded kept 6 of 6; broken graded broken 5 of 5.
All lines: kept 16 of 16; broken 16 of 16. (* repeats an example given in the rule.)

- right · should keep * · full-week · "You spent 22 hours on deep work, with best focus hours at 9 AM and 10 AM on Tuesday and Thursday. You also logged 8 hours in meetings and 9 hours for meals. Best focus days were Tuesday and Thursday. You might consider scheduling more deep work during the 9 AM hour on those days." · note: fine
- right · should keep * · full-week · "You spent 22 hours on deep work, with best focus hours at 9 AM and 10 AM on Tuesday and Thursday. You also logged 8 hours in meetings and 9 hours for meals. The data shows that your best focus days were Tuesday and Thursday. You could schedule more deep work during your best focus hours next week." · note: fine
- right · should keep * · focus-only · "You spent 38 hours on deep work and 10 hours on shallow work. Your best focus days were Tuesday and Thursday, with your best focus hours at 8 AM and 9 AM. You logged no time with friends or family this week. You might consider scheduling some shallow work during your best focus hours on Tuesday." · note: fine
- right · should keep · partial · "You spent 9 hours on deep work, with best focus hours at 9 AM and 10 AM on Monday. You also logged 1 hour of exercise. The data shows that your best focus day was Monday. You might consider scheduling another deep work session on Monday morning at 9 AM." · note: fine
- right · should keep · thin-week · "This week held 3 hours of deep work and 1 hour for meals. Your best focus day was Monday, with the best focus hour at 10 AM. You could consider scheduling more deep work sessions on Monday at 10 AM." · note: fine
- right · should keep * · leisure-week · "This week held 30 hours of entertainment and 6 hours of shallow work. You spent your best focus day on Wednesday, with your best focus hour at 2 PM. You did not log any time with friends or family. You could consider scheduling a focused work session on Wednesday at 2 PM." · note: fine
- right · should keep * · meetings-week · "You spent 20 hours on deep work, with best focus days on Tuesday and Thursday. Your best focus hours were at 9 AM and 10 AM. No time with friends or family was logged this week. You could plan to schedule more time for meals on Tuesday." · note: fine
- right · should keep · faith-week · "You spent 18 hours on deep work, with your best focus days being Tuesday and Thursday. Your best focus hours were at 9 AM and 10 AM. You also spent 8 hours on meals and 5 hours on faith. Consider scheduling more deep work during your best focus hours next week." · note: fine
- right · should keep * · faith-week · "You spent 18 hours on deep work this week. Your best focus days were Tuesday and Thursday, with your best focus hours at 9 AM and 10 AM. You logged 8 hours for meals and 5 hours for faith. You had 52 hours of sleep." · note: fine
- right · should keep · sleep-heavy · "You spent 10 hours resting, 6 hours on chores, and 3 hours on calls. The most time was dedicated to rest. You could consider scheduling more calls on Tuesday." · note: fine
- right · should break * · full-week · "This week held 22 hours of deep work, with best focus days on Tuesday and Thursday. The best focus hours were at 9 AM and 10 AM. You logged all seven days, with no hours unaccounted for. Consider scheduling more deep work during your best focus hours next week." · note: about_the_record: "You logged all seven days, with no hours unaccounted for."
- right · should break · focus-only · "This week included 38 hours of deep work and 10 hours of shallow work, with all seven days logged. The best focus days were Tuesday and Thursday, with the best focus hours at 8 AM and 9 AM. You could consider scheduling some shallow work during your best focus hours on Tuesday." · note: about_the_record: "This week included 38 hours of deep work and 10 hours of shallow work, with all seven days logged."
- right · should break * · partial · "This week held three days of logging, with 9 hours of deep work recorded. The best focus day was Monday, with focused hours at 9 AM and 10 AM. You might consider scheduling additional focused work on Monday during the best focus hours." · note: about_the_record: "This week held three days of logging, with 9 hours of deep work recorded."
- right · should break · partial · "This week held 9 hours of deep work, all on Monday during the best focus hours of 9 AM and 10 AM. Sleep accounted for 22 hours, and there was 1 hour of exercise. You could consider logging additional activities on Tuesday or Wednesday." · note: suggests_recording: "You could consider logging additional activities on Tuesday or Wednesday."
- right · should break * · thin-week · "This week included 3 hours of deep work, all logged on Monday during the best focus hour of 10 AM. You logged 1 hour for meals. There were only 2 days with any time logged. You could consider adding more activities on Wednesday, as it currently has no logged hours." · note: about_the_record: "There were only 2 days with any time logged."
- right · should break * · thin-week · "This week held 3 hours of deep work and 1 hour for meals. Only two days had any time logged, indicating limited activity. You could schedule deep work on Monday at 10 AM." · note: about_the_record: "Only two days had any time logged, indicating limited activity."
- right · should break * · sleep-heavy · "You spent 10 hours resting, 6 hours on chores and 3 hours on calls. There is not enough data to determine your best focus days or hours. You might consider recording focused work next week to capture more details." · note: about_the_record: "There is not enough data to determine your best focus days or hours." suggests_recording: "You might consider recording focused work next week to capture more details."
- right · should break · leisure-week · "This week held 30 hours of entertainment and 10 hours for meals. Wednesday was the best focus day. You might consider logging some time with friends or family on a day like Saturday." · note: suggests_recording: "You might consider logging some time with friends or family on a day like Saturday."
- right · should break · sleep-heavy · "Sleep was the biggest part of your week at 63 hours, well ahead of 10 hours of rest and 6 hours of chores. You could schedule a call on Wednesday evening." · note: sleep_was_the_largest: "Sleep was the biggest part of your week at 63 hours, well ahead of 10 hours of rest and 6 hours of chores."
- right · should keep · meetings-week · "Meetings took 14 hours and deep work 20 hours. Focus clustered on Tuesday and Thursday, mostly around 9 AM and 10 AM. Friends and family do not appear in the week. You could book a call on Wednesday evening." · note: fine
- right · should keep · full-week · "Exercise came to 4 hours and social time to 6 hours, against 22 hours of deep work. Entertainment took 7 hours. Next week, you could move a workout to Wednesday at 7 AM." · note: fine
- right · should keep · faith-week · "Faith took 5 hours this week, next to 18 hours of deep work and 8 hours of meals. Late mornings on Tuesday and Thursday held the most focus. You might add a short walk on Friday afternoon." · note: fine
- right · should keep · leisure-week · "Entertainment filled 30 hours, with 10 hours going to meals and 6 to shallow work. Wednesday around 2 PM held the most focus. An hour of deep work there on Wednesday is one option." · note: fine
- right · should keep · partial · "So far this week, deep work has taken 9 hours and exercise 1 hour. Monday at 9 AM was where focus landed. You could try a second focus block on Tuesday at 9 AM." · note: fine
- right · should keep · sleep-heavy · "Chores took 6 hours and rest 10 hours, with 3 hours of calls. Apart from sleep, rest took the most time. A call on Saturday morning is one option." · note: fine
- right · should break · full-week · "Deep work took 22 hours across the week, and every day has an entry. Nothing is missing from the record. You could try a morning workout on Friday." · note: about_the_record: "Nothing is missing from the record."
- right · should break · thin-week · "Deep work took 3 hours and meals 1 hour. Most of the week is blank, so the picture is incomplete. You could schedule deep work on Monday at 10 AM." · note: about_the_record: "Most of the week is blank, so the picture is incomplete."
- right · should break · partial · "Deep work took 9 hours so far. You have written down just one day of this week. Try noting your afternoons too, starting Tuesday." · note: about_the_record: "You have written down just one day of this week." suggests_recording: "Try noting your afternoons too, starting Tuesday."
- right · should break · meetings-week · "Meetings took 14 hours and deep work 20 hours. Track your evenings next week so the totals are fuller." · note: suggests_recording: "Track your evenings next week so the totals are fuller."
- right · should break · leisure-week · "Sleep made up most of the week at 60 hours, with entertainment next at 30. You could schedule a walk on Wednesday." · note: sleep_was_the_largest: "Sleep made up most of the week at 60 hours, with entertainment next at 30."
- right · should break · faith-week · "Sleep took the largest share of the week, at 52 hours, ahead of 18 hours of deep work. You could schedule deep work on Tuesday at 9 AM." · note: sleep_was_the_largest: "Sleep took the largest share of the week, at 52 hours, ahead of 18 hours of deep work."
- right · should break · sleep-heavy · "Rest took 10 hours, chores 6 and calls 3. The log is too sparse to say when focus happens. You might add your work hours on Monday." · note: about_the_record: "The log is too sparse to say when focus happens." suggests_recording: "You might add your work hours on Monday."

## day: focus-heavy

- hours: Deep Work 240 min, Meals 60 min, Sleep 450 min
- focus session: 150 min on "Essay draft"
- plan: 3 kept, 0 moved, 0 missed
- scores (not shown to the model after the rewrite): Body 52, Mind 84, Heart 20

> The day included 7 hours and 30 minutes of sleep and 1 hour for meals. There were 4 hours of deep work, with a 2-hour and 30-minute focus session on the essay draft, which included a longest focus session of 150 minutes. Three timed blocks were planned and all were kept.

- note: fine

> The day included 7 hours and 30 minutes of sleep and 4 hours of deep work. There was a 2-hour and 30-minute focus session on the essay draft, with the longest focus session lasting 150 minutes. Meals took 1 hour, and all 3 planned timed blocks were kept.

- note: fine

> The day included 7 hours and 30 minutes of sleep and 1 hour for meals. There were 4 hours of deep work, with a 2-hour and 30-minute focus session on the essay draft, and the longest focus session was 150 minutes on the same task. Three timed blocks were planned and all were kept.

- note: fine

## day: full-day

- hours: Deep Work 180 min, Exercise 60 min, Social 120 min, Meals 90 min, Sleep 480 min
- mood: great
- scores (not shown to the model after the rewrite): Body 88, Mind 82, Heart 85

> The day included 8 hours of sleep and 3 hours of deep work. There were 2 hours spent on social activities and 1 hour of exercise. Meals took 1 hour and 30 minutes.

- note: fine

> The day included 8 hours of sleep and 3 hours of deep work. There were 2 hours spent on social activities and 1 hour of exercise, along with 1 hour and 30 minutes for meals. The evening mood was great.

- checker: banned-word ("great")
- note: fine

> The day included 8 hours of sleep and 3 hours of deep work. There were 2 hours of social activity and 1 hour of exercise, along with 1 hour and 30 minutes for meals. The evening mood was great.

- checker: banned-word ("great")
- note: fine

## day: thin

- hours: Shallow Work 45 min
- scores (not shown to the model after the rewrite): Body 20, Mind 25, Heart 5

> The day included 45 minutes of shallow work. Time tracked was 45 minutes.

- note: fine

> The day included 45 minutes of shallow work. Time tracked was 0 hours and 45 minutes.

- note: fine

> The day included 45 minutes of shallow work. Time tracked for the day was 45 minutes.

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

> The day included 4 hours of entertainment and 1 hour of deep work. The total time tracked was 5 hours. The evening mood was low.

- note: fine

> Four hours of entertainment were logged. One hour was spent on deep work. The evening mood was low.

- note: fine

> The day included 4 hours of entertainment and 1 hour of deep work. The total time tracked was 5 hours. The evening mood was low.

- note: fine

## day: plan-missed

- hours: Meetings 240 min, Admin 90 min
- plan: 0 kept, 1 moved, 3 missed
- scores (not shown to the model after the rewrite): Body 15, Mind 30, Heart 10

> The day included 4 hours of meetings and 1 hour and 30 minutes of admin work. Four timed blocks were planned, with 0 kept, 1 done at another time, and 3 not done. Time tracked was 5 hours and 30 minutes.

- note: fine

> Four hours were spent in meetings. One hour and thirty minutes were dedicated to admin tasks. Four timed blocks were planned, with one completed at a different time and three not done.

- note: fine

> The day included 4 hours of meetings and 1 hour and 30 minutes of admin work. Four timed blocks were planned, with one completed at a different time and three not done. Time tracked was 5 hours and 30 minutes.

- note: fine

## day: body-day

- hours: Exercise 120 min, Chores 120 min, Calls 45 min
- scores (not shown to the model after the rewrite): Body 80, Mind 10, Heart 45

> The day included 2 hours of exercise and 2 hours of chores. There were also 45 minutes spent on calls. Time tracked was 4 hours and 45 minutes.

- note: fine

> The day included 2 hours of exercise and 2 hours of chores. There were also 45 minutes spent on calls. Time tracked was 4 hours and 45 minutes.

- note: fine

> Two hours were spent on exercise and two hours on chores. There were 45 minutes of calls. The total time tracked was 4 hours and 45 minutes.

- note: fine

## day: work-only

- hours: Deep Work 360 min, Shallow Work 120 min, Meals 30 min
- focus session: 200 min on "Quarterly model"
- scores (not shown to the model after the rewrite): Body 25, Mind 90, Heart 0

> Six hours of deep work, including a 200-minute focus session on the "Quarterly model." Two hours were spent on shallow work and 30 minutes on meals. Time tracked was 8 hours and 30 minutes.

- note: fine

> The day included 6 hours of deep work, with the longest focus session lasting 200 minutes on the "Quarterly model." There were also 2 hours of shallow work and 30 minutes allocated for meals. Time tracked was 8 hours and 30 minutes.

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

> The day included 8 hours of sleep. A total of 8 hours was tracked.

- note: fine

## day: even

- hours: Learning 150 min, Movement 30 min, Social 60 min, Rest 60 min
- mood: okay
- scores (not shown to the model after the rewrite): Body 45, Mind 55, Heart 50

> The day included 2 hours and 30 minutes of learning, 1 hour of social activity, and 1 hour of rest. There was also 30 minutes of movement. The evening mood was okay.

- note: fine

> The day included 2 hours and 30 minutes of learning, 1 hour of social activity, and 1 hour of rest. There was also 30 minutes of movement. The evening mood was okay.

- note: fine

> The day included 2 hours and 30 minutes of learning, 1 hour of social activity, and 1 hour of rest. There was also 30 minutes of movement. The evening mood was okay.

- note: fine

## day: faith-day

- hours: Faith 60 min, Deep Work 180 min, Meals 60 min

> Three hours of deep work were logged. One hour was spent on faith activities, and one hour was allocated for meals. Time tracked was five hours.

- note: fine

> Three hours of deep work were logged. One hour was spent on faith activities, and one hour was used for meals. Time tracked totaled five hours.

- note: fine

> Three hours of deep work were logged. One hour was spent on faith activities. One hour was used for meals.

- note: fine

## day: meetings-and-faith

- hours: Meetings 240 min, Faith 30 min

> The day included 4 hours of meetings and 30 minutes dedicated to faith. The total time tracked was 4 hours and 30 minutes.

- note: fine

> The day included four hours of meetings and 30 minutes dedicated to faith. Time tracked totaled 4 hours and 30 minutes.

- note: fine

> The day included 4 hours of meetings and 30 minutes dedicated to faith. The total time tracked was 4 hours and 30 minutes.

- note: fine

## week: full-week

- week: finished
- hours: Sleep 52h, Deep Work 22h, Meetings 8h, Exercise 4h, Social 6h, Meals 9h, Entertainment 7h
- best days: Tuesday, Thursday; best hours: 9 AM, 10 AM

> You spent 22 hours on deep work, with best focus hours at 9 AM and 10 AM on Tuesday and Thursday. You also logged 9 hours for meals and 8 hours for meetings. A pattern in your data shows that your focused work occurred primarily on Tuesday and Thursday. You might consider scheduling more deep work sessions at 9 AM next week.

- note: fine

> You spent 22 hours on deep work, with your best focus days being Tuesday and Thursday. The best focus hours were at 9 AM and 10 AM. You also logged 9 hours for meals and 8 hours for meetings. You could schedule deep work for Tuesday at 9 AM.

- note: fine

> You spent 22 hours on deep work, with best focus hours at 9 AM and 10 AM on Tuesday and Thursday. You also logged 9 hours for meals and 8 hours for meetings. A pattern in the data shows that your best focus days were Tuesday and Thursday. You might consider scheduling more deep work during your best focus hours on those days.

- note: fine

## week: focus-only

- week: finished
- hours: Deep Work 38h, Shallow Work 10h, Sleep 44h, Meals 5h
- best days: Tuesday, Thursday; best hours: 8 AM, 9 AM

> You spent 38 hours on deep work and 10 hours on shallow work. Your best focus days were Tuesday and Thursday, with your best focus hours at 8 AM and 9 AM. You logged no time with friends or family this week. Consider scheduling some time with friends on one of your best focus days.

- note: fine

> You spent 38 hours on deep work, with best focus days on Tuesday and Thursday. Your best focus hours were at 8 AM and 9 AM. No time with friends or family was logged this week. You could consider scheduling some time with friends on Thursday after your focused work.

- note: fine

> You spent 38 hours on deep work and 10 hours on shallow work. Your best focus days were Tuesday and Thursday, with the best focus hours at 8 AM and 9 AM. You logged no time with friends or family this week. You could schedule a block of deep work on Tuesday at 8 AM.

- note: fine

## week: partial

- week: in progress
- hours: Deep Work 9h, Sleep 22h, Exercise 1h
- best days: Monday; best hours: 9 AM, 10 AM

> This week so far held 9 hours of deep work and 1 hour of exercise. Your best focus day was Monday, with your best focus hours at 9 AM and 10 AM. You could schedule more deep work on Monday during those best focus hours.

- note: fine

> You spent 9 hours on deep work, with your best focus day being Monday. Your best focus hours were at 9 AM and 10 AM. You also logged 1 hour of exercise and 22 hours of sleep. Consider scheduling more deep work sessions on Monday during your best focus hours.

- note: fine

> You spent 9 hours on deep work, with your best focus day on Monday and your best focus hours at 9 AM and 10 AM. You also logged 1 hour of exercise and 22 hours of sleep. The focused work fell primarily on Monday during the morning hours. You could consider scheduling another deep work session on Monday at 9 AM.

- note: fine

## week: leisure-week

- week: finished
- hours: Entertainment 30h, Sleep 60h, Meals 10h, Shallow Work 6h
- best days: Wednesday; best hours: 2 PM

> This week held 30 hours of entertainment, 10 hours for meals, and 6 hours of shallow work. The best focus day was Wednesday, with focused work occurring at 2 PM. You could consider scheduling focused work on Wednesday at 2 PM.

- checker: absence-unsaid ("")
- note: fine

> This week held 30 hours of entertainment, 10 hours for meals, and 6 hours of shallow work. Your best focus day was Wednesday, with focused work at 2 PM. You logged no time with friends or family. You could consider scheduling some time with friends on Wednesday.

- note: fine

> You spent 30 hours on entertainment, 10 hours on meals, and 6 hours on shallow work. Your best focus day was Wednesday, with your best focus hours at 2 PM. You logged no time with friends or family this week. You could consider scheduling focused work during your best focus hour on Wednesday.

- note: fine

## week: thin-week

- week: finished
- hours: Deep Work 3h, Meals 1h
- best days: Monday; best hours: 10 AM

> This week held 3 hours of deep work and 1 hour for meals. The best focus day was Monday, with focused work occurring at 10 AM. You could schedule another deep work session on Monday at 10 AM.

- checker: absence-unsaid ("")
- note: fine

> This week held 3 hours of deep work and 1 hour for meals. The best focus day was Monday, with the best focus hour at 10 AM. You could schedule another deep work session on Monday at 10 AM.

- checker: absence-unsaid ("")
- note: fine

> You spent 3 hours on deep work on Monday at 10 AM. You logged 1 hour for meals. There were no hours logged for time with friends or family this week. You could schedule more deep work on Monday at 10 AM.

- note: fine

## week: sleep-heavy

- week: finished
- hours: Sleep 63h, Rest 10h, Calls 3h, Chores 6h
- best days: none; best hours: none

> You spent 10 hours resting, which is the most hours apart from sleep. You also logged 6 hours on chores and 3 hours on calls. Next week, consider scheduling more time for calls on Tuesday.

- note: fine

> You spent 10 hours resting, which is the most time apart from sleep. You also logged 6 hours on chores and 3 hours on calls. You might consider scheduling a specific time for calls on Tuesday.

- note: fine

> You spent 10 hours resting, which is the most hours apart from sleep. You also logged 6 hours on chores and 3 hours on calls. Next week, consider setting aside time on Tuesday for additional chores.

- note: fine

## week: no-focus-home

- week: finished
- hours: Sleep 56h, Chores 12h, Errands 7h, Social 5h, Rest 4h
- best days: none; best hours: none

> You spent 12 hours on chores, 7 hours on errands, and 5 hours on social activities. Chores took the most hours apart from sleep. You might consider scheduling some time for rest on Wednesday.

- note: fine

> You spent 12 hours on chores, 7 hours on errands, and 5 hours on social activities. Chores took the most hours apart from sleep. You could plan to allocate some time for rest on Wednesday.

- note: fine

> This week held 12 hours of chores, 7 hours of errands, and 5 hours of social activities. Chores took the most hours apart from sleep. You could plan for more rest on Wednesday for an hour.

- note: fine

## week: meetings-week

- week: finished
- hours: Sleep 50h, Deep Work 20h, Meetings 14h, Meals 7h
- best days: Tuesday, Thursday; best hours: 9 AM, 10 AM

> You spent 20 hours on deep work this week, with best focus hours at 9 AM and 10 AM on Tuesday and Thursday. You also logged 14 hours in meetings and 7 hours for meals. There was no time with friends or family logged this week. You could schedule some time for social activities on Wednesday.

- note: fine

> You spent 20 hours on deep work and 14 hours in meetings. Your best focus days were Tuesday and Thursday, with the best focus hours being 9 AM and 10 AM. You logged no time with friends or family this week. You could schedule a block of deep work on Tuesday at 9 AM.

- note: fine

> You spent 20 hours on deep work, with best focus days on Tuesday and Thursday. Your best focus hours were at 9 AM and 10 AM. There was no time with friends or family logged this week. You could schedule a meeting on Tuesday at 10 AM.

- note: fine

## week: faith-week

- week: finished
- hours: Sleep 52h, Deep Work 18h, Faith 5h, Meals 8h
- best days: Tuesday, Thursday; best hours: 9 AM, 10 AM

> You spent 18 hours on deep work, with your best focus days being Tuesday and Thursday. Your best focus hours were at 9 AM and 10 AM. You logged 8 hours for meals and 5 hours for faith. You might consider scheduling more deep work during your best focus hours on Tuesday.

- note: fine

> You spent 18 hours on deep work, with best focus days on Tuesday and Thursday. Your best focus hours were at 9 AM and 10 AM. You also logged 8 hours for meals and 5 hours for faith. You might consider scheduling more deep work during the best focus hours on Tuesday.

- note: fine

> You spent 18 hours on deep work this week. Your best focus days were Tuesday and Thursday, with your best focus hours at 9 AM and 10 AM. You also logged 8 hours for meals and 5 hours for faith. Consider scheduling more deep work during your best focus hours on Tuesday.

- note: fine

