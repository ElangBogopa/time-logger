'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { MetricTrendChart } from '@/components/charts/MetricTrendChart'
import { StatusDelta } from '@/components/charts/StatusDelta'
import { METRIC_COLORS, getStatusLabel, getStatusTailwind } from '@/lib/chart-colors'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { ChartErrorBoundary } from '@/components/charts/ChartErrorBoundary'
import { ChevronLeft, CheckCircle2, Circle, Sparkles } from 'lucide-react'
import type { MetricKey, TrendDataPoint, PersonalBest, TrendAPIResponse } from '@/lib/trend-types'
import { cacheGet, cacheSet } from '@/lib/client-cache'

// ── Detail types (cast from the generic Record at usage site) ──

interface FocusDetails {
  weightedMinutes: number
  target: number
  breakdown: Record<string, number>
}

interface BalanceDetails {
  body: number
  mind: number
  connection: number
  bodyMinutes: number
  mindMinutes: number
  connectionMinutes: number
}

interface RhythmEssential {
  name: string
  minutes: number
  threshold: number
  hit: boolean
}

interface RhythmDetails {
  essentials: RhythmEssential[]
}

interface MetricDetailSheetProps {
  metric: MetricKey
  isOpen: boolean
  onClose: () => void
  /** Optional 7-day trend data from DashboardHero to avoid re-fetching */
  initialData?: TrendAPIResponse | null
}

// ── Focus category labels & weights ──

const FOCUS_CATEGORY_INFO: Record<string, { label: string; weight: number; target: number }> = {
  deep_work: { label: 'Deep Work', weight: 1.0, target: 120 },
  learning: { label: 'Learning', weight: 0.9, target: 60 },
  creating: { label: 'Creating', weight: 0.8, target: 60 },
  shallow_work: { label: 'Shallow Work', weight: 0.3, target: 30 },
}

// ── Balance sub-score targets ──

const BALANCE_TARGETS = {
  body: 90,
  mind: 30,
  connection: 30,
}

// ── Helpers ──

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const METRIC_LABELS: Record<MetricKey, string> = {
  focus: 'Focus',
  balance: 'Balance',
  rhythm: 'Rhythm',
}

// ── Sub-components ──

function FocusBreakdown({ details, metricColor }: { details: FocusDetails; metricColor: string }) {
  const breakdown = Object.entries(details.breakdown).map(([category, minutes]) => {
    const info = FOCUS_CATEGORY_INFO[category] || { label: category, weight: 0.5, target: 30 }
    return { label: info.label, minutes, weight: info.weight, target: info.target }
  })

  // Sort by minutes descending
  breakdown.sort((a, b) => b.minutes - a.minutes)

  if (breakdown.length === 0) {
    return (
      <div className="px-4 mb-6">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Today&apos;s Breakdown
        </h3>
        <p className="text-sm text-muted-foreground">No focus activities logged yet today.</p>
      </div>
    )
  }

  return (
    <div className="px-4 mb-6">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Today&apos;s Breakdown
      </h3>
      <div className="space-y-2">
        {breakdown.map(item => (
          <div key={item.label} className="flex items-center gap-3 bg-secondary/50 rounded-lg px-3 py-2.5">
            <span className="text-sm text-foreground flex-1">{item.label}</span>
            <span className="text-[10px] text-muted-foreground">{item.weight}x</span>
            <span className="text-sm font-medium text-foreground tabular-nums w-16 text-right">
              {formatMinutes(item.minutes)}
            </span>
            <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (item.minutes / item.target) * 100)}%`,
                  backgroundColor: `${metricColor}cc`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BalanceBreakdown({ details, metricColor }: { details: BalanceDetails; metricColor: string }) {
  const subScores = [
    { label: 'Body', value: details.body, minutes: details.bodyMinutes, target: BALANCE_TARGETS.body },
    { label: 'Mind', value: details.mind, minutes: details.mindMinutes, target: BALANCE_TARGETS.mind },
    { label: 'Connection', value: details.connection, minutes: details.connectionMinutes, target: BALANCE_TARGETS.connection },
  ]

  return (
    <div className="px-4 mb-6">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Today&apos;s Balance
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {subScores.map(sub => (
          <div key={sub.label} className="bg-secondary/50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{sub.label}</p>
            <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: metricColor }}>
              {sub.value}
            </p>
            <div className="w-full h-1 bg-secondary rounded-full overflow-hidden mt-2">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, sub.value)}%`,
                  backgroundColor: `${metricColor}cc`,
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {formatMinutes(sub.minutes)} / {formatMinutes(sub.target)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function RhythmBreakdown({ details, trend }: { details: RhythmDetails; trend: TrendDataPoint[] }) {
  // Build 7-day consistency data from trend
  const last7 = trend.slice(-7)
  const consistencyDots = last7.map(d => ({
    date: d.label,
    allHit: d.value >= 75,
    someHit: d.value >= 25,
    value: d.value,
  }))

  return (
    <div className="px-4 mb-6">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Today&apos;s Essentials
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {details.essentials.map(e => (
          <div
            key={e.name}
            className={`flex items-center gap-2 rounded-lg px-3 py-2.5 ${
              e.hit
                ? 'bg-green-500/10 border border-green-500/20'
                : 'bg-secondary/50 border border-transparent'
            }`}
          >
            {e.hit ? (
              <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" aria-hidden="true" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            )}
            <div className="flex-1 min-w-0">
              <span className={`text-sm ${e.hit ? 'text-foreground' : 'text-muted-foreground'}`}>
                {e.name}
              </span>
              <p className="text-[10px] text-muted-foreground">
                {formatMinutes(e.minutes)} / {formatMinutes(e.threshold)}
              </p>
            </div>
            <span className="sr-only">{e.hit ? 'Completed' : 'Not completed'}</span>
          </div>
        ))}
      </div>

      {/* 7-day consistency dots */}
      <div className="mt-4">
        <p className="text-[10px] text-muted-foreground mb-2">Last 7 days</p>
        <div className="flex gap-1">
          {consistencyDots.map((day, i) => (
            <div
              key={i}
              className={`h-6 flex-1 rounded-sm flex items-center justify-center text-[9px] font-bold ${
                day.allHit
                  ? 'bg-green-500/80 text-white'
                  : day.someHit
                    ? 'bg-amber-500/60 text-white'
                    : 'bg-secondary text-muted-foreground'
              }`}
              title={`${day.date}: ${day.value}`}
              aria-label={`${day.date}: score ${day.value}`}
            >
              {day.allHit ? '✓' : day.someHit ? '·' : ''}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">7 days ago</span>
          <span className="text-[10px] text-muted-foreground">Today</span>
        </div>
      </div>
    </div>
  )
}

function PersonalBestBadge({ personalBest }: { personalBest: PersonalBest }) {
  return (
    <div className="mx-4 mb-6 flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
      <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
      <div>
        <p className="text-sm font-medium text-foreground">
          Personal Best: {personalBest.value}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(personalBest.date)}
        </p>
      </div>
    </div>
  )
}

// ── Main Component ──

export default function MetricDetailSheet({
  metric,
  isOpen,
  onClose,
  initialData,
}: MetricDetailSheetProps) {
  const [period, setPeriod] = useState<'7d' | '30d'>('7d')
  const [data, setData] = useState<TrendAPIResponse | null>(initialData ?? null)
  const [isLoading, setIsLoading] = useState(false)

  // Use initial data when available and period is 7d
  useEffect(() => {
    if (initialData && period === '7d') {
      setData(initialData)
    }
  }, [initialData, period])

  // Fetch data when sheet opens or period changes (only fetch for 30d or if no initial data)
  const fetchData = useCallback(async () => {
    if (!isOpen) return
    if (period === '7d' && initialData) {
      setData(initialData)
      return
    }

    // Check cache for 30d data
    const cacheKey = `metric-trend:${period}`
    const cached = cacheGet<TrendAPIResponse>(cacheKey)
    if (cached) {
      setData(cached)
      return
    }

    setIsLoading(true)
    const controller = new AbortController()

    try {
      const res = await fetch(`/api/metrics/trend?period=${period}`, {
        signal: controller.signal,
      })
      if (res.ok) {
        const json = await res.json()
        cacheSet(cacheKey, json)
        setData(json)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('Failed to fetch trend data:', err)
    } finally {
      setIsLoading(false)
    }

    return () => controller.abort()
  }, [isOpen, period, initialData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Reset period when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setPeriod('7d')
    }
  }, [isOpen])

  const reducedMotion = useReducedMotion()

  const metricData = data?.[metric]
  const metricColor = METRIC_COLORS[metric].hex
  const metricLabel = METRIC_LABELS[metric]

  // Stagger animation styles
  const staggerStyle = useMemo(() => ({
    hero: {
      animation: reducedMotion ? 'none' : 'fadeIn 300ms ease-out both',
      animationDelay: '0ms',
    },
    chart: {
      animation: reducedMotion ? 'none' : 'fadeIn 300ms ease-out both',
      animationDelay: reducedMotion ? '0ms' : '150ms',
    },
    breakdown: {
      animation: reducedMotion ? 'none' : 'fadeIn 300ms ease-out both',
      animationDelay: reducedMotion ? '0ms' : '300ms',
    },
  }), [reducedMotion])

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="h-[85vh] rounded-t-2xl bg-background border-t border-border overflow-y-auto px-0 pb-8"
      >
        {/* Handle bar */}
        <div className="sticky top-0 z-10 bg-background pt-2 pb-1 px-4">
          <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between px-4 mt-3 mb-6">
          <button
            onClick={onClose}
            aria-label="Close sheet"
            className="flex items-center justify-center h-11 w-11 -ml-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <SheetTitle className="text-base font-semibold text-foreground">
            {metricLabel}
          </SheetTitle>
          <div className="w-11" />
        </div>

        {/* Content */}
        {isLoading && !metricData ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : metricData ? (
          <>
            {/* Hero score — stagger 1 */}
            <div className="text-center mb-6 px-4" style={staggerStyle.hero}>
              <div className="flex items-baseline justify-center gap-1">
                <span
                  className="text-5xl font-bold tabular-nums"
                  style={{ color: metricColor }}
                >
                  {metricData.current}
                </span>
                <span className="text-lg text-muted-foreground">/100</span>
              </div>
              <p className={`text-sm font-medium mt-1 ${getStatusTailwind(metricData.current)}`}>
                {getStatusLabel(metricData.current)}
              </p>
              <div className="flex items-center justify-center mt-2">
                <StatusDelta
                  value={metricData.vsLastWeek?.change ?? null}
                  size="sm"
                  label="vs last week"
                />
              </div>
            </div>

            {/* Trend chart — stagger 2 */}
            <div className="px-4 mb-6" style={staggerStyle.chart}>
              <ChartErrorBoundary fallbackValue={metricData.current} fallbackLabel={metricLabel} height={160}>
              <MetricTrendChart
                data={metricData.trend}
                metricColor={metricColor}
                metricLabel={metricLabel}
                average={metricData.average}
                period={period}
                onPeriodChange={setPeriod}
                height={160}
              />
              </ChartErrorBoundary>
            </div>

            {/* Metric-specific breakdown — stagger 3 */}
            <div style={staggerStyle.breakdown}>
              {metric === 'focus' && (
                <FocusBreakdown
                  details={metricData.details as unknown as FocusDetails}
                  metricColor={metricColor}
                />
              )}
              {metric === 'balance' && (
                <BalanceBreakdown
                  details={metricData.details as unknown as BalanceDetails}
                  metricColor={metricColor}
                />
              )}
              {metric === 'rhythm' && (
                <RhythmBreakdown
                  details={metricData.details as unknown as RhythmDetails}
                  trend={metricData.trend}
                />
              )}
            </div>

            {/* Personal best badge */}
            {metricData.personalBest && metricData.personalBest.value > 0 && (
              <PersonalBestBadge personalBest={metricData.personalBest} />
            )}
          </>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p>Unable to load metric data.</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
