'use client'

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

/* ── Types ── */
interface MetricData {
  value: number
  color: 'green' | 'yellow' | 'red'
  label: string
  details: Record<string, unknown>
}

interface MetricsResponse {
  focus: MetricData
  balance: MetricData
  rhythm: MetricData
  nudge: string
}

/* ── Per-metric color identity (like Whoop: each circle = unique color) ── */
const METRIC_IDENTITY = {
  focus: {
    active: '#3b82f6',   // blue — cognitive output
    track: '#1e3a5f',    // dark blue track
    trackDim: '#162d4a', // dimmer when 0%
  },
  balance: {
    active: '#f5c842',   // gold/yellow — recovery
    track: '#3d3520',    // dark gold track
    trackDim: '#2a2618', // dimmer when 0%
  },
  rhythm: {
    active: '#00dc82',   // green — consistency
    track: '#0d3a2a',    // dark green track
    trackDim: '#0a2d22', // dimmer when 0%
  },
}

/* ── Status color for labels ── */
const STATUS_COLORS = {
  green: 'text-[#00dc82]',
  yellow: 'text-[#f5c842]',
  red: 'text-[#ef4444]',
}

/* ── Metric Circle — Whoop style with unique identity color ── */
function MetricCircle({
  value,
  label,
  metricKey,
  size = 96,
  strokeWidth = 7,
}: {
  value: number
  label: string
  metricKey: 'focus' | 'balance' | 'rhythm'
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

  // When 0%, show dimmer track and gray text. When > 0%, show identity color.
  const trackColor = hasProgress ? identity.track : identity.trackDim
  const activeColor = identity.active
  const textColor = hasProgress ? activeColor : '#4a5f78'

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background track — visible, tinted per metric */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
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
        {/* Center value */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[22px] font-bold tabular-nums"
            style={{ color: textColor }}
          >
            {value}
          </span>
        </div>
      </div>
      {/* Label below */}
      <span className="text-[11px] font-semibold uppercase tracking-wider mt-2"
        style={{ color: hasProgress ? '#c8d6e0' : '#4a5f78' }}>
        {label} ›
      </span>
    </div>
  )
}

/* ── Main Component ── */
export default function DashboardHero() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    async function fetchMetrics() {
      try {
        const res = await fetch('/api/metrics', { signal: controller.signal })
        if (res.ok) {
          const data = await res.json()
          setMetrics(data)
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        console.error('Failed to fetch metrics:', err)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    fetchMetrics()
    return () => controller.abort()
  }, [])

  if (isLoading) {
    return (
      <div className="mb-5">
        <div className="flex justify-center gap-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="h-24 w-24 rounded-full" />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!metrics) return null

  return (
    <div className="mb-4">
      {/* Three Metric Circles — each with unique identity color */}
      <div className="flex justify-center items-start gap-4 mb-3">
        <MetricCircle
          value={metrics.focus.value}
          label="Focus"
          metricKey="focus"
        />
        <MetricCircle
          value={metrics.balance.value}
          label="Balance"
          metricKey="balance"
          size={104}
          strokeWidth={8}
        />
        <MetricCircle
          value={metrics.rhythm.value}
          label="Rhythm"
          metricKey="rhythm"
        />
      </div>

      {/* Insight card — Whoop style */}
      {metrics.nudge && (
        <div className="mx-2 rounded-xl bg-[#152535] border border-[rgba(255,255,255,0.05)] px-4 py-3">
          <p className="text-[13px] text-[#c8d6e0] leading-relaxed">
            {metrics.nudge}
          </p>
        </div>
      )}
    </div>
  )
}
