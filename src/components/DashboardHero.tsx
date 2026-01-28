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

/* ── Color map ── */
const COLOR_MAP = {
  green: { stroke: '#22c55e', text: 'text-green-500', glow: '#22c55e' },
  yellow: { stroke: '#f59e0b', text: 'text-amber-500', glow: '#f59e0b' },
  red: { stroke: '#ef4444', text: 'text-red-500', glow: '#ef4444' },
}

/* ── Compact Metric Circle ── */
function MetricCircle({
  value,
  label,
  emoji,
  color,
  size = 90,
  strokeWidth = 6,
}: {
  value: number
  label: string
  emoji: string
  color: 'green' | 'yellow' | 'red'
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, value))
  const offset = circumference - (clamped / 100) * circumference
  const center = size / 2
  const colors = COLOR_MAP[color]

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-zinc-200/30 dark:text-zinc-700/40"
          />
          {/* Progress arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 6px ${colors.glow}40)` }}
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-xl font-bold tabular-nums ${colors.text}`}>
            {value}%
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-1.5">
        <span className="text-sm">{emoji}</span>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
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
      <div className="mb-4">
        <div className="flex justify-center gap-5">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Skeleton className={`rounded-full ${i === 1 ? 'h-[100px] w-[100px]' : 'h-[90px] w-[90px]'}`} />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
        <Skeleton className="h-4 w-3/4 mx-auto mt-3" />
      </div>
    )
  }

  if (!metrics) return null

  return (
    <div className="mb-4">
      {/* Three Metric Circles */}
      <div className="flex justify-center items-start gap-5 mb-3">
        <MetricCircle
          value={metrics.focus.value}
          label="Focus"
          emoji="⚡"
          color={metrics.focus.color}
        />
        <MetricCircle
          value={metrics.balance.value}
          label="Balance"
          emoji="⚖️"
          color={metrics.balance.color}
          size={100}
          strokeWidth={7}
        />
        <MetricCircle
          value={metrics.rhythm.value}
          label="Rhythm"
          emoji="🔄"
          color={metrics.rhythm.color}
        />
      </div>

      {/* Status labels */}
      <div className="flex justify-center gap-8 mb-3">
        {[
          { label: metrics.focus.label, color: metrics.focus.color },
          { label: metrics.balance.label, color: metrics.balance.color },
          { label: metrics.rhythm.label, color: metrics.rhythm.color },
        ].map((m, i) => (
          <span key={i} className={`text-[11px] font-medium ${COLOR_MAP[m.color].text}`}>
            {m.label}
          </span>
        ))}
      </div>

      {/* Nudge */}
      {metrics.nudge && (
        <p className="text-center text-xs text-muted-foreground px-4">
          {metrics.nudge}
        </p>
      )}
    </div>
  )
}
