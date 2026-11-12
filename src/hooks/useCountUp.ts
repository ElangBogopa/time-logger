'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * A number that travels to its new value instead of jumping there.
 *
 * Only on change: the first value a component is given is shown at once, so
 * opening a screen is as still as it ever was. It is the moment after you
 * log something that this is for — the ring fills, and the number climbs
 * with it.
 */
export function useCountUp(value: number, durationMs = 700): number {
  const [shown, setShown] = useState(value)
  const from = useRef(value)

  useEffect(() => {
    const start = from.current
    if (start === value) return

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // Tests assert on the final number; an animation frame is not part of that.
    if (reduced || process.env.NODE_ENV === 'test' || typeof requestAnimationFrame === 'undefined') {
      from.current = value
      const settle = setTimeout(() => setShown(value), 0)
      return () => clearTimeout(settle)
    }

    let frame = 0
    const began = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = Math.round(start + (value - start) * eased)
      from.current = current
      setShown(current)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, durationMs])

  return shown
}
