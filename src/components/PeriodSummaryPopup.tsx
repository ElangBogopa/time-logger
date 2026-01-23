'use client'

import { useEffect, useState, useMemo } from 'react'
import { TimePeriod, PERIOD_LABELS, TimeEntry, CATEGORY_LABELS, TimeCategory, PERIOD_TIME_RANGES } from '@/lib/types'
import { Sun, Cloud, Moon, Sparkles, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PeriodSummaryPopupProps {
  isOpen: boolean
  onClose: () => void
  period: TimePeriod
  entries: TimeEntry[]
  commentary: string | null
  isLoading: boolean
  isEvening: boolean
  onViewDayReview?: () => void
}

const PERIOD_ICONS: Record<TimePeriod, typeof Sun> = {
  morning: Sun,
  afternoon: Cloud,
  evening: Moon,
}

const PERIOD_COLORS: Record<TimePeriod, { gradient: string; icon: string; border: string }> = {
  morning: {
    gradient: 'from-amber-500 via-orange-500 to-yellow-500',
    icon: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  afternoon: {
    gradient: 'from-blue-500 via-cyan-500 to-teal-500',
    icon: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  evening: {
    gradient: 'from-indigo-500 via-purple-500 to-pink-500',
    icon: 'text-indigo-400',
    border: 'border-indigo-500/30',
  },
}

export default function PeriodSummaryPopup({
  isOpen,
  onClose,
  period,
  entries,
  commentary,
  isLoading,
  isEvening,
  onViewDayReview,
}: PeriodSummaryPopupProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true))
    } else {
      setIsVisible(false)
      setIsLeaving(false)
    }
  }, [isOpen])

  const handleClose = () => {
    setIsLeaving(true)
    setTimeout(onClose, 300)
  }

  // Filter entries to only include those within this period's time range
  // Must be before early return to maintain hooks order
  const periodEntries = useMemo(() => {
    const range = PERIOD_TIME_RANGES[period]
    return entries.filter(entry => {
      if (!entry.start_time) return false
      const hour = parseInt(entry.start_time.split(':')[0])
      return hour >= range.start && hour < range.end
    })
  }, [entries, period])

  if (!isOpen) return null

  const Icon = PERIOD_ICONS[period]
  const colors = PERIOD_COLORS[period]
  const periodLabel = PERIOD_LABELS[period]

  // Calculate stats from filtered entries
  const totalMinutes = periodEntries.reduce((sum, e) => sum + e.duration_minutes, 0)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  // Group by category
  const categoryBreakdown = periodEntries.reduce((acc, entry) => {
    const cat = entry.category || 'other'
    acc[cat] = (acc[cat] || 0) + entry.duration_minutes
    return acc
  }, {} as Record<string, number>)

  // Sort categories by time
  const sortedCategories = Object.entries(categoryBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3) // Top 3

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible && !isLeaving ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-sm transform transition-all duration-300 ease-out ${
          isVisible && !isLeaving
            ? 'translate-y-0 opacity-100 scale-100'
            : 'translate-y-8 opacity-0 scale-95'
        }`}
      >
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colors.gradient} p-[2px] shadow-2xl`}>
          <div className="relative rounded-2xl bg-zinc-900 p-6">
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute right-4 top-4 rounded-full p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 ${colors.border} border`}>
                <Icon className={`h-6 w-6 ${colors.icon}`} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{periodLabel} Complete</h2>
                <p className="text-sm text-zinc-400">
                  {periodEntries.length} {periodEntries.length === 1 ? 'activity' : 'activities'} logged
                </p>
              </div>
            </div>

            {/* Time summary */}
            <div className="mb-4 rounded-xl bg-zinc-800/50 p-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">
                  {hours > 0 && `${hours}h `}{minutes}m
                </p>
                <p className="text-sm text-zinc-400">total time tracked</p>
              </div>

              {/* Category breakdown */}
              {sortedCategories.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {sortedCategories.map(([cat, mins]) => (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1 rounded-full bg-zinc-700/50 px-2.5 py-1 text-xs text-zinc-300"
                    >
                      {CATEGORY_LABELS[cat as TimeCategory]}
                      <span className="text-zinc-500">
                        {Math.floor(mins / 60) > 0 ? `${Math.floor(mins / 60)}h` : ''}{mins % 60 > 0 ? `${mins % 60}m` : ''}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* AI Commentary */}
            <div className="mb-5 rounded-xl bg-zinc-800/30 p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-zinc-500 mt-0.5 shrink-0" />
                {isLoading ? (
                  <div className="flex-1">
                    <div className="h-4 bg-zinc-700 rounded animate-pulse mb-2 w-full" />
                    <div className="h-4 bg-zinc-700 rounded animate-pulse w-3/4" />
                  </div>
                ) : (
                  <p className="text-sm text-zinc-300 leading-relaxed italic">
                    &ldquo;{commentary || `Great ${periodLabel.toLowerCase()}! You stayed on track.`}&rdquo;
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            {isEvening && onViewDayReview ? (
              <div className="space-y-3">
                <Button
                  onClick={() => {
                    handleClose()
                    setTimeout(onViewDayReview, 300)
                  }}
                  className={`w-full bg-gradient-to-r ${colors.gradient} text-white hover:opacity-90`}
                >
                  <Sparkles className="h-4 w-4" />
                  Your Day in Review is ready
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <button
                  onClick={handleClose}
                  className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Maybe later
                </button>
              </div>
            ) : (
              <Button
                onClick={handleClose}
                variant="outline"
                className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Continue
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
