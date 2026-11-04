// ═══════════════════════════════════════════════════════════
// Chart colours — Better
//
// The metric and status colours the charts, rings and bars draw with. The
// values themselves live in lib/palette.ts, and the thresholds in
// lib/metrics-calc.ts, so this file is the chart-shaped view of them and not
// a second opinion: it used to hold saturated Tailwind 500s and its own 70/40
// thresholds, both of which disagreed with the rest of the app.
// ═══════════════════════════════════════════════════════════

import { METRIC_HEX, METRIC_TEXT_HEX, STATUS_CLASSES, STATUS_HEX, STATUS_TEXT_HEX } from './palette'
import { METRIC_THRESHOLDS } from './metrics-calc'

/** Metric identity colours — chart lines, fills, rings. */
export const METRIC_COLORS = {
  body: { hex: METRIC_HEX.body, textHex: METRIC_TEXT_HEX.body },
  focus: { hex: METRIC_HEX.focus, textHex: METRIC_TEXT_HEX.focus },
  social: { hex: METRIC_HEX.social, textHex: METRIC_TEXT_HEX.social },
} as const

/** Status colours for fills and backgrounds. */
export const STATUS_COLORS = STATUS_HEX

/** Status colours for text on card and sheet surfaces. */
export const STATUS_TEXT_COLORS = STATUS_TEXT_HEX

/** Fill/background status colour for a score. */
export function getStatusColor(value: number): string {
  if (value >= METRIC_THRESHOLDS.green) return STATUS_COLORS.green
  if (value >= METRIC_THRESHOLDS.yellow) return STATUS_COLORS.yellow
  return STATUS_COLORS.red
}

/** Text status colour for a score. */
export function getStatusTextColor(value: number): string {
  if (value >= METRIC_THRESHOLDS.green) return STATUS_TEXT_COLORS.green
  if (value >= METRIC_THRESHOLDS.yellow) return STATUS_TEXT_COLORS.yellow
  return STATUS_TEXT_COLORS.red
}

/** Tailwind text class for a score, matching getStatusTextColor. */
export function getStatusTailwind(value: number): string {
  if (value >= METRIC_THRESHOLDS.green) return STATUS_CLASSES.green.text
  if (value >= METRIC_THRESHOLDS.yellow) return STATUS_CLASSES.yellow.text
  return STATUS_CLASSES.red.text
}

/** Human-readable status label for a metric value. */
export function getStatusLabel(value: number): string {
  if (value >= 80) return 'Crushing it'
  if (value >= 70) return 'Strong'
  if (value >= 50) return 'Building'
  if (value >= 30) return 'Warming up'
  return 'Getting started'
}

export type MetricKey = 'body' | 'focus' | 'social'
export type StatusColor = 'green' | 'yellow' | 'red'
