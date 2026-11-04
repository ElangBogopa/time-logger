'use client'

import { METRIC_LABELS } from '@/lib/metrics-calc'
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

export function MetricRing({
  metric,
  value,
  size = 72,
  strokeWidth = 6,
}: {
  metric: MetricKey
  value: number
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, value))
  const offset = circumference - (clamped / 100) * circumference
  const center = size / 2
  const hasProgress = value > 0

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90" aria-hidden="true">
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
              stroke={METRIC_HEX[metric]}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-semibold tabular-nums"
            style={{
              color: hasProgress ? METRIC_TEXT_HEX[metric] : 'var(--muted-foreground)',
              fontSize: Math.round(size * 0.28),
            }}
            aria-hidden="true"
          >
            {value}
          </span>
        </div>
      </div>
      <span className="eyebrow mt-1.5" aria-hidden="true">
        {METRIC_LABELS[metric]}
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
