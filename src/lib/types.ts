export type TimeCategory =
  // PRODUCTIVE
  | 'deep_work'       // Focused cognitively demanding work
  | 'shallow_work'    // Quick tasks, admin within work context
  | 'meetings'        // Synchronous work communication
  | 'learning'        // Courses, studying, reading
  | 'creating'        // Creative hobbies, side projects

  // MAINTENANCE
  | 'admin'           // Personal admin (email, finances, planning)
  | 'errands'         // Outside home (shopping, appointments)
  | 'chores'          // Inside home (cleaning, cooking, repairs)
  | 'commute'         // Travel to/from obligations

  // BODY
  | 'exercise'        // Intentional workout
  | 'movement'        // Light activity (walks, stretching)
  | 'meals'           // Eating, food prep
  | 'sleep'           // Sleep tracking

  // MIND
  | 'rest'            // Intentional downtime, naps
  | 'self_care'       // Hygiene, meditation, health

  // CONNECTION
  | 'social'          // Friends, family, community
  | 'calls'           // Personal calls/video chats

  // LEISURE
  | 'entertainment'   // TV, games, movies, browsing

  // FALLBACK
  | 'other'           // Anything that doesn't fit

export type EntryStatus = 'confirmed' | 'pending'

// Reminder time configuration
export interface ReminderTime {
  id: string
  label: string
  time: string // HH:MM format
  enabled: boolean
}

// Pending target change (for delayed updates)
export interface PendingIntentionChange {
  action: 'add' | 'remove' | 'update'
  target_type?: WeeklyTargetType
  target_id?: string
  weekly_target_minutes?: number | null
  sort_order?: number
  queued_at: string // ISO date when the change was requested
  effective_date: string // ISO date when it takes effect (next Monday)
}

// User preferences
export interface UserPreferences {
  id: string
  user_id: string
  reminder_enabled: boolean
  reminder_times: ReminderTime[]
  intentions_committed_since: string | null // ISO date of last commitment
  pending_intention_changes: PendingIntentionChange[] | null
  created_at: string
  updated_at: string
}

// Default reminder times
export const DEFAULT_REMINDER_TIMES: ReminderTime[] = [
  { id: 'midday', label: 'Midday check-in', time: '12:00', enabled: true },
  { id: 'evening', label: 'Evening check-in', time: '18:00', enabled: true },
  { id: 'night', label: 'Night check-in', time: '21:00', enabled: true },
]

// Time periods for logging sessions
export type TimePeriod = 'morning' | 'afternoon' | 'evening'

export const PERIOD_LABELS: Record<TimePeriod, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
}

export const PERIOD_TIME_RANGES: Record<TimePeriod, { start: number; end: number }> = {
  morning: { start: 0, end: 12 },      // 12am - 12pm
  afternoon: { start: 12, end: 18 },   // 12pm - 6pm
  evening: { start: 18, end: 24 },     // 6pm - 12am
}

/**
 * Get the current time period based on hour.
 * Handles late-night hours (24-27) which represent midnight to 3am - still "evening".
 */
export function getCurrentPeriod(hour: number = new Date().getHours()): TimePeriod {
  // Late night (midnight to 3am) is still "evening" from user's perspective
  if (hour >= 24) return 'evening'
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

// Session state for UI display
export type SessionState = 'upcoming' | 'active' | 'logged' | 'skipped'

// Session completion record (stored in database)
export interface SessionCompletion {
  id: string
  user_id: string
  date: string
  period: TimePeriod
  completed_at: string
  entry_count: number
  total_minutes: number
  skipped: boolean
}

// Session info for UI rendering
export interface SessionInfo {
  period: TimePeriod
  state: SessionState
  entryCount: number
  totalMinutes: number
  completedAt?: string
  hasCompletion: boolean // user pressed "Done"
  hasEntries: boolean    // entries exist in this period
}

// Mood/energy levels for session check-in
export type MoodLevel = 'low' | 'okay' | 'great'

// Mood check-in record (stored in database)
export interface MoodCheckin {
  id: string
  user_id: string
  date: string
  period: TimePeriod
  mood: MoodLevel
  created_at: string
}

// Session-specific mood configuration
export interface SessionMoodConfig {
  prompt: string
  labels: Record<MoodLevel, string>
  // Longer motivational messages shown after check-in
  messages: Record<MoodLevel, string[]>
}

export const SESSION_MOOD_CONFIG: Record<TimePeriod, SessionMoodConfig> = {
  morning: {
    prompt: "How's your morning energy?",
    labels: {
      low: 'Slow start',
      okay: 'Steady',
      great: 'Ready to go',
    },
    messages: {
      low: [
        'Be gentle with yourself this morning. Small steps still move you forward.',
        'It\'s okay to start slow. "The secret of getting ahead is getting started." — Mark Twain',
        'Low energy today doesn\'t define your potential. One small win at a time.',
        'Some days you conquer the world, some days you just get through it. Both count.',
      ],
      okay: [
        'Steady and ready. "The way to get started is to quit talking and begin doing." — Walt Disney',
        'A calm start sets up a focused day. You\'ve got what it takes.',
        'Consistency is your superpower. Keep building momentum.',
        'You\'re in a good place to make today count. Trust your pace.',
      ],
      great: [
        '"The future depends on what you do today." — Gandhi. Channel that energy!',
        'This is your day. Use that spark for what matters most.',
        'High morning energy is a gift. Tackle your biggest challenge first.',
        'You woke up ready. Now go make something happen.',
      ],
    },
  },
  afternoon: {
    prompt: "How's your afternoon going?",
    labels: {
      low: 'Dragging',
      okay: 'Cruising',
      great: 'On fire',
    },
    messages: {
      low: [
        'The afternoon slump is real — and temporary. A short break can reset everything.',
        '"Almost everything will work again if you unplug it for a few minutes, including you." — Anne Lamott',
        'Running low? Step outside, stretch, or grab water. Small resets, big difference.',
        'Tired doesn\'t mean weak. It means you\'ve been working. Be kind to yourself.',
      ],
      okay: [
        'You\'re halfway there and holding steady. "The best way out is always through." — Robert Frost',
        'Cruising at a sustainable pace. That\'s how you finish strong.',
        'Keep that rhythm going. You\'re closer to the finish line than you think.',
        '"Doing the best at this moment puts you in the best place for the next." — Oprah',
      ],
      great: [
        'On fire! "Start strong, stay strong, finish strong." — Ralph Marston',
        'That second wind is powerful. Use it to tackle something meaningful.',
        'Afternoon peak energy — perfect for creative or complex work. Make it count!',
        'You\'re in the zone. Ride this momentum to a strong finish.',
      ],
    },
  },
  evening: {
    prompt: 'How did today go?',
    labels: {
      low: 'Drained',
      okay: 'Alright',
      great: 'Great day',
    },
    messages: {
      low: [
        '"You have survived everything you have been through, and you will survive this too." Rest up.',
        'Exhaustion is not a badge of honor. Tonight, rest is your most productive act.',
        'Tough day? You showed up anyway. Tomorrow is a fresh start waiting for you.',
        '"You are worth the quiet moment. You are worth the deeper breath." — Morgan Harper Nichols',
      ],
      okay: [
        'A solid day done. "There is virtue in work and there is virtue in rest. Use both." — Alan Cohen',
        'Not every day needs to be remarkable. Consistent days build remarkable lives.',
        'You made it through. Now let your mind and body recharge for tomorrow.',
        'Another day in the books. Rest well — you\'ve earned this evening.',
      ],
      great: [
        'What a day! Carry this feeling into a restful night and an even better tomorrow.',
        '"Brilliant things happen in calm minds." Tonight, rest and let tomorrow\'s brilliance build.',
        'Great days deserve great rest. You\'ve earned every moment of this evening.',
        'Remember what made today great. That\'s fuel for the days ahead.',
      ],
    },
  },
}

// Get a random message for a mood+period combination
export function getMoodMessage(period: TimePeriod, mood: MoodLevel): string {
  const messages = SESSION_MOOD_CONFIG[period].messages[mood]
  return messages[Math.floor(Math.random() * messages.length)]
}

// Mood emojis (same across all sessions)
export const MOOD_EMOJIS: Record<MoodLevel, string> = {
  low: '😴',
  okay: '😐',
  great: '⚡',
}

// Mood colors (same across all sessions)
export const MOOD_COLORS: Record<MoodLevel, string> = {
  low: 'text-amber-500',
  okay: 'text-blue-500',
  great: 'text-green-500',
}

// Legacy MOOD_CONFIG for backwards compatibility with tests
export const MOOD_CONFIG: Record<MoodLevel, { emoji: string; label: string; color: string }> = {
  low: { emoji: '😴', label: 'Low energy', color: 'text-amber-500' },
  okay: { emoji: '😐', label: 'Okay', color: 'text-blue-500' },
  great: { emoji: '⚡', label: 'Energized', color: 'text-green-500' },
}

/**
 * Get the period that the user is logging for (based on reminder context)
 * At 12pm reminder, they log morning activities
 * At 6pm reminder, they log afternoon activities
 * At 9pm reminder, they log evening activities
 */
export function getLoggingPeriod(hour: number = new Date().getHours()): TimePeriod {
  // Before noon or at noon = logging morning
  if (hour <= 12) return 'morning'
  // Before 6pm or at 6pm = logging afternoon
  if (hour <= 18) return 'afternoon'
  // After 6pm = logging evening
  return 'evening'
}

// ============================================================================
// WEEKLY TARGETS SYSTEM
// ============================================================================

export type WeeklyTargetType =
  | 'deep_focus'
  | 'exercise'
  | 'social_time'
  | 'recovery'
  | 'leisure'
  | 'meetings'

export type TargetDirection = 'at_least' | 'at_most'

export interface WeeklyTarget {
  id: string
  user_id: string
  target_type: WeeklyTargetType
  direction: TargetDirection
  weekly_target_minutes: number
  sort_order: number
  active: boolean
  created_at: string
}

export interface WeeklyTargetConfig {
  label: string
  description: string
  direction: TargetDirection
  defaultMinutes: number
  minMinutes: number
  maxMinutes: number
  unit: 'hours' | 'minutes'
  categories: TimeCategory[]
  color: string       // Tailwind color name (e.g. 'blue', 'green')
  ringColor: string   // SVG stroke color hex
  icon: string        // Emoji icon
  researchNote: string
}

export const WEEKLY_TARGET_CONFIGS: Record<WeeklyTargetType, WeeklyTargetConfig> = {
  deep_focus: {
    label: 'Deep Focus',
    description: 'Focused work, learning, and creative output',
    direction: 'at_least',
    defaultMinutes: 15 * 60, // 15 hrs/wk
    minMinutes: 5 * 60,
    maxMinutes: 25 * 60,
    unit: 'hours',
    categories: ['deep_work', 'learning', 'creating'],
    color: 'blue',
    ringColor: '#3b82f6',
    icon: '🧠',
    researchNote: 'Cal Newport: Experts sustain ~4 hrs/day of deep work. 15-20 hrs/week is a strong target.',
  },
  exercise: {
    label: 'Exercise',
    description: 'Intentional physical activity and movement',
    direction: 'at_least',
    defaultMinutes: 150, // 2.5 hrs/wk (WHO minimum)
    minMinutes: 60,
    maxMinutes: 450,
    unit: 'minutes',
    categories: ['exercise', 'movement'],
    color: 'green',
    ringColor: '#22c55e',
    icon: '💪',
    researchNote: 'WHO: 150-300 min/week moderate activity. Only 31% of adults meet this minimum.',
  },
  social_time: {
    label: 'Social Time',
    description: 'Quality time with friends, family, and community',
    direction: 'at_least',
    defaultMinutes: 10 * 60, // 10 hrs/wk
    minMinutes: 3 * 60,
    maxMinutes: 21 * 60,
    unit: 'hours',
    categories: ['social', 'calls'],
    color: 'pink',
    ringColor: '#ec4899',
    icon: '💬',
    researchNote: 'Research: 9-12 hrs/week minimum to avoid loneliness. Social connection increases survival odds by 50%.',
  },
  recovery: {
    label: 'Recovery',
    description: 'Rest, self-care, and sleep for recharging',
    direction: 'at_least',
    defaultMinutes: 7 * 60, // 7 hrs/wk
    minMinutes: 3 * 60,
    maxMinutes: 14 * 60,
    unit: 'hours',
    categories: ['rest', 'self_care', 'sleep'],
    color: 'amber',
    ringColor: '#f59e0b',
    icon: '🔋',
    researchNote: '75% of employees report burnout. Intentional recovery prevents it. Short breaks improve mood and focus.',
  },
  leisure: {
    label: 'Leisure',
    description: 'Entertainment and passive screen time',
    direction: 'at_most',
    defaultMinutes: 10 * 60, // 10 hrs/wk
    minMinutes: 0,
    maxMinutes: 21 * 60,
    unit: 'hours',
    categories: ['entertainment'],
    color: 'zinc',
    ringColor: '#71717a',
    icon: '📺',
    researchNote: 'Research links >2 hrs/day recreational screen time to increased anxiety. Average attention span is 47 seconds.',
  },
  meetings: {
    label: 'Meetings',
    description: 'Synchronous work meetings and calls',
    direction: 'at_most',
    defaultMinutes: 10 * 60, // 10 hrs/wk
    minMinutes: 0,
    maxMinutes: 20 * 60,
    unit: 'hours',
    categories: ['meetings'],
    color: 'indigo',
    ringColor: '#6366f1',
    icon: '📅',
    researchNote: 'Microsoft research: Workers spend 57% of time in meetings/email. Reducing meetings increases deep focus.',
  },
}

// All target types ordered for display
export const WEEKLY_TARGET_TYPES: WeeklyTargetType[] = [
  'deep_focus', 'exercise', 'social_time', 'recovery', 'leisure', 'meetings',
]

// Maximum number of targets a user can select
export const MAX_WEEKLY_TARGETS = 5

/**
 * Calculate progress for a weekly target.
 * For at_least: 0-100% filling toward goal.
 * For at_most: 100% when under limit, decreasing as you exceed it.
 */
export function calculateTargetProgress(
  actualMinutes: number,
  targetMinutes: number,
  direction: TargetDirection
): number {
  if (targetMinutes === 0) return direction === 'at_most' ? 100 : 0

  if (direction === 'at_least') {
    return Math.min(100, Math.round((actualMinutes / targetMinutes) * 100))
  } else {
    // at_most: under limit = 100%, over = decreasing
    if (actualMinutes <= targetMinutes) {
      return 100
    }
    const overageRatio = actualMinutes / targetMinutes
    return Math.max(0, Math.round(100 - (overageRatio - 1) * 100))
  }
}

/**
 * Get feedback for target progress display
 */
export function getTargetFeedback(
  actualMinutes: number,
  targetMinutes: number,
  direction: TargetDirection
): { message: string; tone: 'success' | 'warning' | 'neutral' | 'danger' } {
  const progress = calculateTargetProgress(actualMinutes, targetMinutes, direction)

  if (direction === 'at_least') {
    if (progress >= 100) return { message: 'Target reached!', tone: 'success' }
    if (progress >= 75) return { message: 'Almost there', tone: 'neutral' }
    if (progress >= 50) return { message: 'Halfway', tone: 'neutral' }
    if (progress >= 25) return { message: 'Getting started', tone: 'warning' }
    return { message: 'Needs attention', tone: 'danger' }
  } else {
    if (actualMinutes === 0) return { message: 'Perfect!', tone: 'success' }
    if (actualMinutes <= targetMinutes * 0.5) return { message: 'Great restraint', tone: 'success' }
    if (actualMinutes <= targetMinutes) return { message: 'Within limit', tone: 'neutral' }
    if (actualMinutes <= targetMinutes * 1.5) return { message: 'Slightly over', tone: 'warning' }
    return { message: 'Over limit', tone: 'danger' }
  }
}

/**
 * Format target value for display (e.g. "15 hrs" or "150 min")
 */
export function formatTargetValue(minutes: number, unit: 'hours' | 'minutes'): string {
  if (unit === 'minutes' || minutes < 60) {
    return `${minutes} min`
  }
  const hours = minutes / 60
  if (hours === Math.floor(hours)) {
    return `${hours} hr${hours !== 1 ? 's' : ''}`
  }
  return `${hours.toFixed(1)} hrs`
}

// Map weekly target types to streak types for continuity
export const TARGET_TO_STREAK_MAP: Partial<Record<WeeklyTargetType, StreakType>> = {
  deep_focus: 'deep_work',
  exercise: 'exercise',
  social_time: 'relationships',
}

export interface TimeEntry {
  id: string
  user_id: string
  date: string
  activity: string
  category: TimeCategory | null  // null for pending entries until confirmed
  duration_minutes: number
  start_time: string | null
  end_time: string | null
  description: string | null
  commentary: string | null
  status: EntryStatus
  created_at: string
}

// Static commentary messages for pending entries
export const PENDING_COMMENTARY = {
  planned: 'Planned - confirm after it happens',
  calendar: 'Imported from calendar - confirm to categorize',
}

export const CATEGORY_LABELS: Record<TimeCategory, string> = {
  // Productive
  deep_work: 'Deep Work',
  shallow_work: 'Shallow Work',
  meetings: 'Meetings',
  learning: 'Learning',
  creating: 'Creating',
  // Maintenance
  admin: 'Admin',
  errands: 'Errands',
  chores: 'Chores',
  commute: 'Commute',
  // Body
  exercise: 'Exercise',
  movement: 'Movement',
  meals: 'Meals',
  sleep: 'Sleep',
  // Mind
  rest: 'Rest',
  self_care: 'Self Care',
  // Connection
  social: 'Social',
  calls: 'Calls',
  // Leisure
  entertainment: 'Entertainment',
  // Fallback
  other: 'Other',
}

// ============================================================================
// AGGREGATED CATEGORY VIEWS
// These group granular categories for different insights/views
// ============================================================================

export type AggregatedCategory =
  | 'focus'
  | 'ops'
  | 'body'
  | 'recovery'
  | 'connection'
  | 'escape'

export interface CategoryViewGroup {
  label: string
  color: string
  categories: TimeCategory[]
}

export type CategoryView = Record<AggregatedCategory, CategoryViewGroup>

/**
 * Energy/Mode View - How you spent your energy
 * Used for Day Review and daily balance insights
 */
export const ENERGY_VIEW: CategoryView = {
  focus: {
    label: 'Focus',
    color: 'blue',
    categories: ['deep_work', 'learning', 'creating'],
  },
  ops: {
    label: 'Ops',
    color: 'slate',
    categories: ['shallow_work', 'meetings', 'admin', 'errands', 'chores', 'commute'],
  },
  body: {
    label: 'Body',
    color: 'green',
    categories: ['exercise', 'movement', 'meals', 'sleep'],
  },
  recovery: {
    label: 'Recovery',
    color: 'amber',
    categories: ['rest', 'self_care'],
  },
  connection: {
    label: 'Connection',
    color: 'pink',
    categories: ['social', 'calls'],
  },
  escape: {
    label: 'Escape',
    color: 'zinc',
    categories: ['entertainment', 'other'],
  },
}

/**
 * Get aggregated category for a granular category
 */
export function getAggregatedCategory(category: TimeCategory): AggregatedCategory {
  for (const [aggCat, group] of Object.entries(ENERGY_VIEW)) {
    if (group.categories.includes(category)) {
      return aggCat as AggregatedCategory
    }
  }
  return 'ops' // Default fallback
}

/**
 * Aggregate minutes by category view
 */
export function aggregateByView(
  categoryMinutes: Map<TimeCategory, number>,
  view: CategoryView = ENERGY_VIEW
): Map<AggregatedCategory, number> {
  const aggregated = new Map<AggregatedCategory, number>()

  for (const [aggCat, group] of Object.entries(view)) {
    let total = 0
    for (const cat of group.categories) {
      total += categoryMinutes.get(cat) || 0
    }
    if (total > 0) {
      aggregated.set(aggCat as AggregatedCategory, total)
    }
  }

  return aggregated
}

export const AGGREGATED_CATEGORY_LABELS: Record<AggregatedCategory, string> = {
  focus: 'Focus',
  ops: 'Ops',
  body: 'Body',
  recovery: 'Recovery',
  connection: 'Connection',
  escape: 'Escape',
}

export const AGGREGATED_CATEGORY_COLORS: Record<AggregatedCategory, string> = {
  focus: 'bg-blue-500',
  ops: 'bg-slate-500',
  body: 'bg-green-500',
  recovery: 'bg-amber-500',
  connection: 'bg-pink-500',
  escape: 'bg-zinc-500',
}

/**
 * Research-based category definitions to help users categorize correctly.
 * Sources: Cal Newport (Deep Work), WHO (Exercise), Ericsson (Learning),
 * Social Connection Guidelines, and burnout prevention research.
 */
export const CATEGORY_DEFINITIONS: Record<TimeCategory, {
  definition: string
  includes: string[]
  excludes: string[]
  source?: string
}> = {
  // PRODUCTIVE
  deep_work: {
    definition: 'Distraction-free concentration on cognitively demanding tasks that create new value, improve skills, and are hard to replicate.',
    includes: [
      'Writing (articles, code, reports)',
      'Programming/coding',
      'Design work',
      'Problem-solving',
      'Strategic thinking',
      'Research and analysis',
    ],
    excludes: [
      'Email (→ Admin or Shallow Work)',
      'Meetings (→ Meetings)',
      'Routine tasks (→ Shallow Work)',
    ],
    source: 'Cal Newport - Deep Work',
  },
  shallow_work: {
    definition: 'Work tasks that are necessary but not cognitively demanding. Can be done while distracted.',
    includes: [
      'Work email and Slack',
      'Scheduling work meetings',
      'Filing and organizing work docs',
      'Expense reports',
      'Quick code reviews',
      'Status updates',
    ],
    excludes: [
      'Cognitively demanding work (→ Deep Work)',
      'Personal admin (→ Admin)',
    ],
    source: 'Cal Newport - Shallow Work definition',
  },
  meetings: {
    definition: 'Scheduled time with others for work coordination, collaboration, or professional discussions.',
    includes: [
      'Video/phone calls (work)',
      'Team standups',
      'One-on-ones',
      'Client meetings',
      'Presentations',
      'Interviews',
    ],
    excludes: [
      'Social calls with friends/family (→ Calls)',
      'Working sessions alone (→ Deep Work)',
    ],
  },
  learning: {
    definition: 'Deliberate practice: structured activities with specific goals and feedback, designed to improve skills.',
    includes: [
      'Courses and classes',
      'Tutorials with exercises',
      'Reading technical/educational books',
      'Practice with feedback',
      'Language learning',
      'Studying for exams',
    ],
    excludes: [
      'Passive content consumption (→ Entertainment)',
      'Reading for pleasure (→ Rest)',
    ],
    source: 'Anders Ericsson - Deliberate Practice',
  },
  creating: {
    definition: 'Creative output outside of work obligations. Hobbies and side projects that bring joy.',
    includes: [
      'Art and drawing',
      'Music (playing, composing)',
      'Writing for fun (fiction, blog)',
      'Side projects',
      'Crafts and DIY',
      'Photography',
    ],
    excludes: [
      'Work creative projects (→ Deep Work)',
      'Passive consumption (→ Entertainment)',
    ],
  },

  // MAINTENANCE
  admin: {
    definition: 'Personal life logistics. Tasks that keep your life running but aren\'t work.',
    includes: [
      'Personal email',
      'Bills and finances',
      'Scheduling appointments',
      'Planning and organizing',
      'Paperwork',
      'Research for purchases',
    ],
    excludes: [
      'Work admin (→ Shallow Work)',
      'Shopping trips (→ Errands)',
    ],
  },
  errands: {
    definition: 'Tasks that require leaving home. Life logistics outside your house.',
    includes: [
      'Grocery shopping',
      'Doctor/dentist appointments',
      'Bank visits',
      'Picking up packages',
      'Car maintenance',
      'Returns and exchanges',
    ],
    excludes: [
      'Home tasks (→ Chores)',
      'Leisure shopping (→ Entertainment)',
    ],
  },
  chores: {
    definition: 'Household tasks and maintenance. Keeping your home functional.',
    includes: [
      'Cleaning',
      'Laundry',
      'Cooking/meal prep',
      'Dishes',
      'Home repairs',
      'Organizing',
      'Pet care',
    ],
    excludes: [
      'Cooking as hobby (→ Creating)',
      'Outside errands (→ Errands)',
    ],
  },
  commute: {
    definition: 'Travel time to and from obligations. Time spent in transit.',
    includes: [
      'Commute to work',
      'Travel to appointments',
      'School drop-off/pickup',
      'Public transit',
      'Driving',
    ],
    excludes: [
      'Leisure walks (→ Movement)',
      'Road trips for fun (→ Entertainment)',
    ],
  },

  // BODY
  exercise: {
    definition: 'Intentional physical activity at moderate+ intensity. WHO recommends 150-300 min/week.',
    includes: [
      'Gym workouts',
      'Running/jogging',
      'Sports (tennis, basketball)',
      'Swimming laps',
      'Cycling (workout)',
      'Strength training',
      'Yoga classes',
      'HIIT',
    ],
    excludes: [
      'Casual walks (→ Movement)',
      'Stretching only (→ Movement)',
    ],
    source: 'WHO Physical Activity Guidelines',
  },
  movement: {
    definition: 'Light physical activity and incidental movement. Not structured exercise.',
    includes: [
      'Walking',
      'Stretching',
      'Standing desk time',
      'Light yoga',
      'Playing with kids',
      'Gardening',
    ],
    excludes: [
      'Intentional workouts (→ Exercise)',
      'Walking as commute (→ Commute)',
    ],
  },
  meals: {
    definition: 'Time spent eating. Separate from cooking (that\'s Chores) unless eating is the activity.',
    includes: [
      'Breakfast',
      'Lunch',
      'Dinner',
      'Snacks',
      'Coffee/tea breaks',
    ],
    excludes: [
      'Cooking (→ Chores)',
      'Social dinners (→ Social)',
    ],
  },
  sleep: {
    definition: 'Sleep and nap time. Track if you want to monitor sleep patterns.',
    includes: [
      'Night sleep',
      'Naps',
      'Rest in bed',
    ],
    excludes: [
      'Relaxing awake (→ Rest)',
    ],
  },

  // MIND
  rest: {
    definition: 'Intentional downtime for mental recovery. Essential for preventing burnout.',
    includes: [
      'Relaxing without screens',
      'Reading for pleasure',
      'Listening to music',
      'Sitting in nature',
      'Daydreaming',
      'Meditation breaks',
    ],
    excludes: [
      'Sleeping (→ Sleep)',
      'Scrolling (→ Entertainment)',
    ],
    source: 'Burnout prevention research',
  },
  self_care: {
    definition: 'Activities that maintain physical, mental, and emotional wellbeing.',
    includes: [
      'Personal hygiene',
      'Skincare routine',
      'Meditation/mindfulness',
      'Journaling',
      'Therapy sessions',
      'Medical self-care',
    ],
    excludes: [
      'Exercise (→ Exercise)',
      'Sleep (→ Sleep)',
    ],
    source: 'Self-care and burnout prevention research',
  },

  // CONNECTION
  social: {
    definition: 'Quality time with others in person. Research shows 7-21 hours/week prevents loneliness.',
    includes: [
      'Hanging out with friends',
      'Family time',
      'Date nights',
      'Parties and gatherings',
      'Group activities',
      'Visiting neighbors',
    ],
    excludes: [
      'Work meetings (→ Meetings)',
      'Video calls (→ Calls)',
    ],
    source: 'Social Connection Guidelines research',
  },
  calls: {
    definition: 'Personal phone/video calls. Staying connected remotely with people you care about.',
    includes: [
      'Video calls with friends/family',
      'Phone calls (personal)',
      'FaceTime/Zoom (social)',
    ],
    excludes: [
      'Work calls (→ Meetings)',
      'In-person hangouts (→ Social)',
    ],
  },

  // LEISURE
  entertainment: {
    definition: 'Passive and active leisure time. Unwinding and having fun.',
    includes: [
      'TV and movies',
      'Video games',
      'Social media',
      'YouTube/TikTok',
      'Browsing internet',
      'Reading news',
      'Podcasts (casual)',
    ],
    excludes: [
      'Educational content (→ Learning)',
      'Mindful relaxation (→ Rest)',
    ],
  },

  // FALLBACK
  other: {
    definition: 'Activities that don\'t fit other categories. Consider if another category might apply.',
    includes: [
      'Miscellaneous activities',
      'Transition time',
      'Waiting',
    ],
    excludes: [],
  },
}

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as TimeCategory[]

/**
 * Returns a date string in YYYY-MM-DD format using the user's local timezone.
 * This ensures "today" is based on the browser's local time, not UTC.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * The hour at which the "day" rolls over for the user.
 * Before this hour, we consider it still "yesterday" from the user's perspective.
 * This accounts for late-night users who haven't slept yet.
 */
export const DAY_ROLLOVER_HOUR = 3

/**
 * Returns the real calendar date, ignoring rollover.
 * Use this for DATA WRITES — entries should always be saved to the actual date.
 */
export function getRealToday(now: Date = new Date()): string {
  return getLocalDateString(now)
}

/**
 * Returns "today" from the user's perspective, accounting for late nights.
 * If it's before 3 AM, returns yesterday's date (the user is still in that day mentally).
 * After 3 AM, returns the actual calendar date.
 * Use this for VIEW/DISPLAY only — not for saving data.
 */
export function getUserToday(now: Date = new Date()): string {
  const hour = now.getHours()

  if (hour < DAY_ROLLOVER_HOUR) {
    // Before 3 AM - still "yesterday" from user's perspective
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return getLocalDateString(yesterday)
  }

  return getLocalDateString(now)
}

/**
 * Returns the current hour adjusted for day rollover.
 * If it's 1 AM (hour 1), this returns 25 (still part of "yesterday" evening).
 * If it's 3 AM (hour 3), this returns 3 (start of new day).
 */
export function getUserCurrentHour(now: Date = new Date()): number {
  const hour = now.getHours()

  if (hour < DAY_ROLLOVER_HOUR) {
    // Before 3 AM - treat as late evening hours (24, 25, 26)
    return 24 + hour
  }

  return hour
}

/**
 * Checks if a given date + end time is in the future.
 * Used to determine if an entry should be marked as "pending".
 */
export function isEntryInFuture(date: string, endTime: string | null): boolean {
  if (!endTime) return false

  const now = new Date()
  const [hours, minutes] = endTime.split(':').map(Number)
  const entryEnd = new Date(date + 'T00:00:00')
  entryEnd.setHours(hours, minutes, 0, 0)

  return entryEnd > now
}

/**
 * Maximum number of days in the past that users can log new entries.
 * Today = 0, yesterday = 1, 2 days ago = 2
 */
export const MAX_DAYS_BACK_FOR_LOGGING = 2

/**
 * Checks if a date is within the loggable range (today, yesterday, or 2 days ago).
 * Returns true if the date is loggable, false if it's too far in the past.
 */
export function isDateLoggable(dateStr: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const targetDate = new Date(dateStr + 'T00:00:00')
  targetDate.setHours(0, 0, 0, 0)

  // Calculate days difference
  const diffTime = today.getTime() - targetDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  // Allow today (0), yesterday (1), and 2 days ago (2)
  // Also allow future dates (diffDays < 0)
  return diffDays <= MAX_DAYS_BACK_FOR_LOGGING
}

/**
 * Returns a human-readable message explaining why logging is disabled.
 */
export const LOGGING_DISABLED_MESSAGE = "You can only log activities from the past 2 days. Try to log closer to when things happen!"

/**
 * Returns a message for the viewing-only state.
 */
export const VIEWING_PAST_MESSAGE = "You're viewing past entries. Logging is only available for today and yesterday."

/**
 * Checks if a pending entry's end time has passed and is ready to confirm.
 */
export function isPendingEntryReadyToConfirm(entry: TimeEntry): boolean {
  if (entry.status !== 'pending') return false
  if (!entry.end_time) return false

  return !isEntryInFuture(entry.date, entry.end_time)
}

// ============================================================================
// INTENTION COMMITMENT HELPERS
// ============================================================================

/**
 * Gets the next Monday from a given date.
 * If today is Monday, returns next Monday (not today).
 */
export function getNextMonday(fromDate: Date = new Date()): string {
  const date = new Date(fromDate)
  const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, ...
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) // Sunday = 1 day, Monday = 7 days, etc.
  date.setDate(date.getDate() + daysUntilMonday)
  return getLocalDateString(date)
}

/**
 * Gets the start of the current week (Monday).
 */
export function getCurrentWeekMonday(fromDate: Date = new Date()): string {
  const date = new Date(fromDate)
  const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, ...
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Sunday goes back 6, Monday stays, etc.
  date.setDate(date.getDate() - daysToSubtract)
  return getLocalDateString(date)
}

/**
 * Calculates the number of full weeks since a commitment date.
 */
export function calculateCommitmentWeeks(committedSince: string | null): number {
  if (!committedSince) return 0

  const commitDate = new Date(committedSince + 'T00:00:00')
  const now = new Date()
  const diffTime = now.getTime() - commitDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  return Math.floor(diffDays / 7)
}

/**
 * Calculates the number of days since a commitment date.
 */
export function calculateCommitmentDays(committedSince: string | null): number {
  if (!committedSince) return 0

  const commitDate = new Date(committedSince + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diffTime = now.getTime() - commitDate.getTime()
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Gets contextual encouragement message based on commitment streak days.
 * These messages emphasize why staying committed to intentions matters.
 */
export function getCommitmentMessage(days: number): string {
  if (days < 7) {
    return "Stay the course. Frequent changes reduce success."
  } else if (days < 14) {
    return "One week strong. Consistency builds results."
  } else if (days < 30) {
    return "Staying focused. Your commitment is building momentum."
  } else if (days < 66) {
    return "Over a month! This consistency drives real change."
  } else {
    return "True commitment. You're proving goals stick with focus."
  }
}

/**
 * Checks if a date has passed (for applying pending changes).
 */
export function isDatePassed(dateStr: string): boolean {
  const targetDate = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return targetDate <= today
}

/**
 * Formats the commitment streak for display (days-based).
 */
export function formatCommitmentStreak(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return '1 day'
  return `${days} days`
}

// ============================================================================
// STREAK SYSTEM TYPES AND HELPERS
// ============================================================================

export type StreakType = 'deep_work' | 'exercise' | 'focus' | 'learning' | 'relationships' | 'custom'

export interface UserStreak {
  id: string
  user_id: string
  streak_type: StreakType
  intention_id: string | null

  // Personal best
  personal_best_days: number
  personal_best_achieved_at: string | null

  // Current streak (cached)
  current_streak_days: number
  current_streak_start_date: string | null
  last_calculated_at: string

  // Grace days
  grace_days_used: number
  grace_week_start: string | null

  created_at: string
  updated_at: string
}

// Streak configuration per type
export interface StreakConfig {
  label: string
  emoji: string
  description: string
  // How to calculate if a day "counts"
  threshold: {
    type: 'minutes' | 'entries' | 'absence' // minutes of category, any entry, or no entries
    categories: TimeCategory[]
    minMinutes?: number // For 'minutes' type
  }
  // Milestones for celebration
  milestones: number[] // [7, 14, 30, 60, 100, 365]
  // Grace days allowed per week
  graceDaysPerWeek: number
}

export const STREAK_CONFIGS: Record<StreakType, StreakConfig> = {
  deep_work: {
    label: 'Deep Work',
    emoji: '💻',
    description: 'Days with 2+ hours of focused work',
    threshold: {
      type: 'minutes',
      categories: ['deep_work'],
      minMinutes: 120, // 2 hours
    },
    milestones: [7, 14, 30, 60, 100, 365],
    graceDaysPerWeek: 1,
  },
  exercise: {
    label: 'Exercise',
    emoji: '💪',
    description: 'Days with any exercise logged',
    threshold: {
      type: 'entries',
      categories: ['exercise', 'movement'],
    },
    milestones: [7, 14, 30, 60, 100, 365],
    graceDaysPerWeek: 2, // Rest days are important for exercise
  },
  focus: {
    label: 'Focus',
    emoji: '🎯',
    description: 'Days with minimal entertainment time',
    threshold: {
      type: 'absence',
      categories: ['entertainment'],
    },
    milestones: [7, 14, 30, 60, 100, 365],
    graceDaysPerWeek: 1,
  },
  learning: {
    label: 'Learning',
    emoji: '📚',
    description: 'Days with 30+ minutes of learning',
    threshold: {
      type: 'minutes',
      categories: ['learning'],
      minMinutes: 30,
    },
    milestones: [7, 14, 30, 60, 100, 365],
    graceDaysPerWeek: 2,
  },
  relationships: {
    label: 'Connection',
    emoji: '❤️',
    description: 'Days with quality social time',
    threshold: {
      type: 'entries',
      categories: ['social', 'calls'],
    },
    milestones: [7, 14, 30, 60, 100, 365],
    graceDaysPerWeek: 2,
  },
  custom: {
    label: 'Custom',
    emoji: '⭐',
    description: 'Custom streak goal',
    threshold: {
      type: 'entries',
      categories: [],
    },
    milestones: [7, 14, 30, 60, 100, 365],
    graceDaysPerWeek: 1,
  },
}

// Calculate daily target from weekly intention
export function calculateDailyTarget(weeklyMinutes: number | null, daysPerWeek: number = 7): number | null {
  if (!weeklyMinutes || weeklyMinutes <= 0) return null
  // Round to nearest 5 minutes for cleaner display
  return Math.round(weeklyMinutes / daysPerWeek / 5) * 5
}

// Format minutes for display in streak description
export function formatMinutesForStreak(minutes: number): string {
  if (minutes >= 60) {
    const hours = minutes / 60
    if (hours === Math.floor(hours)) {
      return `${hours}+ hour${hours !== 1 ? 's' : ''}`
    }
    return `${hours.toFixed(1)}+ hours`
  }
  return `${minutes}+ min`
}

// Calculate if a day meets the streak requirement
// customMinMinutes overrides the config threshold for personalized goals
export function dayMeetsStreakRequirement(
  entries: TimeEntry[],
  config: StreakConfig,
  customMinMinutes?: number
): boolean {
  const { threshold } = config
  const relevantEntries = entries.filter(
    e => e.status === 'confirmed' && threshold.categories.includes(e.category!)
  )

  switch (threshold.type) {
    case 'minutes': {
      const totalMinutes = relevantEntries.reduce((sum, e) => sum + e.duration_minutes, 0)
      const requiredMinutes = customMinMinutes ?? threshold.minMinutes ?? 0
      return totalMinutes >= requiredMinutes
    }
    case 'entries': {
      // If custom minutes provided, use that as threshold instead of "any entry"
      if (customMinMinutes && customMinMinutes > 0) {
        const totalMinutes = relevantEntries.reduce((sum, e) => sum + e.duration_minutes, 0)
        return totalMinutes >= customMinMinutes
      }
      return relevantEntries.length > 0
    }
    case 'absence': {
      // For absence type, check if there are NO entries in the categories
      const hasAny = entries.some(
        e => e.status === 'confirmed' && threshold.categories.includes(e.category!)
      )
      // Only count days where user was active (logged something)
      const wasActive = entries.some(e => e.status === 'confirmed')
      return wasActive && !hasAny
    }
    default:
      return false
  }
}

// Get next milestone for a streak
export function getNextMilestone(currentDays: number, milestones: number[]): number | null {
  for (const milestone of milestones) {
    if (milestone > currentDays) {
      return milestone
    }
  }
  return null
}

// Get recently achieved milestone (within last streak period)
export function getRecentMilestone(currentDays: number, milestones: number[]): number | null {
  let recent: number | null = null
  for (const milestone of milestones) {
    if (milestone <= currentDays) {
      recent = milestone
    } else {
      break
    }
  }
  return recent
}

// Calculate weekly consistency score (e.g., 5/7 days)
export interface WeeklyConsistency {
  daysHit: number
  totalDays: number // Days with any activity
  percentage: number
  isPerfect: boolean
}

export function calculateWeeklyConsistency(
  entriesByDate: Map<string, TimeEntry[]>,
  config: StreakConfig,
  weekStartDate: string,
  customMinMinutes?: number
): WeeklyConsistency {
  let daysHit = 0
  let totalDays = 0

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStartDate + 'T00:00:00')
    date.setDate(date.getDate() + i)
    const dateStr = getLocalDateString(date)

    // Don't count future days
    if (date > new Date()) break

    const dayEntries = entriesByDate.get(dateStr) || []
    const wasActive = dayEntries.some(e => e.status === 'confirmed')

    if (wasActive) {
      totalDays++
      if (dayMeetsStreakRequirement(dayEntries, config, customMinMinutes)) {
        daysHit++
      }
    }
  }

  const percentage = totalDays > 0 ? Math.round((daysHit / totalDays) * 100) : 0

  return {
    daysHit,
    totalDays,
    percentage,
    isPerfect: totalDays > 0 && daysHit === totalDays,
  }
}

// Streak calculation result with grace days
export interface StreakCalculation {
  currentStreak: number
  personalBest: number
  isNewPersonalBest: boolean
  graceDaysUsed: number
  graceDaysRemaining: number
  streakStartDate: string | null
  // For display
  nextMilestone: number | null
  recentMilestone: number | null
  weeklyConsistency: WeeklyConsistency
}

// Get start of week (Sunday)
export function getWeekStartDate(date: Date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sunday
  d.setDate(d.getDate() - day)
  return getLocalDateString(d)
}

// Calculate streak with grace day support
// customMinMinutes allows personalizing threshold based on user's intention target
export function calculateStreakWithGrace(
  entriesByDate: Map<string, TimeEntry[]>,
  config: StreakConfig,
  existingPersonalBest: number = 0,
  customMinMinutes?: number
): StreakCalculation {
  const today = new Date()
  const weekStart = getWeekStartDate(today)
  let currentStreak = 0
  let graceDaysUsed = 0
  let streakStartDate: string | null = null
  const maxGraceDays = config.graceDaysPerWeek

  // Track grace days per week
  const graceByWeek = new Map<string, number>()

  // Calculate from yesterday backwards (today is still in progress)
  for (let daysAgo = 1; daysAgo <= 365; daysAgo++) {
    const date = new Date(today)
    date.setDate(date.getDate() - daysAgo)
    const dateStr = getLocalDateString(date)
    const dayEntries = entriesByDate.get(dateStr) || []

    // Check if user was active this day
    const wasActive = dayEntries.some(e => e.status === 'confirmed')

    if (!wasActive) {
      // No activity - check if we can use a grace day
      const weekOfDay = getWeekStartDate(date)
      const weekGraceUsed = graceByWeek.get(weekOfDay) || 0

      if (weekGraceUsed < maxGraceDays) {
        // Use grace day
        graceByWeek.set(weekOfDay, weekGraceUsed + 1)
        graceDaysUsed++
        currentStreak++
        if (!streakStartDate) streakStartDate = dateStr
        continue
      } else {
        // No grace days left, streak broken
        break
      }
    }

    const metRequirement = dayMeetsStreakRequirement(dayEntries, config, customMinMinutes)

    if (metRequirement) {
      currentStreak++
      streakStartDate = dateStr
    } else {
      // Didn't meet requirement - check grace day
      const weekOfDay = getWeekStartDate(date)
      const weekGraceUsed = graceByWeek.get(weekOfDay) || 0

      if (weekGraceUsed < maxGraceDays) {
        graceByWeek.set(weekOfDay, weekGraceUsed + 1)
        graceDaysUsed++
        currentStreak++
        if (!streakStartDate) streakStartDate = dateStr
      } else {
        // Streak broken
        break
      }
    }
  }

  // Calculate weekly consistency for current week
  const weeklyConsistency = calculateWeeklyConsistency(entriesByDate, config, weekStart, customMinMinutes)

  // Check grace days remaining for current week
  const currentWeekGraceUsed = graceByWeek.get(weekStart) || 0
  const graceDaysRemaining = Math.max(0, maxGraceDays - currentWeekGraceUsed)

  const isNewPersonalBest = currentStreak > existingPersonalBest
  const personalBest = isNewPersonalBest ? currentStreak : existingPersonalBest

  return {
    currentStreak,
    personalBest,
    isNewPersonalBest,
    graceDaysUsed,
    graceDaysRemaining,
    streakStartDate,
    nextMilestone: getNextMilestone(currentStreak, config.milestones),
    recentMilestone: getRecentMilestone(currentStreak, config.milestones),
    weeklyConsistency,
  }
}
