// ═══════════════════════════════════════════════════════════
// Chart Accessibility Helpers — "Whoopify" Time Logger
// Shape-based status indicators (C5 a11y fix).
// Never rely on color alone to convey meaning.
// ═══════════════════════════════════════════════════════════

import React from 'react'
import { getStatusColor } from './chart-colors'

/**
 * Renders an SVG shape based on status value — not just color.
 * ≥70: filled circle (good)
 * 40-69: diamond / rotated square (moderate)
 * <40: downward triangle (low)
 *
 * Ensures chart dots are distinguishable without color vision (C5).
 */
export function renderStatusShape(
  cx: number,
  cy: number,
  value: number,
  size: number = 5
): React.ReactElement {
  const color = getStatusColor(value)

  // Good (≥70): filled circle
  if (value >= 70) {
    return React.createElement('circle', {
      cx,
      cy,
      r: size,
      fill: color,
    })
  }

  // Moderate (40-69): diamond (rotated square)
  if (value >= 40) {
    return React.createElement('rect', {
      x: cx - size,
      y: cy - size,
      width: size * 2,
      height: size * 2,
      fill: color,
      transform: `rotate(45 ${cx} ${cy})`,
    })
  }

  // Low (<40): downward triangle
  const halfBase = size
  const h = size * 1.2
  return React.createElement('polygon', {
    points: `${cx - halfBase},${cy - h / 2} ${cx + halfBase},${cy - h / 2} ${cx},${cy + h / 2}`,
    fill: color,
  })
}

/**
 * Returns a Unicode shape character for text contexts (labels, grid cells).
 * Aligned with SVG shapes per Dev Lead a11y note N1:
 * ● = good (circle), ◆ = moderate (diamond), ▼ = low (triangle)
 */
export function getStatusShape(value: number): string {
  if (value >= 70) return '●'
  if (value >= 40) return '◆'
  return '▼'
}
