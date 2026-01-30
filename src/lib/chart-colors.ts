// ═══════════════════════════════════════════════════════════
// Chart Color System — Better
// Single source of truth for all metric & status colors.
// ═══════════════════════════════════════════════════════════

/** Metric identity colors — used for chart lines, fills, rings */
export const METRIC_COLORS = {
  focus: {
    hex: '#3b82f6',
    textHex: '#60a5fa', // blue-400 — 5.5:1 on zinc-800 ✅
    rgb: '59, 130, 246',
    tailwind: 'blue-500',
    textTailwind: 'blue-400',
  },
  balance: {
    hex: '#f59e0b',
    textHex: '#f59e0b', // amber-500 — already passes ✅
    rgb: '249, 159, 11',
    tailwind: 'amber-500',
    textTailwind: 'amber-500',
  },
  rhythm: {
    hex: '#22c55e',
    textHex: '#4ade80', // green-400 — for text on dark backgrounds
    rgb: '34, 197, 94',
    tailwind: 'green-500',
    textTailwind: 'green-400',
  },
} as const

/** Status colors for fills/backgrounds (500-level) */
export const STATUS_COLORS = {
  green: '#22c55e',
  yellow: '#f59e0b',
  red: '#ef4444',
} as const

/** Text-safe status colors for use on secondary/card backgrounds (400-level) */
export const STATUS_TEXT_COLORS = {
  green: '#4ade80', // green-400
  yellow: '#f59e0b', // amber-500 (already passes)
  red: '#f87171', // red-400
} as const

/**
 * Returns the fill/background status color (500-level).
 * Use for chart fills, bars, dots.
 */
export function getStatusColor(value: number): string {
  if (value >= 70) return STATUS_COLORS.green
  if (value >= 40) return STATUS_COLORS.yellow
  return STATUS_COLORS.red
}

/**
 * Returns the text-safe status color (400-level).
 * Ensures 4.5:1+ contrast ratio on zinc-800 and zinc-900 surfaces.
 */
export function getStatusTextColor(value: number): string {
  if (value >= 70) return STATUS_TEXT_COLORS.green
  if (value >= 40) return STATUS_TEXT_COLORS.yellow
  return STATUS_TEXT_COLORS.red
}

/**
 * Tailwind class for text status — uses 400-level for contrast (W1 a11y fix).
 */
export function getStatusTailwind(value: number): string {
  if (value >= 70) return 'text-green-400'
  if (value >= 40) return 'text-amber-500'
  return 'text-red-400'
}

/** Human-readable status label for a metric value. */
export function getStatusLabel(value: number): string {
  if (value >= 80) return 'Crushing it'
  if (value >= 70) return 'Strong'
  if (value >= 50) return 'Building'
  if (value >= 30) return 'Warming up'
  return 'Getting started'
}

export type MetricKey = 'focus' | 'balance' | 'rhythm'
export type StatusColor = 'green' | 'yellow' | 'red'
