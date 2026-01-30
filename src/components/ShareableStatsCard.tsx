'use client'

import { forwardRef } from 'react'

// The 6 muted aggregated category colors
const CATEGORY_COLORS: Record<string, string> = {
  focus: '#6B8CAE',
  ops: '#8B8680',
  body: '#7D9B8A',
  recovery: '#B5A07A',
  connection: '#A0848E',
  escape: '#7A7D82',
}

interface CategoryStat {
  name: string
  key: string
  hours: number
}

interface RingProgress {
  label: string
  percentage: number
  color: string
}

export interface ShareableStatsCardProps {
  weekDateRange: string // e.g., "Jan 20 - 26, 2025"
  avgDayScore: number
  totalHours: number
  topCategories: CategoryStat[]
  streakDays: number | null
  rings: RingProgress[]
}

/**
 * A shareable stats card designed for Instagram story dimensions (9:16 ratio).
 * Renders as a React component that can be screenshotted or captured with html2canvas.
 */
const ShareableStatsCard = forwardRef<HTMLDivElement, ShareableStatsCardProps>(
  ({ weekDateRange, avgDayScore, totalHours, topCategories, streakDays, rings }, ref) => {
    const scoreColor =
      avgDayScore >= 70 ? '#4ade80' : avgDayScore >= 40 ? '#fbbf24' : '#f87171'

    return (
      <div
        ref={ref}
        className="relative overflow-hidden"
        style={{
          width: '360px',
          height: '640px',
          background: 'linear-gradient(145deg, #18181b 0%, #0f0f12 50%, #1a1a2e 100%)',
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
          <div className="mb-1">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
              Weekly Recap
            </p>
            <p className="mt-1 text-lg font-semibold text-white">
              {weekDateRange}
            </p>
          </div>

          {/* Score Hero */}
          <div className="mt-6 flex items-center gap-6">
            {/* Score Ring */}
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
                  strokeDasharray={`${(avgDayScore / 100) * 251.3} 251.3`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="text-3xl font-bold"
                  style={{ color: scoreColor }}
                >
                  {avgDayScore}
                </span>
              </div>
            </div>

            <div>
              <p className="text-sm text-zinc-400">Avg Day Score</p>
              <p className="text-2xl font-bold text-white">
                {totalHours.toFixed(1)}h
              </p>
              <p className="text-xs text-zinc-500">total tracked</p>
            </div>
          </div>

          {/* Streak */}
          {streakDays !== null && streakDays > 0 && (
            <div className="mt-5 flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-4 py-3">
              <span className="text-xl">🔥</span>
              <div>
                <p className="text-sm font-semibold text-white">
                  {streakDays} day streak
                </p>
                <p className="text-xs text-zinc-500">Keep it going!</p>
              </div>
            </div>
          )}

          {/* Top Categories */}
          <div className="mt-6">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-zinc-500">
              Top Categories
            </p>
            <div className="space-y-3">
              {topCategories.slice(0, 3).map((cat, i) => {
                const color = CATEGORY_COLORS[cat.key] || '#71717a'
                const maxHours = topCategories[0]?.hours || 1
                const barWidth = Math.max(8, (cat.hours / maxHours) * 100)

                return (
                  <div key={cat.key} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-zinc-400 w-4 text-right">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">
                          {cat.name}
                        </span>
                        <span className="text-sm text-zinc-400">
                          {cat.hours.toFixed(1)}h
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${barWidth}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Ring Progress */}
          {rings.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-zinc-500">
                Target Rings
              </p>
              <div className="flex flex-wrap gap-4">
                {rings.slice(0, 4).map((ring) => (
                  <div key={ring.label} className="flex items-center gap-2.5">
                    <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth="3"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke={ring.color}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${(Math.min(ring.percentage, 100) / 100) * 88} 88`}
                      />
                    </svg>
                    <div>
                      <p className="text-xs font-medium text-white">
                        {Math.round(ring.percentage)}%
                      </p>
                      <p className="text-[10px] text-zinc-500">{ring.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

ShareableStatsCard.displayName = 'ShareableStatsCard'

export default ShareableStatsCard
