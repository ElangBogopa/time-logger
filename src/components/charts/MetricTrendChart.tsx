'use client'

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { renderStatusShape } from '@/lib/chart-a11y'
import { getStatusLabel } from '@/lib/chart-colors'
import { CHART_THEME } from '@/lib/chart-config'
import { ChartGradient } from './ChartGradient'
import { ChartTooltip } from './ChartTooltip'
import { PeriodToggle } from './PeriodToggle'

// ── Types ──

interface TrendDataPoint {
  date: string
  label: string
  value: number
  color?: string
}

interface MetricTrendChartProps {
  data: TrendDataPoint[]
  metricColor: string
  metricLabel: string
  average: number
  height?: number
  period: '7d' | '30d'
  onPeriodChange?: (period: '7d' | '30d') => void
}

// ── Custom dot renderer ──

interface DotProps {
  cx?: number
  cy?: number
  payload?: TrendDataPoint
  index?: number
}

function StatusDot({ cx, cy, payload }: DotProps) {
  if (cx == null || cy == null || !payload) return null
  return (
    <g>
      {/* Invisible 44px hit area for touch (W7) */}
      <circle cx={cx} cy={cy} r={CHART_THEME.touchTarget.dotHitRadius} fill="transparent" />
      {/* Shaped status dot (C5) */}
      {renderStatusShape(cx, cy, payload.value, 5)}
    </g>
  )
}

// ── Active dot (on hover/tap) ──

interface ActiveDotProps {
  cx?: number
  cy?: number
}

function ActiveDot({ cx, cy }: ActiveDotProps) {
  if (cx == null || cy == null) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={CHART_THEME.touchTarget.dotHitRadius} fill="transparent" />
      <circle
        cx={cx}
        cy={cy}
        r={8}
        stroke="var(--muted-foreground)"
        strokeWidth={2}
        fill="var(--card)"
      />
    </g>
  )
}

// ── Main Component ──

export function MetricTrendChart({
  data,
  metricColor,
  metricLabel,
  average,
  height = 160,
  period,
  onPeriodChange,
}: MetricTrendChartProps) {
  const reducedMotion = useReducedMotion()
  const gradientId = `trend-gradient-${metricLabel}`

  // Memoize aria-label to avoid recalc on every render
  const ariaLabel = useMemo(() => {
    const values = data.map(d => `${d.label} ${d.value}`).join(', ')
    return `${metricLabel} trend chart, ${period === '7d' ? '7 day' : '30 day'} view. Average score ${average}. Values: ${values}.`
  }, [data, metricLabel, period, average])

  return (
    <div>
      {/* Period toggle */}
      {onPeriodChange && (
        <div className="flex justify-end mb-2">
          <PeriodToggle value={period} onChange={onPeriodChange} />
        </div>
      )}

      {/* Accessible chart wrapper (C4) */}
      <div role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={CHART_THEME.margin.standard}>
            <defs>
              <ChartGradient id={gradientId} color={metricColor} topOpacity={0.25} />
            </defs>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: CHART_THEME.axis.fontSize, fill: CHART_THEME.axis.fill }}
              dy={CHART_THEME.axis.dy}
            />
            <ReferenceLine
              y={average}
              stroke={CHART_THEME.referenceLine.average.stroke}
              strokeDasharray={CHART_THEME.referenceLine.average.strokeDasharray}
              label={{
                value: `${average}`,
                position: 'right',
                fontSize: 10,
                fill: 'var(--muted-foreground)',
              }}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={metricColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={<StatusDot />}
              activeDot={<ActiveDot />}
              isAnimationActive={!reducedMotion}
              animationDuration={reducedMotion ? 0 : CHART_THEME.animation.slow}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Screen reader data table (C4) */}
      <table className="sr-only">
        <caption>
          {metricLabel} scores, {period === '7d' ? 'past 7 days' : 'past 30 days'}
        </caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Score</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{d.label}</td>
              <td>{d.value}</td>
              <td>{getStatusLabel(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Aria-live region for period changes */}
      <div aria-live="polite" className="sr-only">
        Showing {period === '7d' ? '7 day' : '30 day'} trend. Average: {average}.
      </div>
    </div>
  )
}
