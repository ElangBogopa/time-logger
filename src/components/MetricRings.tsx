'use client'

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { METRIC_LABELS, METRIC_THRESHOLDS } from '@/lib/metrics-calc'
import { useCountUp } from '@/hooks/useCountUp'
import { METRIC_HEX, METRIC_TEXT_HEX } from '@/lib/palette'
import type { MetricKey } from '@/lib/chart-colors'

/**
 * The three hero metrics, drawn once.
 *
 * Body, Mind and Heart are the app's one scoring system: a saturating curve
 * where the target scores 80 and 100 is unreachable. Everywhere else that
 * wanted "a number for this day" invented its own — the day review scored
 * sessions-logged ÷ sessions-passed, the weekly review scored active days
 * plus entries per day, the session popup had a third formula again. All of
 * them measured how diligently you logged, all on the same 0–100 dial as
 * these, and all reached 100 for showing up. They are gone; this is what
 * those places show now.
 */

export const METRIC_ORDER: MetricKey[] = ['body', 'focus', 'social']

/**
 * One ring. There were two — this one, and a private copy inside the
 * dashboard hero — drawing the same thing with the same colours.
 *
 * A ring that has reached its target looks like it: a brighter stroke with a
 * soft halo, and a tick beside the label so the state is not carried by
 * colour alone. Before this a ring at 82 and a ring at 78 differed by four
 * degrees of arc, which is not much of a reward for the day's work. The
 * moment it crosses, a single ripple leaves the ring.
 */
export function MetricRing({
  metric,
  value,
  size = 72,
  strokeWidth = 6,
  label,
}: {
  metric: MetricKey
  value: number
  size?: number
  strokeWidth?: number
  /** Overrides the metric's own name. */
  label?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, value))
  const offset = circumference - (clamped / 100) * circumference
  const center = size / 2
  const hasProgress = value > 0
  const onTarget = value >= METRIC_THRESHOLDS.green
  const shown = useCountUp(value)

  // Ripple once when the ring crosses its target while you are watching.
  const previous = useRef(value)
  const [ripple, setRipple] = useState(0)
  useEffect(() => {
    const crossed = previous.current < METRIC_THRESHOLDS.green && value >= METRIC_THRESHOLDS.green
    previous.current = value
    if (!crossed) return
    const start = setTimeout(() => setRipple((n) => n + 1), 0)
    return () => clearTimeout(start)
  }, [value])

  const stroke = onTarget ? METRIC_TEXT_HEX[metric] : METRIC_HEX[metric]

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        {ripple > 0 && (
          <span
            key={ripple}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full border-2 animate-ring-ripple"
            style={{ borderColor: METRIC_TEXT_HEX[metric] }}
          />
        )}
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90 overflow-visible"
          aria-hidden="true"
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={strokeWidth}
          />
          {hasProgress && (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={onTarget ? { filter: `drop-shadow(0 0 5px ${METRIC_HEX[metric]})` } : undefined}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="ring-number"
            style={{
              color: hasProgress ? METRIC_TEXT_HEX[metric] : 'var(--muted-foreground)',
              fontSize: Math.round(size * 0.36),
            }}
            aria-hidden="true"
          >
            {shown}
          </span>
        </div>
      </div>
      <span className="mt-2 flex items-center gap-1 text-sm font-medium text-foreground" aria-hidden="true">
        {label ?? METRIC_LABELS[metric]}
        {onTarget && <Check className="h-3.5 w-3.5" style={{ color: METRIC_TEXT_HEX[metric] }} strokeWidth={3} />}
      </span>
    </div>
  )
}

/** All three, for the screens that want the day or the week at a glance. */
export function MetricRingRow({
  values,
  size = 72,
  caption,
  srLabel,
}: {
  values: Record<MetricKey, number>
  size?: number
  caption?: string
  /** What these numbers are, for anyone not looking at the rings. */
  srLabel: string
}) {
  return (
    <div className="flex flex-col items-center">
      <p className="sr-only">
        {srLabel}:{' '}
        {METRIC_ORDER.map((metric) => `${METRIC_LABELS[metric]} ${values[metric]}`).join(', ')}
      </p>
      <div className="flex items-end justify-center gap-6">
        {METRIC_ORDER.map((metric) => (
          <MetricRing key={metric} metric={metric} value={values[metric]} size={size} />
        ))}
      </div>
      {caption && <p className="text-sm text-muted-foreground mt-3">{caption}</p>}
    </div>
  )
}
