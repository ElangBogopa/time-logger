/**
 * Shared reader for the user's goals.
 *
 * The dashboard fetched /api/goals twice on every load: YourPlan needs the
 * list to render, and useDashboardState needs to know whether any goal exists
 * before offering onboarding. Two components, same request, measured as two
 * round trips.
 *
 * Callers share one in-flight request and a short-lived result, so concurrent
 * readers cost one call and a quick re-mount costs none. Anything that
 * creates or removes a goal calls invalidateGoals().
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

/** Drop the cached list after a goal is created or removed. */
export function invalidateGoals(): void {
  cached = null
}
