# Prompt evaluation — results and recommendations

Run with `npm run eval`. Two harnesses in `scripts/eval/`, both calling the
real OpenAI API with the **production prompts**, imported from
`src/lib/prompts.ts` rather than copied — a copy would drift the first time a
route was edited, and a passing eval against stale wording is worse than none.

Cost of the full run: **about $0.14** (1,000 categorisations ≈ 915k input
tokens, plus 18 replies and 18 judgements).

---

## 1. Categorisation — 1,000 entries

**96.6% (628/650)** on the groups with a defensible right answer. 350 entries
sit in groups with no single right answer and are reported as distributions.

| group | score |
|---|---|
| deep_work_explicit, meetings, learning, admin, errands, chores, commute, exercise, meals, sleep, social, calls, entertainment, mixed_activity | **100%** |
| **generic_work** ("Work", "At work", "Day job", "9-5") | **100%** |
| movement | 90% |
| shallow_work_explicit | 88% |
| creating | 86% |
| self_care | 83% |
| rest | 80% |

`generic_work` at 100% confirms the fix from earlier today: a bare "Work" now
reads as `deep_work`, where this morning it was `other` and then
`shallow_work`.

### The 5 distinct disagreements

Every one is arguable, and in three cases the model has the better of it:

| entry | model | expected | verdict |
|---|---|---|---|
| Nap | `sleep` | `rest` | **model is reasonable** — the taxonomy puts naps under rest, which is not obvious |
| Dentist | `errands` | `self_care` | **genuinely ambiguous** — it is an appointment and it is health |
| Timesheets | `admin` | `shallow_work` | **model is wrong** — the prompt says personal admin; timesheets are work |
| Photography walk | `exercise` | `creating` | **model is wrong** — the noun is the activity |
| pacing while on a call | `calls` | `movement` | **model is reasonable** |

Only two are worth a prompt change.

### Religious practice — the finding that matters

140 entries (prayer, salah, Quran study, Bible study, mass, synagogue, Torah
study, puja, fasting, rosary, worship practice, sermon prep…). There is no
category for any of it, so it scatters:

```
other 29% · learning 21% · self_care 11% · social 10% · creating 7%
meals 7% · admin 4% · deep_work 4% · entertainment 4% · meetings 4%
```

Nearly a third lands in the fallback, and near-identical activities land in
ten different buckets — "Bible study" reads as learning, "Church service" as
social, "Worship team practice" as creating, "Fasting" as meals. There is no
wording change that fixes this: the taxonomy has no home for the thing.

Since `other` now aggregates to **Ops**, a person's prayer currently shows up
as operational overhead. That is better than the previous behaviour, where it
counted as **Escape** next to television — but it is still wrong.

### Contested activities

120 entries whose worth a person could reasonably argue about — esports
practice, job applications, networking drinks, protest marches, day trading,
reading the news. 20% land in `other`, spread across 12 categories. The
fallback is still absorbing things that have a home.

### Messy input

90 entries. Placeholders behave correctly (`stuff`, `misc`, `asdf`, `???`, `x`
→ `other`). Encouragingly, "wrk", "WORK", "Trabajo", "Travail", "Arbeit" all
reach `deep_work`, so the generic-work rule generalises past English without
being told to.

---

## 2. Reply quality — 18 scenarios, judged per rule

Each reply graded by a second model against the rules the prompt sets. The
judge is fallible, so every failure is printed verbatim in the run output.

| rule | pass |
|---|---|
| no_blame | **18/18** |
| respectful_of_values | **18/18** |
| grounded | 17/18 |
| answers_question | 14/18 |
| no_unsolicited_advice | 14/18 |
| no_defending | 14/18 |
| **has_voice** | **4/18** |

**The two things the rewrite was for are fixed.** Nothing implied the person
was lazy or distracted, and nothing passed judgement on how they spend their
time — including every religious scenario.

**The voice is gone.** 4 out of 18. This is the clear headline and it is a
self-inflicted wound: the rewrite stacked six prohibitions against one
adjective ("cheeky is fine"), and the prohibitions won. Typical output:

> The afternoon work was categorized as shallow work because of the text in
> the activity name, not because of the effort or focus you put into it.

Correct, kind, and completely inert.

**Pushback is the weakest question type** — 9 rule breaches across 4
scenarios, every `no_defending` failure among them:

> **"You are just guessing about me, arent you?"**
> → *No, I'm not guessing. I'm basing my response solely on the data you
> provided…*

> **"That feels insulting, I was working my 9-5 as an actuary all day."**
> → *I understand where you're coming from… If you feel it should be
> categorized differently, that's a valid perspective.*

The second one does not answer anything. "Do not defend a previous answer" was
too abstract an instruction to act on.

**Asking for advice now fails too** — my over-correction:

> **"What should I do differently tomorrow?"**
> → *I can't tell you what to do differently, but… you might consider
> planning some different types of activities.*

It refuses, then hedges advice anyway. "No closing advice unless asked" made
it treat advice as forbidden rather than unsolicited.

---

## Recommendations, in the order I would do them

1. **Show the voice instead of describing it.** Put two or three example
   exchanges in the thread prompt, as the commentary prompt already does with
   "Third TikTok session today. Come on." Ban the specific tics the eval
   surfaced: "I understand where you're coming from", "I'm sorry if", "that's
   a valid perspective", "it doesn't take away from".

2. **Make the pushback rule concrete.** Replace "do not defend a previous
   answer" with the actual move: when challenged, lead with the concession or
   the correction, never with "No" or "I understand… but". One worked example
   will do more than the rule.

3. **Let it answer "what should I do".** When the question asks for a
   suggestion, give one specific suggestion grounded in the data. The current
   rule is suppressing the answer rather than the lecture.

4. **Decide what to do about religious practice.** This is a product
   decision, not a prompt one. Either add a category — `faith` or
   `spiritual`, which means a Supabase enum change, a bucket in `ENERGY_VIEW`
   and a scoring weight — or decide deliberately where it belongs and say so
   in the prompt so it stops scattering across ten buckets. Doing nothing
   leaves a third of it in the fallback.

5. **Two small categoriser fixes:** timesheets and similar work admin belong
   in `shallow_work`, not personal `admin`; and an activity named after a
   craft ("Photography walk") is `creating` even when it involves walking.

6. **Give the contested group a rule.** Job applications, networking,
   mentoring and side hustles have homes in the taxonomy; say so, and keep
   pushing `other` towards genuinely unclassifiable input.

Re-run `npm run eval` after each change. The categorisation harness is
deterministic (`temperature: 0`); the reply harness is not, so treat small
movements there as noise and look at the transcripts.
