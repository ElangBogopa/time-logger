'use client'

import React, { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { CHART_THEME } from '@/lib/chart-config'
import { ChartGradient } from './ChartGradient'

// ── Types ──

export interface FocusEntry {
  startTime: string  // 'HH:mm' or ISO
  endTime: string    // 'HH:mm' or ISO
  category: string
  minutes: number
}

interface FocusAccumulationChartProps {
  entries: FocusEntry[]
  targetMinutes: number
  currentTime?: Date
  height?: number
}

// ── Focus weights (mirroring metrics-calc.ts) ──

const FOCUS_WEIGHTS: Record<string, number> = {
  deep_work: 1.0,
  learning: 0.9,
  creating: 0.8,
  shallow_work: 0.3,
}

// ── Helpers ──

function parseHour(time: string): number {
  // Handle 'HH:mm' or ISO datetime
  const parts = time.includes('T') ? time.split('T')[1].split(':') : time.split(':')
  return parseInt(parts[0], 10) + parseInt(parts[1] || '0', 10) / 60
}

function formatHour(hour: number): string {
  const h = Math.floor(hour)
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

// ── Custom tooltip ──

interface AccumTooltipPayload {
  value: number
  dataKey: string
  name: string
  color: string
}

interface AccumTooltipProps {
  active?: boolean
  payload?: AccumTooltipPayload[]
  label?: string
}

function AccumTooltip({ active, payload, label }: AccumTooltipProps) {
  if (!active || !payload?.length) return null

  const cumulative = payload.find(p => p.dataKey === 'cumulative')
  const projection = payload.find(p => p.dataKey === 'projection')

  return (
    <div className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 shadow-lg">
      {label && <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>}
      {cumulative != null && cumulative.value > 0 && (
        <p className="text-[13px] font-semibold text-foreground">
          {Math.round(cumulative.value)} min
        </p>
      )}
      {projection != null && projection.value > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Projected: {Math.round(projection.value)} min
        </p>
      )}
    </div>
  )
}

// ── Main Component ──

function FocusAccumulationChartInner({
  entries,
  targetMinutes,
  currentTime = new Date(),
  height = 140,
}: FocusAccumulationChartProps) {
  const reducedMotion = useReducedMotion()

  const { chartData, currentCumulative, currentHourFraction } = useMemo(() => {
    const START_HOUR = 6
    const END_HOUR = 24

    // Sort entries by start time
    const sorted = [...entries].sort((a, b) => parseHour(a.startTime) - parseHour(b.startTime))

    // Build hourly cumulative data
    const points: Array<{
      hour: number
      label: string
      cumulative: number
      projection: number | null
    }> = []

    let runningTotal = 0
    const nowHour = currentTime.getHours() + currentTime.getMinutes() / 60

    // Generate data points for each hour from start to end
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      // Sum weighted minutes from entries that end by this hour
      const minutesThisHour = sorted
        .filter(e => {
          const endH = parseHour(e.endTime)
          const startH = parseHour(e.startTime)
          // Entry contributes to this hour if its time window overlaps
          return startH < h && endH >= h - 1 && endH <= h
        })
        .reduce((sum, e) => {
          const weight = FOCUS_WEIGHTS[e.category] ?? 0
          return sum + e.minutes * weight
        }, 0)

      runningTotal += minutesThisHour

      const isFuture = h > Math.ceil(nowHour)
      points.push({
        hour: h,
        label: formatHour(h),
        cumulative: isFuture ? 0 : Math.round(runningTotal),
        projection: null,
      })
    }

    // Calculate actual cumulative at current time
    const actualCumulative = sorted.reduce((sum, e) => {
      const endH = parseHour(e.endTime)
      if (endH <= nowHour) {
        const weight = FOCUS_WEIGHTS[e.category] ?? 0
        return sum + e.minutes * weight
      }
      return sum
    }, 0)

    // Build projection line from current time to end of day
    const hoursRemaining = END_HOUR - nowHour
    if (hoursRemaining > 0 && actualCumulative < targetMinutes) {
      const minutesNeeded = targetMinutes - actualCumulative
      const ratePerHour = minutesNeeded / hoursRemaining

      for (const point of points) {
        if (point.hour >= Math.floor(nowHour)) {
          const hoursFromNow = point.hour - nowHour
          if (hoursFromNow >= 0) {
            point.projection = Math.round(actualCumulative + ratePerHour * hoursFromNow)
          }
        }
      }
    }

    return {
      chartData: points,
      currentCumulative: Math.round(actualCumulative),
      currentHourFraction: nowHour,
    }
  }, [entries, targetMinutes, currentTime])

  const pctOfTarget = targetMinutes > 0
    ? Math.round((currentCumulative / targetMinutes) * 100)
    : 0

  const nowLabel = formatHour(Math.floor(currentHourFraction))

  // X-axis ticks: show every 3 hours
  const xTicks = useMemo(() => {
    const ticks: string[] = []
    for (let h = 6; h <= 24; h += 3) {
      ticks.push(formatHour(h))
    }
    return ticks
  }, [])

  const ariaLabel = `Focus accumulation today. Current: ${currentCumulative} of ${targetMinutes} target minutes (${pctOfTarget}%). ${
    currentCumulative >= targetMinutes
      ? 'Target reached!'
      : `${targetMinutes - currentCumulative} minutes remaining.`
  }`

  if (entries.length === 0) {
    return (
      <div
        role="img"
        aria-label="Focus accumulation: no entries logged yet today."
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No focus entries logged yet today.
      </div>
    )
  }

  return (
    <div>
      <div role="img" aria-label={ariaLabel} className="relative">
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={CHART_THEME.margin.withLabels}>
            <defs>
              <ChartGradient id="focus-accum-gradient" color="#3b82f6" topOpacity={0.3} />
            </defs>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: CHART_THEME.axis.fontSize, fill: CHART_THEME.axis.fill }}
              ticks={xTicks}
            />
            <YAxis hide domain={[0, Math.max(targetMinutes * 1.1, currentCumulative * 1.1)]} />
            {/* Target line */}
            <ReferenceLine
              y={targetMinutes}
              stroke={CHART_THEME.referenceLine.target.stroke}
              strokeDasharray={CHART_THEME.referenceLine.target.strokeDasharray}
              label={{
                value: 'Target',
                position: 'right',
                fontSize: 10,
                fill: 'var(--muted-foreground)',
              }}
            />
            {/* "Now" vertical marker */}
            <ReferenceLine
              x={nowLabel}
              stroke="#3b82f666"
              strokeWidth={1}
            />
            <Tooltip content={<AccumTooltip />} />
            {/* Actual cumulative area */}
            <Area
              type="stepAfter"
              dataKey="cumulative"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#focus-accum-gradient)"
              dot={false}
              isAnimationActive={!reducedMotion}
              animationDuration={reducedMotion ? 0 : CHART_THEME.animation.slow}
            />
            {/* Ghost projection line */}
            <Area
              type="monotone"
              dataKey="projection"
              stroke="#3b82f633"
              strokeWidth={1.5}
              strokeDasharray="2 4"
              fill="none"
              dot={false}
              isAnimationActive={!reducedMotion}
              animationDuration={reducedMotion ? 0 : CHART_THEME.animation.fast}
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Pulsing "now" dot — overlaid via CSS */}
        <div
          className={`absolute w-2 h-2 rounded-full bg-blue-500 ${reducedMotion ? '' : 'animate-pulse-dot'}`}
          style={{
            // Approximate position — the dot sits at the "now" reference line vertically
            bottom: '24px',
            left: `${((currentHourFraction - 6) / 18) * 100}%`,
            transform: 'translate(-50%, 50%)',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />
      </div>

      {/* Summary text */}
      <div className="flex items-center justify-between mt-2 px-1">
        <span className="text-[11px] text-muted-foreground">
          {currentCumulative} / {targetMinutes} min ({pctOfTarget}%)
        </span>
        {currentCumulative >= targetMinutes ? (
          <span className="text-[11px] font-medium text-green-400">🎯 Target hit!</span>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            {targetMinutes - currentCumulative} min to go
          </span>
        )}
      </div>

      {/* Screen reader table */}
      <table className="sr-only">
        <caption>Focus accumulation throughout the day</caption>
        <thead>
          <tr>
            <th>Time</th>
            <th>Cumulative Minutes</th>
          </tr>
        </thead>
        <tbody>
          {chartData
            .filter(d => d.cumulative > 0)
            .map(d => (
              <tr key={d.hour}>
                <td>{d.label}</td>
                <td>{d.cumulative}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}

export const FocusAccumulationChart = React.memo(FocusAccumulationChartInner)
