# Review voice lines

Date: 2026-11-14. 48 lines, 3 per scenario.

Day params: `{"model":"gpt-4o-mini","max_tokens":150,"temperature":0.4}`
Week params: `{"model":"gpt-4o-mini","max_tokens":200,"temperature":0.7}`

| rule | kind | lines breaching |
|---|---|---|
| banned-word | checker | 0 |
| verdict | checker | 3 |
| exclamation | checker | 0 |
| question | checker | 0 |
| emoji | checker | 0 |
| score-talk | checker | 21 |
| relative-day | checker | 0 |
| advice | checker | 0 |
| correction | checker | 0 |
| hard-day | checker | 0 |
| too-long | checker | 0 |
| list | checker | 0 |
| empty | checker | 0 |
| no_evaluation | judge | 9 |
| grounded | judge | 12 |
| no_consolation | judge | 13 |
| no_advice | judge | 0 |
| one_suggestion | judge | 1 |
| total_not_judged | judge | 18 |

Lines with any checker breach: 21. Lines failing any judge rule: 30.

## day: focus-heavy

- hours: Deep Work 240 min, Meals 60 min, Sleep 450 min
- focus session: 150 min on "Essay draft"
- plan: 3 kept, 0 moved, 0 missed
- scores (not shown to the model after the rewrite): Body 52, Mind 84, Heart 20

> The day included a 2-hour and 30-minute focus session on the essay draft. Three timed blocks were kept as planned. No time with people was logged.

- note: Heart score is low.

> The day included a 2-hour and 30-minute focus session on the essay draft. Three timed blocks were kept as planned. No time with people was logged.

- note: fine

> The day included a 2-hour and 30-minute focus session on the essay draft. Three timed blocks were kept as planned. No time with people was logged.

- note: Heart score is low.

## day: full-day

- hours: Deep Work 180 min, Exercise 60 min, Social 120 min, Meals 90 min, Sleep 480 min
- mood: great
- scores (not shown to the model after the rewrite): Body 88, Mind 82, Heart 85

> The day included five hours of focused work, primarily on the project. There was a 45-minute workout and a 30-minute reading session. No time with people was logged.

- judge: grounded
- note: The time logged does not match the input.

> Four hours of focused work, primarily on the project. A 30-minute walk and time spent reading contributed to mental engagement. No time with people was logged.

- judge: grounded
- note: The activities mentioned do not match the input data.

> The day included five hours of focused work, primarily on the report. A 45-minute workout was logged. No time with people was logged.

- judge: grounded
- note: The numbers and activities do not match the input.

## day: thin

- hours: Shallow Work 45 min
- scores (not shown to the model after the rewrite): Body 20, Mind 25, Heart 5

> No time was logged for physical activity. There were 25 minutes of reading. No time with people was logged.

- note: Physical activity received no time.

> No time was logged for physical activity. There was 15 minutes of reading and 30 minutes of writing. No time with people was logged.

- note: Body and heart scores are low.

> No time was logged for physical activity. A total of 45 minutes was spent on tasks related to the mind. No time with people was logged.

- note: Physical activity received no time.

## day: leisure

- hours: Entertainment 300 min, Meals 60 min, Sleep 540 min
- scores (not shown to the model after the rewrite): Body 35, Mind 5, Heart 5

> The day included 15 hours of logged time. There was no time spent on body, mind, or heart activities. No time with people was logged.

- note: Body, mind, and heart activities received no time.

> No time was logged for body activities. Five hours of focused work were logged, with a significant portion dedicated to reading. No time with people was logged.

- note: Body activities received no time.

> No time was logged for body activities. Five hours of focused work were logged, mostly on reading. No time with people was logged.

- note: Body activities received no time.

## day: low-mood

- hours: Deep Work 60 min, Entertainment 240 min
- mood: low
- scores (not shown to the model after the rewrite): Body 20, Mind 40, Heart 5

> Five hours of logged time. No time spent on body or with people was logged. The mood in the evening was low.

- judge: grounded
- note: The body and heart areas received no time.

> Five hours of time was logged. There was no time for physical activity, and only a small amount of time was spent on mental tasks. No time with people was logged.

- judge: grounded
- note: The body score indicates no time for physical activity.

> Five hours of time was logged. There was no time spent on body or heart activities. No time with people was logged.

- judge: grounded
- note: Body and heart activities received no time.

## day: plan-missed

- hours: Meetings 240 min, Admin 90 min
- plan: 0 kept, 1 moved, 3 missed
- scores (not shown to the model after the rewrite): Body 15, Mind 30, Heart 10

> Five hours and thirty minutes were logged. One timed block was completed at a different time, while three were not done. No time with people was logged.

- note: Body, mind, and heart scores are low.

> No time for body activity was logged. One hour of focused work was completed, and four hours were not kept as planned. No time with people was logged.

- note: Body activity was not logged.

> Five hours and thirty minutes of time was logged. There was no time spent on body activities, and no time with people was logged. One timed block was completed at a different time than planned.

- note: Body activities received no time.

## day: body-day

- hours: Exercise 120 min, Chores 120 min, Calls 45 min
- scores (not shown to the model after the rewrite): Body 80, Mind 10, Heart 45

> Four hours of focused work, primarily on the essay. No time with people was logged. A 30-minute walk was recorded.

- note: Mind received very little attention.

> Four hours and 45 minutes of time was logged. The body score was 80, while the mind score was 10 and the heart score was 45. No time with people was logged.

- checker: score-talk ("score"), score-talk ("score"), score-talk ("score")
- note: The mind score is notably low.

> Four hours of focused work were logged. No time with people was logged. A brief period for physical activity was noted, but minimal time was spent on mental or emotional engagement.

- note: Mental and emotional engagement received minimal time.

## day: work-only

- hours: Deep Work 360 min, Shallow Work 120 min, Meals 30 min
- focus session: 200 min on "Quarterly model"
- scores (not shown to the model after the rewrite): Body 25, Mind 90, Heart 0

> Two hours and 30 minutes of physical activity was logged, mostly in a single session. Five hours of focused work was spent on the quarterly model. No time with people was logged.

- judge: grounded
- note: The physical activity and focused work times do not match the input.

> Two hours and 30 minutes of physical activity was logged, with no time spent on body care. Five hours of focused work included a 200-minute session on the "Quarterly model." No time with people was logged.

- note: Body care received no time.

> Two hours and 30 minutes of physical activity logged, primarily from a 200-minute focus session on the "Quarterly model." No time with people was logged.

- judge: grounded
- note: The physical activity time does not match the input.

## day: sleep-only

- hours: Sleep 480 min
- scores (not shown to the model after the rewrite): Body 40, Mind 0, Heart 0

> The day included no time logged for body, mind, or heart activities. Eight hours were tracked. No time with people was logged.

- judge: grounded
- note: The line inaccurately states no time was logged for body, mind, or heart activities.

> No time was logged for body, mind, or heart activities. Eight hours were tracked. No time with people was logged.

- note: No time for body, mind, or heart activities was logged.

> Eight hours of time was logged. No time was spent on body, mind, or heart activities. No time with people was logged.

- note: No time was spent on body, mind, or heart activities.

## day: even

- hours: Learning 150 min, Movement 30 min, Social 60 min, Rest 60 min
- mood: okay
- scores (not shown to the model after the rewrite): Body 45, Mind 55, Heart 50

> Five hours of tracked time. No time with people was logged. Body, mind, and heart scores were all below 60.

- checker: score-talk ("scores")
- judge: grounded
- note: The line does not accurately reflect the input.

> Five hours of logged time included no specific activities for the body. There was no time logged for people. The scores indicate a balanced distribution across body, mind, and heart.

- checker: verdict ("balanced"), score-talk ("scores")
- judge: grounded
- note: The line does not accurately reflect the input.

> The day included two hours of focused work and a 30-minute walk. No time with people was logged.

- judge: grounded
- note: The time logged does not match the input.

## week: full-week

- days covered: all 7; days with anything logged: 7
- hours: Sleep 52h, Deep Work 22h, Meetings 8h, Exercise 4h, Social 6h, Meals 9h, Entertainment 7h
- best days: Tuesday, Thursday; best hours: 9 AM, 10 AM

> This week included 22 hours of deep work, with your best focus on Tuesday and Thursday around 9 AM and 10 AM. Your average scores were 62 for Body, 70 for Mind, and 55 for Heart, indicating a need for attention in emotional engagement. Consider increasing your time spent on social activities, as only 6 hours were logged. Allocating more time to connect with others could help improve your Heart score next week.

- checker: score-talk ("scores"), score-talk ("score")
- judge: no_evaluation, no_consolation, total_not_judged
- note: The suggestion to increase social activities is too encouraging.

> This week included 22 hours of deep work, with the best focus days being Tuesday and Thursday. Your average scores were 62 for Body, 70 for Mind, and 55 for Heart. The lower Heart score indicates a potential area of concern, suggesting less emotional engagement or connection this week. Consider dedicating more time to social interactions or activities that foster emotional well-being next week.

- checker: score-talk ("scores"), score-talk ("score")
- judge: no_evaluation, no_consolation, total_not_judged
- note: The suggestion to improve emotional engagement is too strong.

> You logged seven days this week, with an average Body score of 62, Mind score of 70, and Heart score of 55. Tuesday and Thursday were your best focus days, with peak focus during the 9 AM and 10 AM hours. There is a pattern of low engagement in activities related to Heart. Consider dedicating more time to social interactions or reflective practices next week to address this area.

- checker: score-talk ("score"), score-talk ("score"), score-talk ("score")
- judge: no_evaluation, no_consolation, total_not_judged
- note: The suggestion to improve Heart engagement is a concern.

## week: focus-only

- days covered: all 7; days with anything logged: 7
- hours: Deep Work 38h, Shallow Work 10h, Sleep 44h, Meals 5h
- best days: Tuesday, Thursday; best hours: 8 AM, 9 AM

> This week included 38 hours of deep work, with the best focus on Tuesday and Thursday during the 8 AM and 9 AM hours. Your Body score is low at 30, and there was no time logged for Heart activities. To address this, consider scheduling specific time for physical activity or social interactions next week.

- checker: score-talk ("score")
- judge: no_evaluation, no_consolation, total_not_judged
- note: The evaluation of the Body score is problematic.

> This week included a significant amount of deep work, totaling 38 hours, with the best focus on Tuesday and Thursday during the 8 AM and 9 AM hours. The average Body score was 30, indicating limited attention to physical wellbeing, and no time with people was logged. You may want to focus on increasing physical activity and social interactions next week. Consider scheduling specific time for movement or social engagements to improve your Body and Heart scores.

- checker: score-talk ("score"), score-talk ("scores")
- judge: no_evaluation, no_consolation, one_suggestion, total_not_judged
- note: The suggestion is too extensive.

> This week included 38 hours of deep work and 10 hours of shallow work, with your best focus days being Tuesday and Thursday. Your Body score averaged 30, indicating a need for more physical activity, while your Mind score was high at 88. No time with people was logged. Consider incorporating at least one physical activity each day to improve your Body score next week.

- checker: score-talk ("score"), score-talk ("score"), score-talk ("score")
- judge: no_evaluation, no_consolation, total_not_judged
- note: The evaluation includes reassurance and judgment.

## week: partial

- days covered: 3 of 7 (in progress); days with anything logged: 3
- hours: Deep Work 9h, Sleep 22h, Exercise 1h
- best days: Monday; best hours: 9 AM, 10 AM

> This week so far included 9 hours of deep work, with your best focus on Monday at 9 AM and 10 AM. Average scores for Body, Mind, and Heart were 45, 60, and 10, respectively, indicating low engagement in emotional activities. The absence of heart-centered activities suggests a need for more connection or reflection. Consider setting aside time for social interactions or personal reflection to address the low Heart score next week.

- checker: score-talk ("scores"), score-talk ("score")
- judge: no_evaluation, no_consolation, total_not_judged
- note: The line includes reassurance and suggests multiple activities.

> This week, you logged 9 hours of deep work, primarily focused on Monday. Sleep accounted for 22 hours, while only 1 hour was recorded for exercise. The average scores indicate low engagement in heart activities, with a score of 10/100. Consider scheduling intentional time for activities that foster connection and emotional well-being next week.

- checker: score-talk ("scores"), score-talk ("score"), score-talk ("/100")
- judge: total_not_judged
- note: The suggestion for next week is not appropriate for a weekly review.

> You logged three days so far, with a total of nine hours of deep work. Your average Body score is 45, Mind is 60, and Heart is 10. A pattern to watch is the low Heart score, indicating minimal emotional engagement or connection this week. Consider scheduling time for activities that promote social interaction or emotional fulfillment next week.

- checker: score-talk ("score"), score-talk ("score")
- judge: total_not_judged
- note: The total hours logged are judged.

## week: leisure-week

- days covered: all 7; days with anything logged: 7
- hours: Entertainment 30h, Sleep 60h, Meals 10h, Shallow Work 6h
- best days: Wednesday; best hours: 2 PM

> This week held 30 hours of entertainment and 10 hours spent on meals, with very low scores in Body, Mind, and Heart at 35, 10, and 5, respectively. The best focus day was Wednesday, with a peak focus hour at 2 PM. Watch for the significant amount of time dedicated to entertainment, which may be impacting your scores in other areas. Consider allocating time next week specifically for focused work or activities that engage your mind and heart.

- checker: score-talk ("scores"), score-talk ("scores")
- judge: no_consolation, total_not_judged
- note: The suggestion to allocate time next week is too encouraging.

> This week included 30 hours of entertainment and 60 hours of sleep, with the best focus occurring on Wednesday at 2 PM. The average scores show low engagement in Body, Mind, and Heart, with Body at 35, Mind at 10, and Heart at 5. There is a clear pattern of minimal time spent on activities that support mental and emotional well-being. For next week, consider allocating more time to activities that engage your mind and heart, such as reading or connecting with others.

- checker: score-talk ("scores")
- judge: no_consolation, total_not_judged
- note: The encouragement undermines the review.

> This week included 30 hours of entertainment and 6 hours of shallow work, with a focus peak on Wednesday at 2 PM. Your Body scored 35, Mind scored 10, and Heart scored 5, indicating significant room for improvement across all areas. There was no time with people logged. For next week, consider reducing entertainment hours and allocating that time towards activities that may enhance your Mind and Heart scores.

- checker: verdict ("room for improvement"), score-talk ("scored"), score-talk ("scored"), score-talk ("scored"), score-talk ("scores")
- judge: no_consolation, total_not_judged
- note: The suggestion to reduce entertainment hours is problematic.

## week: thin-week

- days covered: all 7; days with anything logged: 2
- hours: Deep Work 3h, Meals 1h
- best days: Monday; best hours: 10 AM

> You logged only two days this week, with a total of three hours of deep work and one hour for meals. Your average scores were low across all categories: Body at 5, Mind at 20, and Heart at 0. There is a pattern of insufficient engagement in activities related to your heart, as no time was logged for social connections. For next week, consider scheduling specific times for social interactions to ensure you include people in your routine.

- checker: score-talk ("scores")
- judge: no_evaluation, no_consolation, total_not_judged
- note: The evaluation includes reassurance and encouragement.

> You logged two days of activity this week, totaling three hours of deep work and one hour for meals. Your average scores were low across all categories, with Body at 5, Mind at 20, and Heart at 0. There is a pattern of limited engagement in personal connections and emotional activities, as no time with people was logged. For next week, consider scheduling specific times for social interactions to address the lack of connection.

- checker: score-talk ("scores")
- judge: total_not_judged
- note: The total hours logged were praised.

> This week included 3 hours of deep work and 1 hour for meals, with only 2 days having any time logged. The average scores indicate significant gaps in Body, Mind, and Heart, particularly with a score of 0 in Heart, suggesting a need for more emotional engagement. Consider allocating time for social interactions or activities that foster connection next week.

- checker: score-talk ("scores"), score-talk ("score")
- judge: no_consolation, total_not_judged
- note: The reassurance about emotional engagement is unnecessary.

## week: sleep-heavy

- days covered: all 7; days with anything logged: 7
- hours: Sleep 63h, Rest 10h, Calls 3h, Chores 6h
- best days: none; best hours: none

> This week included 63 hours of sleep and 10 hours of rest, but only 3 hours of calls and 6 hours of chores. The Body score averaged 40, the Mind score averaged 5, and the Heart score averaged 30. The low Mind score indicates a potential area needing attention. Consider scheduling specific activities for mental engagement next week to improve that score.

- checker: score-talk ("score"), score-talk ("score"), score-talk ("score"), score-talk ("score"), score-talk ("score")
- judge: total_not_judged
- note: The Mind score is critically low.

> This week included 63 hours of sleep and 10 hours of rest, but only 3 hours were logged for calls, indicating limited social interaction. The average scores for Body, Mind, and Heart were 40, 5, and 30, respectively, showing a significant deficit in mental engagement. Watch for the low Mind score, as it may suggest a need for more cognitive activities. For next week, consider dedicating specific time each day to activities that stimulate your mind, such as reading or puzzles.

- checker: score-talk ("scores"), score-talk ("score")
- judge: no_evaluation, no_consolation, total_not_judged
- note: The evaluation includes praise and encouragement.

> This week included 63 hours of sleep and 10 hours of rest. The average scores were low, with Body at 40, Mind at 5, and Heart at 30. No time with people was logged. Consider scheduling specific activities for mental engagement next week, as the Mind score indicates significant room for improvement.

- checker: verdict ("room for improvement"), score-talk ("scores"), score-talk ("score")
- judge: total_not_judged
- note: The Mind score is critically low.

