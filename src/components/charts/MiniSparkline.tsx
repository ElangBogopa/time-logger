'use client'

import React from 'react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { CHART_THEME } from '@/lib/chart-config'
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
  /** Loading state — show shimmer skeleton */
  isLoading?: boolean
}

function MiniSparklineInner({
  data,
  color,
  average,
  delta,
  height = 32,
  gradientId = 'sparkline',
  decorative = false,
  isLoading = false,
}: MiniSparklineProps) {
  const reducedMotion = useReducedMotion()

  // Loading state
  if (isLoading) {
    return (
      <div style={{ height: height + 20 }}>
        <div className="animate-pulse bg-muted rounded" style={{ height, width: '100%' }} />
        <div className="flex items-center justify-center gap-1.5 mt-0.5">
          <div className="animate-pulse bg-muted rounded h-3 w-12" />
        </div>
      </div>
    )
  }

  // Empty state — not enough data
  if (!data || data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-[10px] text-muted-foreground"
        style={{ height: height + 20 }}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : 'Not enough data for trend'}
        aria-hidden={decorative ? 'true' : undefined}
      >
        {data?.length === 1 ? `${data[0]}` : '—'}
      </div>
    )
  }

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
        <AreaChart data={chartData} margin={CHART_THEME.margin.compact}>
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
            animationDuration={reducedMotion ? 0 : CHART_THEME.animation.slow}
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

export const MiniSparkline = React.memo(MiniSparklineInner)
