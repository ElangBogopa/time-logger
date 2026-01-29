'use client'

import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { ChartGradient } from './ChartGradient'
import { StatusDelta } from './StatusDelta'

interface MiniSparklineProps {
  /** Array of numeric values (one per day, typically 7) */
  data: number[]
  /** Metric identity color hex, e.g. '#3b82f6' */
  color: string
  /** Average value to display */
  average: number
  /** Delta vs last week */
  delta: number
  /** Chart height in px */
  height?: number
  /** Unique gradient ID suffix to avoid SVG ID collisions */
  gradientId?: string
  /**
   * When true, suppresses role="img" and aria-label.
   * Use when nested inside a labeled parent button (a11y note N2).
   */
  decorative?: boolean
}

export function MiniSparkline({
  data,
  color,
  average,
  delta,
  height = 32,
  gradientId = 'sparkline',
  decorative = false,
}: MiniSparklineProps) {
  const reducedMotion = useReducedMotion()

  const chartData = data.map((value, i) => ({ value, index: i }))
  const trendDirection = delta > 0 ? 'up' : delta < 0 ? 'down' : 'no change'
  const gId = `gradient-${gradientId}`

  return (
    <div
      role={decorative ? undefined : 'img'}
      aria-label={
        decorative
          ? undefined
          : `7-day trend. Average ${average}. Trending ${trendDirection}${delta !== 0 ? ` by ${Math.abs(delta)}` : ''} versus last week.`
      }
      aria-hidden={decorative ? 'true' : undefined}
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <ChartGradient id={gId} color={color} topOpacity={0.2} />
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gId})`}
            dot={false}
            isAnimationActive={!reducedMotion}
            animationDuration={reducedMotion ? 0 : 800}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Stats row */}
      <div className="flex items-center justify-center gap-1.5 mt-0.5">
        <span className="text-[10px] text-muted-foreground">{average} avg</span>
        <StatusDelta value={delta} size="xs" />
      </div>
    </div>
  )
}
