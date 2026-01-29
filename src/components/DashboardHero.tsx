'use client'

import { useEffect, useState, useCallback } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { MiniSparkline } from '@/components/charts/MiniSparkline'
import { ChartErrorBoundary } from '@/components/charts/ChartErrorBoundary'
import { METRIC_COLORS } from '@/lib/chart-colors'
import type { MetricKey } from '@/lib/chart-colors'
import type { TrendAPIResponse } from '@/lib/trend-types'

export type { TrendAPIResponse }

/* ── Per-metric color identity ── */
const METRIC_IDENTITY = {
  focus: {
    active: '#3b82f6',
    track: '#3b82f620',
    trackDim: '#3b82f610',
  },
  balance: {
    active: '#f59e0b',
    track: '#f59e0b20',
    trackDim: '#f59e0b10',
  },
  rhythm: {
    active: '#22c55e',
    track: '#22c55e20',
    trackDim: '#22c55e10',
  },
}

/* ── Props ── */
interface DashboardHeroProps {
  onMetricTap?: (metric: MetricKey) => void
  activeMetric?: MetricKey | null
  onTrendDataLoaded?: (data: TrendAPIResponse) => void
}

/* ── Metric Circle ── */
function MetricCircle({
  value,
  label,
  metricKey,
  size = 96,
  strokeWidth = 7,
}: {
  value: number
  label: string
  metricKey: MetricKey
  size?: number
  strokeWidth?: number
}) {
  const identity = METRIC_IDENTITY[metricKey]
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, value))
  const offset = circumference - (clamped / 100) * circumference
  const center = size / 2
  const hasProgress = value > 0

  const trackColor = hasProgress ? identity.track : identity.trackDim
  const activeColor = identity.active
  const textColor = hasProgress ? activeColor : 'var(--muted-foreground)'

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden="true"
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />
          {hasProgress && (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={activeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={{ filter: `drop-shadow(0 0 8px ${activeColor}50)` }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[22px] font-bold tabular-nums"
            style={{ color: textColor }}
            aria-hidden="true"
          >
            {value}
          </span>
        </div>
      </div>
      <span
        className={`text-[11px] font-semibold uppercase tracking-wider mt-1 ${
          hasProgress ? 'text-foreground' : 'text-muted-foreground'
        }`}
        aria-hidden="true"
      >
        {label} ›
      </span>
    </div>
  )
}

/* ── Main Component ── */
export default function DashboardHero({ onMetricTap, activeMetric, onTrendDataLoaded }: DashboardHeroProps) {
  const [trendData, setTrendData] = useState<TrendAPIResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchTrendData = useCallback(async (signal: AbortSignal) => {
    try {
      const res = await fetch('/api/metrics/trend?period=7d', { signal })
      if (res.ok) {
        const data: TrendAPIResponse = await res.json()
        setTrendData(data)
        onTrendDataLoaded?.(data)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('Failed to fetch trend data:', err)
    } finally {
      if (!signal.aborted) setIsLoading(false)
    }
  }, [onTrendDataLoaded])

  useEffect(() => {
    const controller = new AbortController()
    fetchTrendData(controller.signal)
    return () => controller.abort()
  }, [fetchTrendData])

  if (isLoading) {
    return (
      <div className="mb-5">
        <div className="flex justify-center gap-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className={`rounded-full ${i === 1 ? 'h-[100px] w-[100px]' : 'h-[90px] w-[90px]'}`} />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!trendData) return null

  const metrics: Array<{
    key: MetricKey
    label: string
    size: number
    strokeWidth: number
  }> = [
    { key: 'focus', label: 'Focus', size: 96, strokeWidth: 7 },
    { key: 'balance', label: 'Balance', size: 104, strokeWidth: 8 },
    { key: 'rhythm', label: 'Rhythm', size: 96, strokeWidth: 7 },
  ]

  return (
    <div className="mb-4">
      {/* Three Metric Circles — each is a tappable button with sparkline inside */}
      <div className="flex justify-center items-start gap-4 mb-3">
        {metrics.map(({ key, label, size, strokeWidth }) => {
          const metricTrend = trendData[key]
          const trendValues = metricTrend.trend.map(t => t.value)
          const vsLw = metricTrend.vsLastWeek
          const trendDesc = vsLw == null
            ? 'comparison unavailable'
            : vsLw.direction === 'up'
              ? `up by ${vsLw.change}`
              : vsLw.direction === 'down'
                ? `down by ${Math.abs(vsLw.change)}`
                : 'same'
          const ariaLabel = `${label} score: ${metricTrend.current} out of 100. 7-day average ${metricTrend.average}, trending ${trendDesc}. Tap to view details.`

          return (
            <button
              key={key}
              onClick={() => onMetricTap?.(key)}
              aria-expanded={activeMetric === key}
              aria-label={ariaLabel}
              className="appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95 transition-transform rounded-full flex flex-col items-center"
            >
              <MetricCircle
                value={metricTrend.current}
                label={label}
                metricKey={key}
                size={size}
                strokeWidth={strokeWidth}
              />
              {/* MiniSparkline inside the button for unified tap target (W2) */}
              <div className="w-full mt-0.5" style={{ maxWidth: size }}>
                <ChartErrorBoundary height={52}>
                  <MiniSparkline
                    data={trendValues}
                    color={METRIC_COLORS[key].hex}
                    average={metricTrend.average}
                    delta={metricTrend.vsLastWeek?.change ?? 0}
                    gradientId={`sparkline-hero-${key}`}
                    decorative={true}
                  />
                </ChartErrorBoundary>
              </div>
            </button>
          )
        })}
      </div>

      {/* Insight card — Whoop style */}
      {trendData.nudge && (
        <div className="mx-2 rounded-xl bg-card border border-border px-4 py-3" aria-live="polite">
          <p className="text-[13px] text-secondary-foreground leading-relaxed">
            {trendData.nudge}
          </p>
        </div>
      )}
    </div>
  )
}
