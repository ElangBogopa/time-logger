'use client'

interface StatusDeltaProps {
  /** Numeric delta value (positive = good, negative = bad, 0 = neutral, null = unavailable) */
  value: number | null | undefined
  /** Display size */
  size?: 'xs' | 'sm' | 'md'
  /** Optional label suffix, e.g. "vs last week" */
  label?: string
}

const SIZE_CLASSES = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-sm',
} as const

/**
 * Delta badge with BOTH color AND shape indicator (C5 a11y fix).
 * ▲ = positive/good (green-400)
 * ● = neutral (muted)
 * ▼ = negative/bad (red-400)
 * — = unavailable/null (muted)
 *
 * Uses 400-level text colors for 4.5:1+ contrast on dark backgrounds (W1).
 */
export function StatusDelta({ value, size = 'sm', label }: StatusDeltaProps) {
  const sizeClass = SIZE_CLASSES[size]

  // W2 fix: Handle null/undefined values gracefully
  if (value == null) {
    return (
      <span className={`${sizeClass} font-medium text-muted-foreground inline-flex items-center gap-0.5`}>
        —{label ? ` ${label}` : ''}
      </span>
    )
  }

  if (value > 0) {
    return (
      <span className={`${sizeClass} font-medium text-green-400 inline-flex items-center gap-0.5`}>
        ▲ {value}{label ? ` ${label}` : ''}
      </span>
    )
  }

  if (value < 0) {
    return (
      <span className={`${sizeClass} font-medium text-red-400 inline-flex items-center gap-0.5`}>
        ▼ {Math.abs(value)}{label ? ` ${label}` : ''}
      </span>
    )
  }

  return (
    <span className={`${sizeClass} font-medium text-muted-foreground inline-flex items-center gap-0.5`}>
      ● {label ? `Same ${label}` : 'No change'}
    </span>
  )
}
