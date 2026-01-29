// ═══════════════════════════════════════════════════════════
// Recharts Theme Config — "Whoopify" Time Logger
// Consistent theming for all chart components.
// Uses shadcn zinc dark theme tokens.
// ═══════════════════════════════════════════════════════════

export const CHART_THEME = {
  /** Grid styling (disabled by default for Whoop-clean look) */
  grid: {
    stroke: 'rgba(113, 113, 122, 0.12)', // zinc-500 at 12%
    strokeDasharray: '3 3',
  },

  /** Axis tick styling */
  axis: {
    fontSize: 10,
    fill: 'var(--muted-foreground)',
    axisLine: false as const,
    tickLine: false as const,
    dy: 8,
  },

  /** Tooltip styling */
  tooltip: {
    bg: '#27272a', // zinc-800
    border: '#3f3f46', // zinc-700
    text: '#fafafa', // zinc-50
    mutedText: '#a1a1aa', // zinc-400
    borderRadius: 8,
    padding: '8px 12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  },

  /** Reference line presets */
  referenceLine: {
    average: {
      stroke: 'rgba(161, 161, 170, 0.25)', // zinc-400 at 25%
      strokeDasharray: '4 4',
      strokeWidth: 1,
    },
    target: {
      stroke: 'rgba(161, 161, 170, 0.3)',
      strokeDasharray: '6 4',
      strokeWidth: 1,
    },
  },

  /** Dot sizing */
  dot: {
    default: { r: 5, strokeWidth: 0 },
    active: { r: 8, strokeWidth: 2, fill: 'var(--card)' },
    muted: { r: 4, fill: 'transparent', strokeWidth: 1.5 },
  },

  /** Animation durations (ms) — gate with useReducedMotion */
  animation: {
    fast: 300,
    normal: 600,
    slow: 1000,
  },

  /** Standard margins for chart containers */
  margin: {
    compact: { top: 2, right: 0, bottom: 0, left: 0 },
    standard: { top: 8, right: 8, bottom: 0, left: 8 },
    withLabels: { top: 8, right: 8, bottom: 4, left: 8 },
  },

  /** Minimum touch target for interactive chart elements (WCAG 2.5.5) */
  touchTarget: {
    minSize: 44,
    dotHitRadius: 22,
  },
} as const
