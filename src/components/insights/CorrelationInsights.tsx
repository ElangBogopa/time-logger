'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Brain,
  Dumbbell,
  Users,
  Zap,
  Monitor,
  Briefcase,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CorrelationsResponse,
  CorrelationInsight,
  SessionPatternInsight,
} from '@/lib/correlation-types'
import {
  TimeCategory,
  AggregatedCategory,
  CATEGORY_LABELS,
  ENERGY_VIEW,
  TimePeriod,
} from '@/lib/types'

// ============================================================================
// ICON AND COLOR MAPPING
// ============================================================================

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  // Granular categories
  deep_work: Brain,
  shallow_work: Briefcase,
  meetings: Users,
  learning: Lightbulb,
  creating: Sparkles,
  exercise: Dumbbell,
  movement: Dumbbell,
  social: Users,
  calls: Users,
  entertainment: Monitor,
  rest: Clock,
  self_care: Zap,
  // Aggregated categories
  focus: Brain,
  ops: Briefcase,
  body: Dumbbell,
  recovery: Clock,
  connection: Users,
  escape: Monitor,
}

const DIRECTION_COLORS = {
  positive: {
    bg: 'bg-green-50 dark:bg-green-950/30',
    border: 'border-green-200 dark:border-green-900',
    bar: 'bg-green-500',
    text: 'text-green-600 dark:text-green-400',
    icon: 'text-green-500',
  },
  negative: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-900',
    bar: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
    icon: 'text-red-500',
  },
}

const PERIOD_LABELS: Record<TimePeriod, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function InsightCard({ insight }: { insight: CorrelationInsight }) {
  const colors = DIRECTION_COLORS[insight.direction]
  const categoryKey = insight.category || 'other'
  const Icon = CATEGORY_ICONS[categoryKey] || Lightbulb
  const TrendIcon = insight.direction === 'positive' ? TrendingUp : TrendingDown

  // Get label for category
  const label = (categoryKey in CATEGORY_LABELS)
    ? CATEGORY_LABELS[categoryKey as TimeCategory]
    : (categoryKey in ENERGY_VIEW)
      ? ENERGY_VIEW[categoryKey as AggregatedCategory].label
      : 'Activity'

  // Strength bar width (cap at 100%)
  const barWidth = Math.min(insight.strengthPercent, 100)

  return (
    <Card className={cn('border', colors.border, colors.bg)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0',
            insight.direction === 'positive'
              ? 'bg-green-500/10'
              : 'bg-red-500/10'
          )}>
            <Icon className={cn('h-5 w-5', colors.icon)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Category label + trend */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {label}
              </span>
              <TrendIcon className={cn('h-3.5 w-3.5', colors.text)} />
            </div>

            {/* Description */}
            <p className="text-sm font-medium text-foreground leading-snug">
              {insight.description}
            </p>

            {/* Strength bar */}
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className={cn('text-xs font-medium', colors.text)}>
                  {insight.direction === 'positive' ? '+' : '-'}{insight.strengthPercent}% mood impact
                </span>
                <span className="text-xs text-muted-foreground">
                  {insight.sampleSizeWith + insight.sampleSizeWithout} days analyzed
                </span>
              </div>
              <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', colors.bar)}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SessionPatternCard({ pattern }: { pattern: SessionPatternInsight }) {
  const fromLabel = PERIOD_LABELS[pattern.fromPeriod]
  const toLabel = PERIOD_LABELS[pattern.toPeriod]
  const moodEmoji = pattern.fromMood === 'great' ? '⚡' : pattern.fromMood === 'low' ? '😴' : '😐'
  const toMoodEmoji = pattern.toMoodAvg >= 1.5 ? '⚡' : pattern.toMoodAvg >= 0.5 ? '😐' : '😴'

  return (
    <Card className="border border-zinc-200 dark:border-zinc-800">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {/* From period */}
          <div className="flex flex-col items-center">
            <span className="text-2xl">{moodEmoji}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">{fromLabel}</span>
          </div>

          {/* Arrow */}
          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

          {/* To period */}
          <div className="flex flex-col items-center">
            <span className="text-2xl">{toMoodEmoji}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">{toLabel}</span>
          </div>

          {/* Description */}
          <p className="flex-1 text-sm text-foreground leading-snug ml-2">
            {pattern.description}
          </p>
        </div>

        <p className="text-xs text-muted-foreground mt-2 text-right">
          Based on {pattern.sampleSize} days
        </p>
      </CardContent>
    </Card>
  )
}

function EmptyState({ daysNeeded, totalDaysTracked }: { daysNeeded: number; totalDaysTracked: number }) {
  return (
    <Card className="border border-dashed border-zinc-300 dark:border-zinc-700">
      <CardContent className="p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <Lightbulb className="h-8 w-8 text-zinc-400" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Insights are unlocking...
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Keep logging your mood and activities for{' '}
          <span className="font-medium text-foreground">{daysNeeded} more day{daysNeeded !== 1 ? 's' : ''}</span>{' '}
          to unlock personalized insights about what affects your mood.
        </p>
        {/* Progress indicator */}
        <div className="mt-6 max-w-xs mx-auto">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{totalDaysTracked} days logged</span>
            <span>7 days needed</span>
          </div>
          <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${Math.min((totalDaysTracked / 7) * 100, 100)}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map(i => (
        <Card key={i} className="border border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="pt-1">
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface CorrelationInsightsProps {
  /** Show only top N insights (for teaser on dashboard) */
  limit?: number
  /** Whether to show section headers */
  showSections?: boolean
  /** Class name for container */
  className?: string
}

export default function CorrelationInsights({
  limit,
  showSections = true,
  className,
}: CorrelationInsightsProps) {
  const [data, setData] = useState<CorrelationsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInsights = useCallback(async () => {
    try {
      const response = await fetch('/api/correlations')
      if (!response.ok) throw new Error('Failed to fetch insights')
      const result: CorrelationsResponse = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  if (isLoading) {
    return (
      <div className={className}>
        <LoadingSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className={className}>
        <Card className="border border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Unable to load insights</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  // Not enough data
  if (!data.hasEnoughData) {
    return (
      <div className={className}>
        <EmptyState daysNeeded={data.daysNeeded} totalDaysTracked={data.totalDaysTracked} />
      </div>
    )
  }

  // Enough data but no significant insights found
  if (data.insights.length === 0 && data.sessionPatterns.length === 0) {
    return (
      <div className={className}>
        <Card className="border border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-6 text-center">
            <Lightbulb className="h-8 w-8 text-zinc-400 mx-auto mb-3" />
            <h3 className="font-medium text-foreground mb-1">No strong patterns yet</h3>
            <p className="text-sm text-muted-foreground">
              Your mood doesn&apos;t show strong correlations with specific activities yet.
              Keep logging — patterns often emerge over 2-3 weeks.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const insights = limit ? data.insights.slice(0, limit) : data.insights
  const topInsights = data.insights.slice(0, 3)
  const activityInsights = data.insights.filter(i => i.type === 'category_presence')
  const durationInsights = data.insights.filter(i => i.type === 'category_duration')

  // Simple mode (for dashboard teaser)
  if (!showSections) {
    return (
      <div className={cn('space-y-3', className)}>
        {insights.map(insight => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    )
  }

  // Full mode with sections
  return (
    <div className={cn('space-y-8', className)}>
      {/* Top Insights */}
      {topInsights.length > 0 && (
        <section>
          <CardHeader className="px-0 pt-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Top Insights
            </CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {topInsights.map(insight => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </section>
      )}

      {/* Activity Impact */}
      {activityInsights.length > 0 && (
        <section>
          <CardHeader className="px-0 pt-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Activity Impact
            </CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {activityInsights.map(insight => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </section>
      )}

      {/* Duration Insights */}
      {durationInsights.length > 0 && (
        <section>
          <CardHeader className="px-0 pt-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-purple-500" />
              Time Investment
            </CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {durationInsights.map(insight => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </section>
      )}

      {/* Session Patterns */}
      {data.sessionPatterns.length > 0 && (
        <section>
          <CardHeader className="px-0 pt-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-indigo-500" />
              Session Patterns
            </CardTitle>
          </CardHeader>
          <p className="text-sm text-muted-foreground mb-3">
            How your mood flows through the day
          </p>
          <div className="space-y-3">
            {data.sessionPatterns.map(pattern => (
              <SessionPatternCard key={pattern.id} pattern={pattern} />
            ))}
          </div>
        </section>
      )}

      {/* Data info */}
      <p className="text-xs text-muted-foreground text-center">
        Based on {data.totalDaysTracked} days of mood and activity data
      </p>
    </div>
  )
}
