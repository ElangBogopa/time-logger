/**
 * The first trip round the loop.
 *
 * Onboarding ends by handing a new person a short list — plan something,
 * log something, read a review — and these are the marks against it. They
 * live on the device: they describe what this person has been shown, not
 * anything about their data, and nobody who was using the app before this
 * existed should ever see the list.
 */

const KEY = 'first-run'

export type FirstRunStep = 'planned' | 'reviewed'

export interface FirstRunState {
  /** Set when onboarding is finished on this device. Absent for everyone else. */
  started: boolean
  planned: boolean
  reviewed: boolean
  dismissed: boolean
}

const EMPTY: FirstRunState = { started: false, planned: false, reviewed: false, dismissed: false }

export function readFirstRun(): FirstRunState {
  if (typeof window === 'undefined') return EMPTY
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return EMPTY
  }
}

function write(patch: Partial<FirstRunState>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readFirstRun(), ...patch }))
  } catch {
    /* storage is a convenience */
  }
}

/**
 * Called once, by onboarding. Nothing is ticked yet: choosing what matters
 * is not the same as giving it a time, and the list should only say done
 * when the thing has been done.
 */
export function startFirstRun(): void {
  write({ started: true })
}

/** Called by the screens that complete a step. A no-op for anyone not on their first run. */
export function markFirstRun(step: FirstRunStep): void {
  const state = readFirstRun()
  if (!state.started || state[step]) return
  write({ [step]: true })
}

export function dismissFirstRun(): void {
  write({ dismissed: true })
}
