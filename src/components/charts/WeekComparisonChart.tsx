'use client'

import React, { useMemo } from 'react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { CHART_THEME } from '@/lib/chart-config'
import { ChartGradient } from './ChartGradient'
import { StatusDelta } from './StatusDelta'

// ── Types ──

export interface WeekDataPoint {
  day: string
  value: number
}

interface WeekComparisonChartProps {
  currentWeek: WeekDataPoint[]
  previousWeek: WeekDataPoint[]
  metricColor: string
  metricName: string
  height?: number
}

// ── Custom tooltip showing both weeks ──

interface ComparisonTooltipPayload {
  value: number
  dataKey: string
  name: string
  color: string
}

interface ComparisonTooltipProps {
  active?: boolean
  payload?: ComparisonTooltipPayload[]
  label?: string
}

function ComparisonTooltip({ active, payload, label }: ComparisonTooltipProps) {
  if (!active || !payload?.length) return null

  const currentVal = payload.find(p => p.dataKey === 'current')?.value
  const previousVal = payload.find(p => p.dataKey === 'previous')?.value

  return (
    <div className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 shadow-lg">
      {label && <p className="text-[11px] text-muted-foreground mb-1">{label}</p>}
      {currentVal != null && (
        <p className="text-[13px] font-semibold text-foreground">
          This week: {currentVal}
        </p>
      )}
      {previousVal != null && (
        <p className="text-[11px] text-muted-foreground">
          Last week: {previousVal}
        </p>
      )}
    </div>
  )
}

// ── Main Component ──

function WeekComparisonChartInner({
  currentWeek,
  previousWeek,
  metricColor,
  metricName,
  height = 160,
}: WeekComparisonChartProps) {
  const reducedMotion = useReducedMotion()
  const gradientId = `compare-fill-${metricName}`

  // Merge data for ComposedChart (Recharts needs one data array)
  const mergedData = useMemo(() => {
    return currentWeek.map((d, i) => ({
      day: d.day,
      current: d.value,
      previous: previousWeek[i]?.value ?? 0,
    }))
  }, [currentWeek, previousWeek])

  // Calculate averages
  const currentAvg = useMemo(() => {
    if (currentWeek.length === 0) return 0
    return Math.round(currentWeek.reduce((s, d) => s + d.value, 0) / currentWeek.length)
  }, [currentWeek])

  const previousAvg = useMemo(() => {
    if (previousWeek.length === 0) return 0
    return Math.round(previousWeek.reduce((s, d) => s + d.value, 0) / previousWeek.length)
  }, [previousWeek])

  const deltaAvg = currentAvg - previousAvg
  const trendDir = deltaAvg > 0 ? 'up' : deltaAvg < 0 ? 'down' : 'unchanged'

  const ariaLabel = useMemo(() => {
    return `${metricName} week comparison. This week average: ${currentAvg}. Last week average: ${previousAvg}. Trend: ${trendDir} by ${Math.abs(deltaAvg)} points.`
  }, [metricName, currentAvg, previousAvg, trendDir, deltaAvg])

  if (mergedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[160px] text-sm text-muted-foreground">
        Not enough data for comparison.
      </div>
    )
  }

  return (
    <div>
      {/* Accessible chart wrapper */}
      <div role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={mergedData} margin={CHART_THEME.margin.standard}>
            <defs>
              <ChartGradient id={gradientId} color={metricColor} topOpacity={0.15} />
            </defs>
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: CHART_THEME.axis.fontSize, fill: CHART_THEME.axis.fill }}
              dy={CHART_THEME.axis.dy}
            />
            <Tooltip content={<ComparisonTooltip />} />
            {/* Previous week — muted, dashed, no fill */}
            <Line
              dataKey="previous"
              type="monotone"
              stroke="rgba(161, 161, 170, 0.5)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={{ r: 4, fill: 'transparent', stroke: 'rgba(161,161,170,0.4)', strokeWidth: 1.5 }}
              isAnimationActive={!reducedMotion}
              animationDuration={reducedMotion ? 0 : CHART_THEME.animation.fast}
            />
            {/* Current week — bold, filled */}
            <Area
              dataKey="current"
              type="monotone"
              stroke={metricColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={{ r: 5, fill: metricColor, stroke: 'none' }}
              isAnimationActive={!reducedMotion}
              animationDuration={reducedMotion ? 0 : CHART_THEME.animation.normal}
              animationBegin={reducedMotion ? 0 : 300}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend + summary */}
      <div className="flex items-center justify-between mt-2 px-1">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className="inline-block w-4 h-0.5 rounded-full"
              style={{ backgroundColor: metricColor }}
            />
            This week ({currentAvg} avg)
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-block w-4 h-0.5 rounded-full border-t border-dashed border-zinc-500" />
            Last week ({previousAvg} avg)
          </span>
        </div>
        <StatusDelta value={deltaAvg} size="sm" label="vs last week" />
      </div>

      {/* Screen reader table */}
      <table className="sr-only">
        <caption>{metricName} comparison: this week vs last week</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>This week</th>
            <th>Last week</th>
          </tr>
        </thead>
        <tbody>
          {mergedData.map(d => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{d.current}</td>
              <td>{d.previous}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const WeekComparisonChart = React.memo(WeekComparisonChartInner)
