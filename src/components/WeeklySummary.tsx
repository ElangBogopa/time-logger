'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  TimeEntry,
  TimeCategory,
  CATEGORY_LABELS,
  getLocalDateString,
  AggregatedCategory,
  ENERGY_VIEW,
  AGGREGATED_CATEGORY_LABELS,
  aggregateByView,
} from '@/lib/types'
import { formatDuration } from '@/lib/time-utils'
import { Skeleton } from '@/components/ui/skeleton'

const CATEGORY_BAR_COLORS: Record<TimeCategory, string> = {
  // Productive
  deep_work: 'bg-[#3b82f6]',
  shallow_work: 'bg-[#64748b]',
  meetings: 'bg-[#8b7aa8]',
  learning: 'bg-[#0891b2]',
  creating: 'bg-[#7c3aed]',
  // Maintenance
  admin: 'bg-[#9ca3af]',
  errands: 'bg-[#78716c]',
  chores: 'bg-[#a1a1aa]',
  commute: 'bg-[#737373]',
  // Body
  exercise: 'bg-[#22c55e]',
  movement: 'bg-[#86efac]',
  meals: 'bg-[#f59e0b]',
  sleep: 'bg-[#1e3a5f]',
  // Mind
  rest: 'bg-[#a8a4ce]',
  self_care: 'bg-[#c4b5fd]',
  // Connection
  social: 'bg-[#ec4899]',
  calls: 'bg-[#f472b6]',
  // Leisure
  entertainment: 'bg-[#71717a]',
  // Fallback
  other: 'bg-[#52525b]',
}

// Aggregated category colors (for the 6-energy view)
const AGGREGATED_BAR_COLORS: Record<AggregatedCategory, string> = {
  focus: 'bg-blue-500',
  ops: 'bg-slate-500',
  body: 'bg-green-500',
  recovery: 'bg-amber-500',
  connection: 'bg-pink-500',
  escape: 'bg-zinc-500',
}

interface CategoryStats {
  category: TimeCategory
  minutes: number
  previousMinutes: number
  change: number
}

interface AggregatedStats {
  category: AggregatedCategory
  label: string
  minutes: number
  previousMinutes: number
  change: number
}

function getWeekDateRange(weeksAgo: number = 0): { start: string; end: string } {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - dayOfWeek - (weeksAgo * 7))
  startOfWeek.setHours(0, 0, 0, 0)

  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  return {
    start: getLocalDateString(startOfWeek),
    end: getLocalDateString(endOfWeek),
  }
}

function formatWeekRange(start: string, end: string): string {
  const startDate = new Date(start + 'T00:00:00')
  const endDate = new Date(end + 'T00:00:00')

  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`
}

interface WeeklySummaryProps {
  userId: string
}

export default function WeeklySummary({ userId }: WeeklySummaryProps) {
  const [stats, setStats] = useState<CategoryStats[]>([])
  const [aggregatedStats, setAggregatedStats] = useState<AggregatedStats[]>([])
  const [showDetailed, setShowDetailed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [totalMinutes, setTotalMinutes] = useState(0)
  const [previousTotalMinutes, setPreviousTotalMinutes] = useState(0)
  const [weekRange, setWeekRange] = useState({ start: '', end: '' })

  useEffect(() => {
    const fetchWeeklyData = async () => {
      if (!userId) return
      setIsLoading(true)

      const currentWeek = getWeekDateRange(0)
      const previousWeek = getWeekDateRange(1)

      setWeekRange(currentWeek)

      // Fetch current week entries
      const { data: currentEntries } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('date', currentWeek.start)
        .lte('date', currentWeek.end)

      // Fetch previous week entries
      const { data: previousEntries } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('date', previousWeek.start)
        .lte('date', previousWeek.end)

      // Calculate stats by category (skip entries without a category - pending entries)
      const currentByCategory: Record<string, number> = {}
      const previousByCategory: Record<string, number> = {}

      ;(currentEntries || []).forEach((entry: TimeEntry) => {
        if (!entry.category) return // Skip pending entries
        currentByCategory[entry.category] = (currentByCategory[entry.category] || 0) + entry.duration_minutes
      })

      ;(previousEntries || []).forEach((entry: TimeEntry) => {
        if (!entry.category) return // Skip pending entries
        previousByCategory[entry.category] = (previousByCategory[entry.category] || 0) + entry.duration_minutes
      })

      // Build stats array
      const allCategories = Object.keys(CATEGORY_LABELS) as TimeCategory[]
      const categoryStats: CategoryStats[] = allCategories
        .map((category) => ({
          category,
          minutes: currentByCategory[category] || 0,
          previousMinutes: previousByCategory[category] || 0,
          change: (currentByCategory[category] || 0) - (previousByCategory[category] || 0),
        }))
        .filter((stat) => stat.minutes > 0 || stat.previousMinutes > 0)
        .sort((a, b) => b.minutes - a.minutes)

      // Build aggregated stats using the energy view
      const currentCategoryMap = new Map<TimeCategory, number>()
      const previousCategoryMap = new Map<TimeCategory, number>()
      for (const [cat, mins] of Object.entries(currentByCategory)) {
        currentCategoryMap.set(cat as TimeCategory, mins)
      }
      for (const [cat, mins] of Object.entries(previousByCategory)) {
        previousCategoryMap.set(cat as TimeCategory, mins)
      }

      const currentAggregated = aggregateByView(currentCategoryMap, ENERGY_VIEW)
      const previousAggregated = aggregateByView(previousCategoryMap, ENERGY_VIEW)

      const aggCategories: AggregatedCategory[] = ['focus', 'ops', 'body', 'recovery', 'connection', 'escape']
      const aggregatedStatsArray: AggregatedStats[] = aggCategories
        .map((aggCat) => ({
          category: aggCat,
          label: AGGREGATED_CATEGORY_LABELS[aggCat],
          minutes: currentAggregated.get(aggCat) || 0,
          previousMinutes: previousAggregated.get(aggCat) || 0,
          change: (currentAggregated.get(aggCat) || 0) - (previousAggregated.get(aggCat) || 0),
        }))
        .filter((stat) => stat.minutes > 0 || stat.previousMinutes > 0)
        .sort((a, b) => b.minutes - a.minutes)

      setStats(categoryStats)
      setAggregatedStats(aggregatedStatsArray)
      setTotalMinutes((currentEntries || []).reduce((sum: number, e: TimeEntry) => sum + e.duration_minutes, 0))
      setPreviousTotalMinutes((previousEntries || []).reduce((sum: number, e: TimeEntry) => sum + e.duration_minutes, 0))
      setIsLoading(false)
    }

    fetchWeeklyData()
  }, [userId])

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-5 w-24" />
        </div>
        {/* Bars skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-3 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const maxMinutes = Math.max(...stats.map((s) => s.minutes), 1)
  const maxAggMinutes = Math.max(...aggregatedStats.map((s) => s.minutes), 1)
  const top3Agg = aggregatedStats.slice(0, 3)
  const totalChange = totalMinutes - previousTotalMinutes

  return (
    <div className="space-y-6">
      {/* Week Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Weekly Summary
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {formatWeekRange(weekRange.start, weekRange.end)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {formatDuration(totalMinutes)}
          </p>
          <p className={`text-sm font-medium ${totalChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {totalChange >= 0 ? '+' : ''}{formatDuration(Math.abs(totalChange))} vs last week
          </p>
        </div>
      </div>

      {/* Top 3 Energy Categories */}
      {top3Agg.length > 0 && (
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:from-blue-900/20 dark:to-indigo-900/20">
          <h4 className="mb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Energy Distribution</h4>
          <div className="grid grid-cols-3 gap-3">
            {top3Agg.map((stat, index) => (
              <div key={stat.category} className="text-center">
                <div className="mb-1 text-2xl">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                </div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {stat.label}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {formatDuration(stat.minutes)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aggregated Energy View (primary) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Time by Energy</h4>
          <button
            onClick={() => setShowDetailed(!showDetailed)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showDetailed ? 'Show summary' : 'Show detailed'}
          </button>
        </div>
        {(showDetailed ? stats.length : aggregatedStats.length) === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No entries this week yet.
          </p>
        ) : showDetailed ? (
          // Detailed view - granular categories
          <div className="space-y-2">
            {stats.map((stat) => (
              <div key={stat.category} className="group">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {CATEGORY_LABELS[stat.category]}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {formatDuration(stat.minutes)}
                    </span>
                    {stat.change !== 0 && (
                      <span className={`text-xs font-medium ${stat.change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {stat.change > 0 ? '+' : ''}{formatDuration(Math.abs(stat.change))}
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-4 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${CATEGORY_BAR_COLORS[stat.category]}`}
                    style={{ width: `${(stat.minutes / maxMinutes) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Aggregated view - 6 energy categories
          <div className="space-y-2">
            {aggregatedStats.map((stat) => (
              <div key={stat.category} className="group">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {stat.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {formatDuration(stat.minutes)}
                    </span>
                    {stat.change !== 0 && (
                      <span className={`text-xs font-medium ${stat.change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {stat.change > 0 ? '+' : ''}{formatDuration(Math.abs(stat.change))}
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-4 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${AGGREGATED_BAR_COLORS[stat.category]}`}
                    style={{ width: `${(stat.minutes / maxAggMinutes) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Week Comparison Summary */}
      {(showDetailed ? stats.length : aggregatedStats.length) > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <h4 className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">Compared to Last Week</h4>
          <div className="space-y-1">
            {(showDetailed ? stats : aggregatedStats)
              .filter((s) => s.change !== 0)
              .slice(0, 5)
              .map((stat) => (
                <p key={stat.category} className="text-sm text-zinc-700 dark:text-zinc-300">
                  {stat.change > 0 ? (
                    <span className="text-green-600 dark:text-green-400">+{formatDuration(stat.change)}</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">{formatDuration(Math.abs(stat.change))}</span>
                  )}
                  {' '}
                  {stat.change > 0 ? 'more' : 'less'} {'label' in stat ? stat.label.toLowerCase() : CATEGORY_LABELS[stat.category as TimeCategory].toLowerCase()}
                </p>
              ))}
            {(showDetailed ? stats : aggregatedStats).filter((s) => s.change !== 0).length === 0 && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No comparison data available.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
