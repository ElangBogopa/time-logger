/**
 * Productivity Scoring Algorithm
 *
 * Based on peer-reviewed research (see research/productivity-algorithm-research.md):
 * - Locke & Latham: specific goals + feedback = performance
 * - Gollwitzer: implementation intentions (d=0.65 effect)
 * - Amabile & Kramer: progress principle — small wins drive motivation
 * - Harkin et al.: monitoring progress has d=0.40 effect
 *
 * Scoring model:
 *   Task 1 (priority):  50 points
 *   Task 2 (optional):  30 points
 *   Task 3 (optional):  20 points
 *   Task 4+ (bonus):    10 points each
 *
 * Only tasks that exist are counted in the denominator.
 * If user plans 1 task and completes it → 100%.
 * If user plans 2 tasks and completes both → 100%.
 * Bonus tasks beyond 3 add to max possible but don't dilute core scoring much.
 * Days without plans are excluded (not penalized).
 */

export interface PlanItem {
  id: string
  user_id: string
  goal_id: string | null
  date: string
  title: string
  completed: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface DailyProductivityScore {
  date: string
  score: number           // 0-100
  maxPossible: number     // max possible points based on # of tasks planned
  earnedPoints: number    // points actually earned
  totalTasks: number      // how many tasks were planned (1-3)
  completedTasks: number  // how many were completed
  priorityCompleted: boolean // did they do the #1 task?
  tasks: {
    title: string
    completed: boolean
    weight: number        // 50, 30, or 20
    slot: number          // 0, 1, or 2
  }[]
  label: string           // human-readable label
  hasPlans: boolean       // did the user plan anything?
}

// Weight distribution by slot (sort_order)
// Core 3 tasks: 50/30/20 = 100 points
// Bonus tasks (4+): 10 points each
const CORE_WEIGHTS: number[] = [50, 30, 20]
const BONUS_WEIGHT = 10

function getSlotWeight(slot: number): number {
  if (slot < CORE_WEIGHTS.length) return CORE_WEIGHTS[slot]
  return BONUS_WEIGHT
}

/**
 * Calculate the productivity score for a single day.
 */
export function calculateDailyScore(plans: PlanItem[]): DailyProductivityScore {
  // Sort by sort_order to ensure correct slot assignment
  const sorted = [...plans].sort((a, b) => a.sort_order - b.sort_order)

  if (sorted.length === 0) {
    return {
      date: plans[0]?.date || '',
      score: 0,
      maxPossible: 0,
      earnedPoints: 0,
      totalTasks: 0,
      completedTasks: 0,
      priorityCompleted: false,
      tasks: [],
      label: 'No plan set',
      hasPlans: false,
    }
  }

  let maxPossible = 0
  let earnedPoints = 0
  let completedTasks = 0
  const priorityCompleted = sorted[0]?.completed ?? false

  const tasks = sorted.map((plan, index) => {
    const weight = getSlotWeight(index)
    maxPossible += weight
    if (plan.completed) {
      earnedPoints += weight
      completedTasks++
    }
    return {
      title: plan.title,
      completed: plan.completed,
      weight,
      slot: index,
    }
  })

  // Normalize score to 0-100 based on what was actually planned
  const score = maxPossible > 0 ? Math.round((earnedPoints / maxPossible) * 100) : 0

  return {
    date: sorted[0].date,
    score,
    maxPossible,
    earnedPoints,
    totalTasks: sorted.length,
    completedTasks,
    priorityCompleted,
    tasks,
    label: getScoreLabel(score, priorityCompleted, sorted.length, completedTasks),
    hasPlans: true,
  }
}

/**
 * Human-readable label for the score.
 * Based on research: frame as mirror, not judge. Identity language > evaluative.
 */
function getScoreLabel(
  score: number,
  priorityCompleted: boolean,
  totalTasks: number,
  completedTasks: number
): string {
  if (score === 100) return 'Perfect day'
  if (score >= 80) return 'Strong follow-through'
  if (priorityCompleted && score >= 50) return 'Priority done'
  if (score >= 50) return 'Solid progress'
  if (completedTasks > 0) return 'Partial progress'
  return 'Tough day'
}

/**
 * Calculate a weekly productivity score (average of planned days only).
 * Days without plans are excluded — not penalized.
 */
export function calculateWeeklyScore(dailyScores: DailyProductivityScore[]): {
  average: number
  plannedDays: number
  totalDays: number
  perfectDays: number
  priorityCompletionRate: number // % of days where #1 task was done
} {
  const withPlans = dailyScores.filter(d => d.hasPlans)

  if (withPlans.length === 0) {
    return {
      average: 0,
      plannedDays: 0,
      totalDays: dailyScores.length,
      perfectDays: 0,
      priorityCompletionRate: 0,
    }
  }

  const sum = withPlans.reduce((s, d) => s + d.score, 0)
  const perfectDays = withPlans.filter(d => d.score === 100).length
  const priorityDone = withPlans.filter(d => d.priorityCompleted).length

  return {
    average: Math.round(sum / withPlans.length),
    plannedDays: withPlans.length,
    totalDays: dailyScores.length,
    perfectDays,
    priorityCompletionRate: Math.round((priorityDone / withPlans.length) * 100),
  }
}
