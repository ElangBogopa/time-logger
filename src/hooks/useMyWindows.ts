'use client'

import { useMemo } from 'react'
import { useHabitHistory } from '@/hooks/useHabitHistory'
import { useWakeTime } from '@/hooks/useWakeTime'
import { windowsForWake } from '@/lib/ideal-day'

/**
 * This person's windows — the ideal day moved to when they wake — and the
 * four weeks of log they were read from. One place to ask, so every screen
 * that reasons about "the right hour" is reasoning about the same day.
 */
export function useMyWindows(enabled = true) {
  const history = useHabitHistory(enabled)
  const { wakeMinutes, source } = useWakeTime(history)
  const windows = useMemo(() => windowsForWake(wakeMinutes), [wakeMinutes])
  return { windows, history, wakeMinutes, wakeSource: source }
}
