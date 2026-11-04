'use client'

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { MetricKey } from '@/lib/chart-colors'
import type { TrendAPIResponse } from '@/lib/trend-types'
import { METRIC_LABELS } from '@/lib/metrics-calc'
import { METRIC_HEX, METRIC_TEXT_HEX } from '@/lib/palette'

export type { TrendAPIResponse }

/**
 * Per-metric colour identity, from the one palette: each ring is the colour
 * of the bucket it is computed from, so the ring and the timeline blocks that
 * filled it match. These were saturated Tailwind 500s with a neon glow,
 * against CLAUDE.md's "no bright neons".
 */
const METRIC_IDENTITY = {
  body: { active: METRIC_HEX.body, text: METRIC_TEXT_HEX.body },
  focus: { active: METRIC_HEX.focus, text: METRIC_TEXT_HEX.focus },
  social: { active: METRIC_HEX.social, text: METRIC_TEXT_HEX.social },
} as const

/* ── Props ── */
interface DashboardHeroProps {
  onMetricTap?: (metric: MetricKey) => void
  activeMetric?: MetricKey | null
  onTrendDataLoaded?: (data: TrendAPIResponse) => void
  date?: string // YYYY-MM-DD, defaults to today
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

  // One track colour: the ring reads as a dial, not as two states.
  const activeColor = identity.active
  const trackColor = 'var(--color-border)'
  const textColor = hasProgress ? identity.text : 'var(--muted-foreground)'

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
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="metric-number" style={{ color: textColor }} aria-hidden="true">
            {value}
          </span>
        </div>
      </div>
      {/* Full contrast whether or not there is progress: the number below
          already says which metrics are empty, and three labels in three
          different greys was the noisiest part of the hero. */}
      <span className="eyebrow mt-1.5" aria-hidden="true">
        {label}
      </span>
    </div>
  )
}

/* ── Client-side cache for trend data per date ── */
const trendCache = new Map<string, TrendAPIResponse>()

/* ── Main Component ── */
export default function DashboardHero({ onMetricTap, activeMetric, onTrendDataLoaded, date }: DashboardHeroProps) {
  const cacheKey = date || '__today__'
  const cached = trendCache.get(cacheKey)
  const [trendData, setTrendData] = useState<TrendAPIResponse | null>(cached || null)
  const [isLoading, setIsLoading] = useState(!cached)

  useEffect(() => {
    // If we have cached data for this date, use it immediately
    const cachedData = trendCache.get(cacheKey)
    if (cachedData) {
      setTrendData(cachedData)
      setIsLoading(false)
      onTrendDataLoaded?.(cachedData)
    }

    const controller = new AbortController()
    const fetchTrendData = async () => {
      try {
        // Only show loading skeleton if we have NO data at all for this date
        if (!cachedData) setIsLoading(true)
        const params = new URLSearchParams({ period: '7d' })
        if (date) params.set('date', date)
        const res = await fetch(`/api/metrics/trend?${params}`, { signal: controller.signal })
        if (res.ok) {
          const data: TrendAPIResponse = await res.json()
          trendCache.set(cacheKey, data)
          if (!controller.signal.aborted) {
            setTrendData(data)
            onTrendDataLoaded?.(data)
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        console.error('Failed to fetch trend data:', err)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }
    fetchTrendData()
    return () => controller.abort()
  }, [cacheKey, date, onTrendDataLoaded])

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
    { key: 'body', label: METRIC_LABELS.body, size: 96, strokeWidth: 7 },
    { key: 'focus', label: METRIC_LABELS.focus, size: 104, strokeWidth: 8 },
    { key: 'social', label: METRIC_LABELS.social, size: 96, strokeWidth: 7 },
  ]

  return (
    <div className="mb-4">
      {/* Three Metric Circles — each is a tappable button with sparkline inside */}
      {/* items-end: Mind is drawn larger on purpose, and aligning the tops
          stepped the three labels down the page. */}
      <div className="flex justify-center items-end gap-4 mb-3">
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
            </button>
          )
        })}
      </div>

    </div>
  )
}
