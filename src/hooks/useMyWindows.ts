'use client'

import { useMemo } from 'react'
import { useHabitHistory } from '@/hooks/useHabitHistory'
import { useWakeTime } from '@/hooks/useWakeTime'
import { windowsForWake } from '@/lib/ideal-day'

/**
 * This person's windows — the ideal day moved to the wake time they have
 * stated — and the last four weeks of their log, for the habit rules. One
 * place to ask, so every screen that reasons about "the right hour" is
 * reasoning about the same day.
 */
export function useMyWindows(enabled = true) {
  const history = useHabitHistory(enabled)
  const { wakeMinutes, source } = useWakeTime()
  const windows = useMemo(() => windowsForWake(wakeMinutes), [wakeMinutes])
  return { windows, history, wakeMinutes, wakeSource: source }
}
