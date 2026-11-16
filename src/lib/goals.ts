/**
 * Reader for the user's saved goals.
 *
 * Goals are no longer shown or created anywhere in the app. This reader
 * survives for one job: useDashboardState asks it whether an older account,
 * set up before the set-up flag was written, already has a goal, so that
 * account is not sent back through setup.
 *
 * Callers share one in-flight request and a short-lived result, so
 * concurrent readers cost one call. invalidateGoals() clears it.
 */

export interface Goal {
  id: string
  title: string
  description: string | null
  active?: boolean
}

// Short on purpose: long enough to coalesce one screen's readers, short
// enough that it is not a second source of truth.
const TTL_MS = 30 * 1000

let inFlight: Promise<Goal[]> | null = null
let cached: { goals: Goal[]; at: number } | null = null

export async function fetchGoals(): Promise<Goal[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.goals
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const response = await fetch('/api/goals')
      if (!response.ok) throw new Error(`Failed to fetch goals (${response.status})`)
      const data = await response.json()
      const goals: Goal[] = data.goals || []
      cached = { goals, at: Date.now() }
      return goals
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

/** Drop the cached list, so the next read asks again. */
export function invalidateGoals(): void {
  cached = null
}
