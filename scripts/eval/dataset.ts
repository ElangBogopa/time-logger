/**
 * Evaluation dataset for the categoriser.
 *
 * Grouped by the kind of judgement each case asks for, because an overall
 * accuracy number hides the only interesting part — which kinds of activity
 * the model gets wrong. `accept` is the set of categories a reasonable person
 * would be happy with; `null` means there is no defensible single answer and
 * the run reports the distribution instead of scoring it.
 */

import { TimeCategory } from '../../src/lib/types'

export interface Case {
  text: string
  group: string
  accept: TimeCategory[] | null
  /** Why this case is here, for cases whose expectation is not obvious. */
  note?: string
}

type Spec = [group: string, accept: TimeCategory[] | null, texts: string[], note?: string]

const SPECS: Spec[] = [
  // ─── the ordinary middle of the distribution ───
  ['deep_work_explicit', ['deep_work'], [
    'Coding the payments service', 'Writing the quarterly report', 'Refactoring the auth module',
    'Designing the new dashboard', 'Data analysis for pricing model', 'Debugging production issue',
    'Writing technical spec', 'Building the reserving model', 'Reviewing actuarial assumptions',
    'Deep work on valuation model', 'Modelling mortality tables', 'Drafting the research paper',
  ]],
  ['generic_work', ['deep_work'], [
    'Work', 'Working', 'Worked', 'At work', 'Office', 'Day job', 'Work session', 'Work block',
    '9-5', 'In the office', 'Back to work', 'Work time',
  ], 'A bare working day. Previously fell through to other, then to shallow_work.'],
  ['shallow_work_explicit', ['shallow_work'], [
    'Answering work email', 'Clearing Slack backlog', 'Filing expenses', 'Timesheets',
    'Status update for the team', 'Quick code review', 'Updating Jira tickets', 'Inbox zero',
  ]],
  ['meetings', ['meetings'], [
    'Standup', 'Sprint planning', '1:1 with manager', 'Client call', 'Team retro',
    'Quarterly review meeting', 'Interview panel', 'All hands',
  ]],
  ['learning', ['learning'], [
    'STA414H1 lecture', 'CSC108 tutorial', 'Studying for actuarial exam', 'Reading the textbook',
    'Online course on statistics', 'Watching a lecture on probability', 'Exam revision',
    'Reading documentation', 'Seminar on risk modelling',
  ]],
  ['creating', ['creating'], [
    'Guitar practice', 'Painting', 'Writing a short story', 'Side project', 'Making music',
    'Photography walk', 'Woodworking',
  ]],
  ['admin', ['admin'], ['Paying bills', 'Doing taxes', 'Booking a dentist appointment', 'Budgeting', 'Sorting out insurance']],
  ['errands', ['errands'], ['Grocery shopping', 'Bank visit', 'Post office', 'Picking up a parcel', 'Car service']],
  ['chores', ['chores'], ['Laundry', 'Washing dishes', 'Cooking dinner', 'Cleaning the kitchen', 'Taking out bins']],
  ['commute', ['commute'], ['Commute to work', 'Driving home', 'Train to the office', 'Bus ride in', 'Walking to the station']],
  ['exercise', ['exercise'], ['Gym: Leg Day', 'Morning run', 'Swimming', 'Football match', 'Weight training', 'Spin class', 'Boxing']],
  ['movement', ['movement', 'exercise'], ['Short walk', 'Stretching', 'Walking the dog', 'Pacing while on a call']],
  ['meals', ['meals'], ['Lunch', 'Breakfast', 'Dinner with the family', 'Coffee and a sandwich', 'Eating out']],
  ['sleep', ['sleep', 'rest'], ['Sleep', 'Slept 8 hours', 'Went to bed early', 'Overnight']],
  ['rest', ['rest'], ['Nap', 'Lying down', 'Unwinding', 'Quiet time', 'Doing nothing on purpose']],
  ['self_care', ['self_care'], ['Shower', 'Skincare routine', 'Therapy session', 'Dentist', 'Taking medication', 'Journalling']],
  ['social', ['social'], ['Dinner with friends', 'Family time', 'Birthday party', 'Catching up with a mate', 'Date night']],
  ['calls', ['calls', 'social'], ['Call with mum', 'FaceTime with my brother', 'Phone call with a friend']],
  ['entertainment', ['entertainment'], ['Netflix', 'Gaming', 'Scrolling TikTok', 'YouTube', 'Watching football', 'Browsing Reddit']],

  // ─── religious and spiritual practice: the app has no category for it ───
  ['religious_practice', null, [
    'Morning prayer', 'Salah', 'Fajr prayer', 'Reading the Quran', 'Quran study circle',
    'Bible study', 'Church service', 'Sunday mass', 'Youth group at church', 'Worship team practice',
    'Synagogue', 'Torah study', 'Shabbat dinner', 'Temple visit', 'Puja',
    'Meditation (Buddhist practice)', 'Rosary', 'Confession', 'Fasting', 'Devotional reading',
    'Volunteering at the mosque', 'Choir practice', 'Tithing and church finances', 'Sermon prep',
    'Islamic history lecture', 'Christian apologetics podcast', 'Prayer meeting', 'Retreat day',
  ], 'There is no religious category. Whatever it picks, some users will find it wrong — the point is to see what it picks and how consistent it is.'],

  // ─── activities whose value is genuinely contested ───
  ['contested_value', null, [
    'Esports training', 'Competitive gaming practice', 'Streaming on Twitch', 'Watching a documentary',
    'Reading fiction', 'Doomscrolling the news', 'Reading the news', 'Networking drinks',
    'Crypto trading', 'Day trading', 'Job applications', 'Updating my CV', 'LinkedIn',
    'Political organising', 'Protest march', 'Volunteering', 'Mentoring a junior',
    'Scrolling for design inspiration', 'Research on Twitter', 'Napping to recover from training',
    'Cleaning instead of working', 'Side hustle', 'Selling on eBay', 'Planning a holiday',
  ], 'A person could reasonably call several of these productive; the model should at least be consistent and never land on other.'],

  // ─── mixed activities: the prompt says favour the productive half ───
  ['mixed_activity', ['deep_work', 'learning'], [
    'Coding + TikTok', 'Studying while checking Instagram', 'Working on the model with YouTube on',
    'Writing the report, kept getting distracted', 'Revision with music on',
  ]],

  // ─── messy input ───
  ['messy_input', null, [
    'wrk', 'WORK', 'work!!!', 'gym 💪', 'Gym 🏋️‍♂️ leg day', 'mtg w/ boss', 'stuff', 'things', 'misc',
    'asdf', '???', '30', 'x', 'Trabajo', 'Travail', 'Kazi', 'Arbeit',
    'had a really long day where I did a bit of everything, some emails, a call, then actual work on the model for a while before lunch',
  ], 'Typos, other languages, placeholders and one over-long entry.'],
]

/** Light variations that must not change the right answer. */
const VARIANTS: ((t: string) => string)[] = [
  (t) => t,
  (t) => t.toLowerCase(),
  (t) => `${t} `,
  (t) => `${t}.`,
  (t) => t.replace(/\s+/g, ' ').trim(),
  (t) => (t.length > 3 ? `${t} (1h)` : t),
  (t) => (t.length > 3 ? `${t} - ${t.length % 2 === 0 ? 'morning' : 'afternoon'}` : t),
]

export function buildDataset(target = 1000): Case[] {
  const base: Case[] = []
  for (const [group, accept, texts, note] of SPECS) {
    for (const text of texts) base.push({ text, group, accept, note })
  }

  const cases: Case[] = []
  let variant = 0
  // Cycle variants so every group grows at the same rate rather than padding
  // one group to hit the target.
  while (cases.length < target) {
    const shape = VARIANTS[variant % VARIANTS.length]
    for (const c of base) {
      if (cases.length >= target) break
      const text = shape(c.text)
      cases.push({ ...text ? { ...c, text } : c })
    }
    variant++
  }
  return cases
}

export const GROUPS = Array.from(new Set(SPECS.map(([g]) => g)))
