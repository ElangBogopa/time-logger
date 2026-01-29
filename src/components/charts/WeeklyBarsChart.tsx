'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  ReferenceLine,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { getStatusColor, getStatusLabel } from '@/lib/chart-colors'
import { getStatusShape } from '@/lib/chart-a11y'
import { CHART_THEME } from '@/lib/chart-config'
import { ChartTooltip } from './ChartTooltip'

// ── Types ──

export interface WeeklyBarDataPoint {
  day: string       // 'Mon', 'Tue', etc.
  value: number     // 0-100
  date: string      // '2026-01-28'
}

interface WeeklyBarsChartProps {
  data: WeeklyBarDataPoint[]
  average: number
  todayIndex: number
  height?: number
  onBarTap?: (date: string) => void
}

// ── Custom X-axis tick with today highlight ──

interface CustomTickProps {
  x?: number
  y?: number
  payload?: { value: string; index: number }
  todayIndex: number
}

function TodayAwareXTick({ x, y, payload, todayIndex }: CustomTickProps) {
  if (x == null || y == null || !payload) return null
  const isToday = payload.index === todayIndex
  return (
    <text
      x={x}
      y={y + 14}
      textAnchor="middle"
      fontSize={10}
      fill={isToday ? 'var(--foreground)' : 'var(--muted-foreground)'}
      fontWeight={isToday ? 600 : 400}
    >
      {payload.value}
    </text>
  )
}

// ── Main Component ──

export function WeeklyBarsChart({
  data,
  average,
  todayIndex,
  height = 180,
  onBarTap,
}: WeeklyBarsChartProps) {
  const reducedMotion = useReducedMotion()

  const ariaLabel = useMemo(() => {
    const values = data.map(d => `${d.day} ${d.value}`).join(', ')
    return `Weekly scores: ${values}. Week average ${average}.`
  }, [data, average])

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] text-sm text-muted-foreground">
        No data for this week yet.
      </div>
    )
  }

  return (
    <div>
      {/* Accessible chart wrapper */}
      <div role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            margin={CHART_THEME.margin.withLabels}
            barCategoryGap="20%"
            onClick={(state: Record<string, unknown>) => {
              const ap = state?.activePayload as Array<{ payload: WeeklyBarDataPoint }> | undefined
              if (ap?.[0]?.payload && onBarTap) {
                onBarTap(ap[0].payload.date)
              }
            }}
          >
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={(props: unknown) => <TodayAwareXTick {...(props as CustomTickProps)} todayIndex={todayIndex} />}
            />
            <ReferenceLine
              y={average}
              stroke={CHART_THEME.referenceLine.average.stroke}
              strokeDasharray={CHART_THEME.referenceLine.average.strokeDasharray}
              label={{
                value: `avg ${average}`,
                position: 'right',
                fontSize: 10,
                fill: 'var(--muted-foreground)',
              }}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={false}
            />
            <Bar
              dataKey="value"
              radius={[4, 4, 0, 0] as [number, number, number, number]}
              isAnimationActive={!reducedMotion}
              animationDuration={reducedMotion ? 0 : CHART_THEME.animation.normal}
            >
              {data.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={getStatusColor(entry.value)}
                  fillOpacity={idx === todayIndex ? 1 : 0.85}
                  style={
                    idx === todayIndex
                      ? { filter: `drop-shadow(0 0 6px ${getStatusColor(entry.value)}40)` }
                      : undefined
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Shape indicator row below bars (C5 a11y — never color-only) */}
        <div className="flex justify-around px-4 -mt-1" aria-hidden="true">
          {data.map((entry, idx) => (
            <span
              key={idx}
              className="text-[9px] text-center w-7"
              style={{ color: getStatusColor(entry.value) }}
            >
              {getStatusShape(entry.value)}
            </span>
          ))}
        </div>
      </div>

      {/* Screen reader data table */}
      <table className="sr-only">
        <caption>Daily scores this week</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Score</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map(d => (
            <tr key={d.date}>
              <td>{d.day}</td>
              <td>{d.value}</td>
              <td>{getStatusLabel(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
