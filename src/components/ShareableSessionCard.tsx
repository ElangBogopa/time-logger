'use client'

import { forwardRef } from 'react'
import { TimePeriod, PERIOD_LABELS, CATEGORY_LABELS, TimeCategory } from '@/lib/types'
import { Sun, Cloud, Moon } from 'lucide-react'

const PERIOD_ICONS: Record<TimePeriod, typeof Sun> = {
  morning: Sun,
  afternoon: Cloud,
  evening: Moon,
}

const PERIOD_GRADIENTS: Record<TimePeriod, string> = {
  morning: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  afternoon: 'linear-gradient(145deg, #0f3460 0%, #16213e 50%, #1a1a2e 100%)',
  evening: 'linear-gradient(145deg, #16213e 0%, #1a1a2e 50%, #0f0f12 100%)',
}

interface CategoryStat {
  category: TimeCategory
  minutes: number
}

export interface ShareableSessionCardProps {
  period: TimePeriod
  date: string // YYYY-MM-DD or formatted date string
  sessionScore: number
  totalMinutes: number
  topCategories: CategoryStat[]
  commentary: string
}

/**
 * A shareable session card designed for Instagram story dimensions (9:16 ratio).
 * Renders as a React component that can be screenshotted or captured with html2canvas.
 */
const ShareableSessionCard = forwardRef<HTMLDivElement, ShareableSessionCardProps>(
  ({ period, date, sessionScore, totalMinutes, topCategories, commentary }, ref) => {
    const Icon = PERIOD_ICONS[period]
    const periodLabel = PERIOD_LABELS[period]
    const gradient = PERIOD_GRADIENTS[period]

    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    const scoreColor =
      sessionScore >= 80 ? '#22c55e' : sessionScore >= 60 ? '#3b82f6' : '#71717a'

    // Format date
    const formattedDate = (() => {
      try {
        const d = new Date(date + 'T00:00:00')
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      } catch {
        return date
      }
    })()

    return (
      <div
        ref={ref}
        className="relative overflow-hidden"
        style={{
          width: '360px',
          height: '640px',
          background: gradient,
          borderRadius: '24px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Content */}
        <div className="relative flex h-full flex-col px-7 py-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 border border-white/20">
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">
                {periodLabel} Session
              </p>
              <p className="text-sm font-semibold text-white">{formattedDate}</p>
            </div>
          </div>

          {/* Session Score Ring */}
          <div className="mt-6 flex items-center gap-6">
            <div className="relative flex-shrink-0">
              <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(sessionScore / 100) * 251.3} 251.3`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold" style={{ color: scoreColor }}>
                  {sessionScore}
                </span>
              </div>
            </div>

            <div>
              <p className="text-sm text-zinc-400">Session Score</p>
              <p className="text-2xl font-bold text-white">
                {hours > 0 && `${hours}h `}
                {minutes}m
              </p>
              <p className="text-xs text-zinc-500">tracked</p>
            </div>
          </div>

          {/* Top Categories */}
          {topCategories.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-zinc-500">
                Top Categories
              </p>
              <div className="space-y-3">
                {topCategories.slice(0, 3).map((stat, i) => {
                  const catMinutes = stat.minutes
                  const catHours = Math.floor(catMinutes / 60)
                  const catMins = catMinutes % 60
                  const maxMinutes = topCategories[0]?.minutes || 1
                  const barWidth = Math.max(8, (catMinutes / maxMinutes) * 100)

                  return (
                    <div key={stat.category} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-zinc-400 w-4 text-right">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-white">
                            {CATEGORY_LABELS[stat.category]}
                          </span>
                          <span className="text-sm text-zinc-400">
                            {catHours > 0 ? `${catHours}h ` : ''}
                            {catMins}m
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: scoreColor,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* AI Commentary Quote */}
          <div className="mt-6 rounded-xl bg-white/[0.04] p-4">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-zinc-500 mb-2">
              AI Coach
            </p>
            <p className="text-sm text-zinc-300 leading-relaxed italic">
              &ldquo;{commentary || `Great ${periodLabel.toLowerCase()} session!`}&rdquo;
            </p>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Branding */}
          <div className="flex items-center justify-center gap-2 pt-4">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <p className="text-[10px] font-medium tracking-wider text-zinc-600">
              Tracked with Better
            </p>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>
        </div>
      </div>
    )
  }
)

ShareableSessionCard.displayName = 'ShareableSessionCard'

export default ShareableSessionCard
