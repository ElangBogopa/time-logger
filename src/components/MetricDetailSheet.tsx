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

interface BodyDetails {
  totalMinutes: number
  target: number
  breakdown: Record<string, number>
}

interface SocialDetails {
  totalMinutes: number
  target: number
  breakdown: Record<string, number>
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

// ── Body category labels ──

const BODY_CATEGORY_INFO: Record<string, { label: string }> = {
  exercise: { label: 'Exercise' },
  movement: { label: 'Movement' },
  meals: { label: 'Meals' },
  rest: { label: 'Rest' },
  self_care: { label: 'Self-Care' },
  sleep: { label: 'Sleep' },
}

// ── Social category labels ──

const SOCIAL_CATEGORY_INFO: Record<string, { label: string }> = {
  social: { label: 'Social Time' },
  calls: { label: 'Calls' },
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
  body: 'Body',
  focus: 'Focus',
  social: 'Social',
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

function BodyBreakdown({ details, metricColor }: { details: BodyDetails; metricColor: string }) {
  const breakdown = Object.entries(details.breakdown).map(([category, minutes]) => {
    const info = BODY_CATEGORY_INFO[category] || { label: category }
    return { label: info.label, minutes }
  })
  breakdown.sort((a, b) => b.minutes - a.minutes)

  if (breakdown.length === 0) {
    return (
      <div className="px-4 mb-6">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Today&apos;s Body
        </h3>
        <p className="text-sm text-muted-foreground">No body care logged yet. Move, eat, or rest to fill this up.</p>
      </div>
    )
  }

  return (
    <div className="px-4 mb-6">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Today&apos;s Body — {formatMinutes(details.totalMinutes)} / {formatMinutes(details.target)}
      </h3>
      <div className="space-y-2">
        {breakdown.map(item => (
          <div key={item.label} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-foreground">{item.label}</span>
                <span className="text-muted-foreground tabular-nums">{formatMinutes(item.minutes)}</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (item.minutes / details.target) * 100)}%`,
                    backgroundColor: `${metricColor}cc`,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SocialBreakdown({ details, metricColor }: { details: SocialDetails; metricColor: string }) {
  const breakdown = Object.entries(details.breakdown).map(([category, minutes]) => {
    const info = SOCIAL_CATEGORY_INFO[category] || { label: category }
    return { label: info.label, minutes }
  })
  breakdown.sort((a, b) => b.minutes - a.minutes)

  if (breakdown.length === 0) {
    return (
      <div className="px-4 mb-6">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Today&apos;s Social
        </h3>
        <p className="text-sm text-muted-foreground">No social time logged yet. Connect with someone today.</p>
      </div>
    )
  }

  return (
    <div className="px-4 mb-6">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Today&apos;s Social — {formatMinutes(details.totalMinutes)} / {formatMinutes(details.target)}
      </h3>
      <div className="space-y-2">
        {breakdown.map(item => (
          <div key={item.label} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-foreground">{item.label}</span>
                <span className="text-muted-foreground tabular-nums">{formatMinutes(item.minutes)}</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (item.minutes / details.target) * 100)}%`,
                    backgroundColor: `${metricColor}cc`,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
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
              {metric === 'body' && (
                <BodyBreakdown
                  details={metricData.details as unknown as BodyDetails}
                  metricColor={metricColor}
                />
              )}
              {metric === 'social' && (
                <SocialBreakdown
                  details={metricData.details as unknown as SocialDetails}
                  metricColor={metricColor}
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
