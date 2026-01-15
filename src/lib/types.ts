export type TimeCategory =
  | 'deep_work'
  | 'meetings'
  | 'admin'
  | 'learning'
  | 'exercise'
  | 'rest'
  | 'meals'
  | 'self_care'
  | 'relationships'
  | 'distraction'
  | 'other'

export type EntryStatus = 'confirmed' | 'pending'

// Intention types for user goals
export type IntentionType =
  | 'deep_work'
  | 'less_distraction'
  | 'work_life_balance'
  | 'exercise'
  | 'self_care'
  | 'relationships'
  | 'learning'
  | 'custom'

export interface UserIntention {
  id: string
  user_id: string
  intention_type: IntentionType
  custom_text: string | null
  weekly_target_minutes: number | null
  priority: number // 1-3
  active: boolean
  created_at: string
}

// Reminder time configuration
export interface ReminderTime {
  id: string
  label: string
  time: string // HH:MM format
  enabled: boolean
}

// Pending intention change (for delayed updates)
export interface PendingIntentionChange {
  action: 'add' | 'remove' | 'update'
  intention_type?: IntentionType
  intention_id?: string
  custom_text?: string | null
  weekly_target_minutes?: number | null
  priority?: number
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

export const INTENTION_LABELS: Record<IntentionType, string> = {
  deep_work: 'Deep focused work',
  less_distraction: 'Less scrolling & distractions',
  work_life_balance: 'Better work-life balance',
  exercise: 'Consistent exercise',
  self_care: 'More rest & self-care',
  relationships: 'Quality time with people',
  learning: 'More learning',
  custom: 'Custom goal',
}

export const INTENTION_DESCRIPTIONS: Record<IntentionType, string> = {
  deep_work: 'Spend more time in focused, uninterrupted work sessions',
  less_distraction: 'Reduce time spent on social media and aimless browsing',
  work_life_balance: 'Create clearer boundaries between work and personal time',
  exercise: 'Build a regular exercise habit and stay active',
  self_care: 'Prioritize rest, recovery, and taking care of yourself',
  relationships: 'Make time for friends, family, and meaningful connections',
  learning: 'Dedicate time to learning new skills and knowledge',
  custom: 'Set your own personalized goal',
}

// Map intentions to relevant time categories for tracking
export const INTENTION_CATEGORY_MAP: Record<IntentionType, TimeCategory[]> = {
  deep_work: ['deep_work'],
  less_distraction: ['distraction'], // Track to minimize
  work_life_balance: ['rest', 'relationships', 'self_care'],
  exercise: ['exercise'],
  self_care: ['self_care', 'rest'],
  relationships: ['relationships'],
  learning: ['learning'],
  custom: [], // User defines what to track
}

// Research-based intention configurations
export interface IntentionConfig {
  label: string
  description: string
  direction: 'maximize' | 'minimize'
  defaultTargetMinutes: number
  minTargetMinutes: number
  maxTargetMinutes: number
  optimalRangeMin: number
  optimalRangeMax: number
  unit: 'hours' | 'minutes'
  researchNote: string
  categories: TimeCategory[]
}

export const INTENTION_CONFIGS: Record<IntentionType, IntentionConfig> = {
  deep_work: {
    label: 'Deep focused work',
    description: 'Distraction-free concentration on cognitively demanding tasks (coding, writing, design, problem-solving)',
    direction: 'maximize',
    defaultTargetMinutes: 20 * 60, // 20 hours/week
    minTargetMinutes: 5 * 60,      // 5 hours/week
    maxTargetMinutes: 25 * 60,     // 25 hours/week (5 hrs/day × 5 days)
    optimalRangeMin: 15 * 60,      // 15 hours
    optimalRangeMax: 20 * 60,      // 20 hours
    unit: 'hours',
    researchNote: 'Cal Newport: Experts can sustain ~4 hours/day of deep work. Test: "Would it take months to train someone to do this task?"',
    categories: ['deep_work'],
  },
  less_distraction: {
    label: 'Less distractions',
    description: 'Reduce social media scrolling, aimless browsing, and non-productive screen time',
    direction: 'minimize',
    defaultTargetMinutes: 7 * 60,  // 7 hours/week max (1 hr/day)
    minTargetMinutes: 0,           // 0 hours (ideal)
    maxTargetMinutes: 14 * 60,     // 14 hours/week (2 hrs/day limit)
    optimalRangeMin: 0,
    optimalRangeMax: 7 * 60,       // Under 7 hours is good
    unit: 'hours',
    researchNote: 'Research links >2 hrs/day non-productive screen time to anxiety and depression. Average attention span has dropped to 47 seconds.',
    categories: ['distraction'],
  },
  work_life_balance: {
    label: 'Work-life balance',
    description: 'Combined rest, relationships, and self-care time outside of work obligations',
    direction: 'maximize',
    defaultTargetMinutes: 15 * 60, // 15 hours/week
    minTargetMinutes: 7 * 60,      // 7 hours/week
    maxTargetMinutes: 30 * 60,     // 30 hours/week
    optimalRangeMin: 10 * 60,
    optimalRangeMax: 20 * 60,
    unit: 'hours',
    researchNote: 'Work hours are a key barrier to social connection. Intentional non-work time prevents burnout and supports relationships.',
    categories: ['rest', 'relationships', 'self_care'],
  },
  exercise: {
    label: 'Exercise',
    description: 'Moderate intensity (can talk, not sing): brisk walking, cycling, swimming, sports, yoga, strength training',
    direction: 'maximize',
    defaultTargetMinutes: 150,     // 2.5 hours/week (WHO minimum)
    minTargetMinutes: 75,          // 75 min vigorous OR
    maxTargetMinutes: 450,         // 7.5 hours/week
    optimalRangeMin: 150,          // WHO minimum
    optimalRangeMax: 300,          // WHO recommended
    unit: 'minutes',
    researchNote: 'WHO: 150-300 min/week moderate OR 75-150 min vigorous. 31% of adults globally don\'t meet minimum.',
    categories: ['exercise'],
  },
  self_care: {
    label: 'Rest & self-care',
    description: 'Recovery activities: relaxation, meditation, hobbies, mindful entertainment, personal care routines',
    direction: 'maximize',
    defaultTargetMinutes: 10 * 60, // 10 hours/week
    minTargetMinutes: 5 * 60,      // 5 hours/week
    maxTargetMinutes: 20 * 60,     // 20 hours/week
    optimalRangeMin: 7 * 60,
    optimalRangeMax: 14 * 60,
    unit: 'hours',
    researchNote: 'Self-care is a coping strategy that reduces burnout. 75% of employees report burnout. Short breaks improve mood and focus.',
    categories: ['self_care', 'rest'],
  },
  relationships: {
    label: 'Social connection',
    description: 'Quality time with others: conversations, shared activities, family time, social calls, gatherings',
    direction: 'maximize',
    defaultTargetMinutes: 12 * 60, // 12 hours/week (research sweet spot)
    minTargetMinutes: 7 * 60,      // 7 hours/week (research minimum)
    maxTargetMinutes: 21 * 60,     // 21 hours/week
    optimalRangeMin: 9 * 60,       // 9 hours (loneliness threshold)
    optimalRangeMax: 21 * 60,      // 21 hours
    unit: 'hours',
    researchNote: 'Research: 9-12 hrs/week minimum to avoid loneliness. Aim for 3-5 close friendships. Social connection increases survival odds by 50%.',
    categories: ['relationships'],
  },
  learning: {
    label: 'Learning',
    description: 'Deliberate practice: structured skill-building with goals and feedback (courses, tutorials, practice sessions)',
    direction: 'maximize',
    defaultTargetMinutes: 7 * 60,  // 7 hours/week (1 hr/day)
    minTargetMinutes: 3 * 60,      // 3 hours/week
    maxTargetMinutes: 14 * 60,     // 14 hours/week (2 hrs/day)
    optimalRangeMin: 5 * 60,
    optimalRangeMax: 10 * 60,
    unit: 'hours',
    researchNote: 'Ericsson: Beginners sustain ~1 hr/day, experts 4-5 hrs. Deliberate practice requires specific goals and feedback, not just repetition.',
    categories: ['learning'],
  },
  custom: {
    label: 'Custom goal',
    description: 'Set your own personalized goal',
    direction: 'maximize',
    defaultTargetMinutes: 5 * 60,  // 5 hours/week
    minTargetMinutes: 30,          // 30 min/week
    maxTargetMinutes: 40 * 60,     // 40 hours/week
    optimalRangeMin: 0,
    optimalRangeMax: 40 * 60,
    unit: 'hours',
    researchNote: 'Custom goals let you track what matters most to you.',
    categories: [],
  },
}

// Helper to format target for display
export function formatTarget(minutes: number, unit: 'hours' | 'minutes'): string {
  if (unit === 'minutes' || minutes < 60) {
    return `${minutes} min`
  }
  const hours = minutes / 60
  if (hours === Math.floor(hours)) {
    return `${hours} hr${hours !== 1 ? 's' : ''}`
  }
  return `${hours.toFixed(1)} hrs`
}

// Helper to calculate progress percentage
export function calculateIntentionProgress(
  actualMinutes: number,
  targetMinutes: number,
  direction: 'maximize' | 'minimize'
): number {
  if (targetMinutes === 0) return direction === 'minimize' ? 100 : 0

  if (direction === 'maximize') {
    return Math.min(100, Math.round((actualMinutes / targetMinutes) * 100))
  } else {
    // For minimize: being under target is good (100%), over is bad (decreasing %)
    if (actualMinutes <= targetMinutes) {
      return 100
    }
    // Gradually decrease from 100% as you exceed target
    const overageRatio = actualMinutes / targetMinutes
    return Math.max(0, Math.round(100 - (overageRatio - 1) * 100))
  }
}

// Get feedback message based on progress
export function getIntentionFeedback(
  actualMinutes: number,
  targetMinutes: number,
  config: IntentionConfig
): { message: string; tone: 'success' | 'warning' | 'neutral' | 'danger' } {
  const progress = calculateIntentionProgress(actualMinutes, targetMinutes, config.direction)

  if (config.direction === 'maximize') {
    if (progress >= 100) {
      return { message: 'Target reached!', tone: 'success' }
    } else if (progress >= 75) {
      return { message: 'Almost there', tone: 'neutral' }
    } else if (progress >= 50) {
      return { message: 'Halfway', tone: 'neutral' }
    } else if (progress >= 25) {
      return { message: 'Getting started', tone: 'warning' }
    } else {
      return { message: 'Needs attention', tone: 'danger' }
    }
  } else {
    // Minimize direction
    if (actualMinutes === 0) {
      return { message: 'Perfect!', tone: 'success' }
    } else if (actualMinutes <= targetMinutes * 0.5) {
      return { message: 'Great restraint', tone: 'success' }
    } else if (actualMinutes <= targetMinutes) {
      return { message: 'Within limit', tone: 'neutral' }
    } else if (actualMinutes <= targetMinutes * 1.5) {
      return { message: 'Slightly over', tone: 'warning' }
    } else {
      return { message: 'Over limit', tone: 'danger' }
    }
  }
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
  deep_work: 'Deep Work',
  meetings: 'Meetings',
  admin: 'Admin',
  learning: 'Learning',
  exercise: 'Exercise',
  rest: 'Rest',
  meals: 'Meals',
  self_care: 'Self Care',
  relationships: 'Relationships',
  distraction: 'Distraction',
  other: 'Other',
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
  deep_work: {
    definition: 'Distraction-free concentration on cognitively demanding tasks that create new value, improve skills, and are hard to replicate.',
    includes: [
      'Writing (articles, code, reports)',
      'Programming/coding',
      'Design work',
      'Problem-solving',
      'Strategic thinking',
      'Creative projects',
      'Research and analysis',
    ],
    excludes: [
      'Email (→ Admin)',
      'Meetings (→ Meetings)',
      'Routine tasks anyone could do (→ Admin)',
      'Work while distracted (→ Distraction)',
    ],
    source: 'Cal Newport - Deep Work',
  },
  meetings: {
    definition: 'Scheduled time with others for work coordination, collaboration, or professional discussions.',
    includes: [
      'Video/phone calls',
      'Team standups',
      'One-on-ones',
      'Client meetings',
      'Presentations',
      'Interviews',
      'Brainstorming sessions',
    ],
    excludes: [
      'Social calls with friends/family (→ Relationships)',
      'Working sessions alone (→ Deep Work)',
    ],
  },
  admin: {
    definition: 'Logistical tasks that are necessary but don\'t create new value. Easy to replicate and often done while distracted.',
    includes: [
      'Email and messages',
      'Scheduling',
      'Filing and organizing',
      'Expense reports',
      'Form filling',
      'Errands and chores',
      'Shopping',
      'Commuting',
    ],
    excludes: [
      'Cognitively demanding work (→ Deep Work)',
      'Household activities for relaxation (→ Rest/Self Care)',
    ],
    source: 'Cal Newport - Shallow Work definition',
  },
  learning: {
    definition: 'Deliberate practice: structured activities with specific goals and feedback, designed to improve skills beyond your current level.',
    includes: [
      'Courses and classes',
      'Tutorials with exercises',
      'Reading technical books',
      'Practice with feedback',
      'Language learning',
      'Instrument practice',
      'Studying for exams',
    ],
    excludes: [
      'Passive content consumption (→ Rest or Distraction)',
      'Repetitive practice without improvement goals',
      'Reading for entertainment (→ Rest)',
    ],
    source: 'Anders Ericsson - Deliberate Practice',
  },
  exercise: {
    definition: 'Physical activity at moderate intensity (can talk but not sing) or vigorous intensity. WHO recommends 150-300 min/week moderate or 75-150 min/week vigorous.',
    includes: [
      'Brisk walking (2.5+ mph)',
      'Cycling (<10 mph recreational)',
      'Swimming laps',
      'Yoga (vinyasa, power)',
      'Dancing',
      'Sports (tennis, basketball)',
      'Strength training',
      'Running/jogging',
      'Active yard work',
    ],
    excludes: [
      'Slow strolling (→ Rest)',
      'Stretching only (→ Self Care)',
      'Watching sports (→ Rest or Distraction)',
    ],
    source: 'WHO Physical Activity Guidelines',
  },
  rest: {
    definition: 'Intentional downtime for mental and physical recovery. Essential for preventing burnout and maintaining wellbeing.',
    includes: [
      'Napping',
      'Relaxing without screens',
      'Reading for pleasure',
      'Listening to music',
      'Sitting in nature',
      'Gentle stretching',
      'Daydreaming',
      'Watching TV/movies mindfully',
    ],
    excludes: [
      'Doom scrolling (→ Distraction)',
      'Working while "resting" (→ appropriate work category)',
      'Feeling guilty about resting',
    ],
    source: 'Burnout prevention research',
  },
  meals: {
    definition: 'Time spent eating and preparing food. Quality meal time supports health and can be social.',
    includes: [
      'Eating meals',
      'Cooking',
      'Meal prep',
      'Grocery shopping',
      'Coffee/tea breaks',
    ],
    excludes: [
      'Eating while working (split time appropriately)',
      'Social dinners (primary → Relationships)',
    ],
  },
  self_care: {
    definition: 'Activities that maintain physical, mental, and emotional wellbeing. A coping strategy that reduces stress and prevents burnout.',
    includes: [
      'Personal hygiene',
      'Medical appointments',
      'Meditation/mindfulness',
      'Journaling',
      'Therapy sessions',
      'Hobbies for relaxation',
      'Spa/massage',
      'Skincare routines',
    ],
    excludes: [
      'Exercise (→ Exercise)',
      'Sleep (not typically logged)',
      'Social activities (→ Relationships)',
    ],
    source: 'Self-care and burnout prevention research',
  },
  relationships: {
    definition: 'Quality time with others. Research shows 7-21 hours/week of social time is needed to avoid loneliness. Aim for 3-5 close relationships.',
    includes: [
      'Conversations with friends/family',
      'Phone/video calls (social)',
      'Shared activities with others',
      'Date nights',
      'Family time',
      'Visiting neighbors',
      'Group hobbies',
      'Parties and gatherings',
    ],
    excludes: [
      'Work meetings (→ Meetings)',
      'Texting while doing other things',
      'Passive co-presence without interaction',
    ],
    source: 'Social Connection Guidelines research',
  },
  distraction: {
    definition: 'Non-productive digital engagement and aimless activities. Linked to decreased focus and wellbeing when excessive (>2 hrs/day).',
    includes: [
      'Social media scrolling',
      'Aimless web browsing',
      'Watching random videos',
      'Gaming (non-social)',
      'News rabbit holes',
      'Online shopping without intent',
      'Checking phone repeatedly',
    ],
    excludes: [
      'Intentional entertainment (→ Rest)',
      'Educational content (→ Learning)',
      'Social gaming with friends (→ Relationships)',
      'Work-related browsing (→ Admin or Deep Work)',
    ],
    source: 'Digital distraction research',
  },
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
export const VIEWING_PAST_MESSAGE = "You're viewing past entries. Logging is only available for the last 2 days."

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
      categories: ['exercise'],
    },
    milestones: [7, 14, 30, 60, 100, 365],
    graceDaysPerWeek: 2, // Rest days are important for exercise
  },
  focus: {
    label: 'Focus',
    emoji: '🎯',
    description: 'Days with zero distraction logged',
    threshold: {
      type: 'absence',
      categories: ['distraction'],
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
      categories: ['relationships'],
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
