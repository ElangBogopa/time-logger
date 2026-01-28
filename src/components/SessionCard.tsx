'use client'

import { TimePeriod, SessionState, PERIOD_LABELS } from '@/lib/types'
import { formatSessionDuration, getPeriodStartTime } from '@/lib/session-utils'
import { Sun, Cloud, Moon, CheckCircle2, Clock, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SessionCardProps {
  period: TimePeriod
  state: SessionState
  entryCount: number
  totalMinutes: number
  quote: string
  onLogClick: () => void
  onViewClick?: () => void
}

const PERIOD_ICONS: Record<TimePeriod, typeof Sun> = {
  morning: Sun,
  afternoon: Cloud,
  evening: Moon,
}

const PERIOD_COLORS: Record<TimePeriod, {
  gradient: string
  gradientBg: string
  icon: string
  iconBg: string
  border: string
  text: string
}> = {
  morning: {
    gradient: 'from-amber-500 via-orange-500 to-yellow-500',
    gradientBg: 'from-amber-500/10 to-orange-500/5',
    icon: 'text-amber-500',
    iconBg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
  },
  afternoon: {
    gradient: 'from-blue-500 via-cyan-500 to-teal-500',
    gradientBg: 'from-blue-500/10 to-cyan-500/5',
    icon: 'text-blue-500',
    iconBg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-600 dark:text-blue-400',
  },
  evening: {
    gradient: 'from-indigo-500 via-purple-500 to-pink-500',
    gradientBg: 'from-indigo-500/10 to-purple-500/5',
    icon: 'text-indigo-500',
    iconBg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    text: 'text-indigo-600 dark:text-indigo-400',
  },
}

export default function SessionCard({
  period,
  state,
  entryCount,
  totalMinutes,
  quote,
  onLogClick,
  onViewClick,
}: SessionCardProps) {
  const Icon = PERIOD_ICONS[period]
  const colors = PERIOD_COLORS[period]
  const label = PERIOD_LABELS[period]

  // Upcoming state - grayed out
  if (state === 'upcoming') {
    return (
      <div className="rounded-xl border border-border bg-background/50 p-4 opacity-60">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-secondary`}>
            <Icon className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-zinc-500">{label} Session</h3>
            <p className="text-sm text-zinc-400">Starts at {getPeriodStartTime(period)}</p>
          </div>
          <Clock className="h-5 w-5 text-zinc-400" />
        </div>
      </div>
    )
  }

  // Skipped state - dimmed with label
  if (state === 'skipped') {
    return (
      <div className="rounded-xl border border-border bg-background/50 p-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${colors.iconBg}`}>
            <Icon className={`h-5 w-5 ${colors.icon} opacity-50`} />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-zinc-500">{label} Session</h3>
            <p className="text-sm text-zinc-400">Skipped</p>
          </div>
          <button
            onClick={onLogClick}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Add entries
          </button>
        </div>
      </div>
    )
  }

  // Logged state - shows summary
  if (state === 'logged') {
    return (
      <div
        className={`rounded-xl border ${colors.border} bg-gradient-to-r ${colors.gradientBg} p-4 cursor-pointer hover:shadow-md transition-shadow`}
        onClick={onViewClick || onLogClick}
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${colors.iconBg}`}>
            <Icon className={`h-5 w-5 ${colors.icon}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-foreground">{label} Session</h3>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-sm text-muted-foreground">
              {formatSessionDuration(totalMinutes)} logged
              {entryCount > 0 && ` across ${entryCount} ${entryCount === 1 ? 'activity' : 'activities'}`}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-zinc-400" />
        </div>
      </div>
    )
  }

  // Active state - prominent CTA
  return (
    <div className={`relative overflow-hidden rounded-xl border-2 ${colors.border} bg-gradient-to-r ${colors.gradientBg} p-4`}>
      {/* Gradient accent line at top */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${colors.gradient}`} />

      <div className="flex items-start gap-3 mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${colors.iconBg}`}>
          <Icon className={`h-5 w-5 ${colors.icon}`} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{label} Session</h3>
          {entryCount > 0 ? (
            <p className="text-sm text-muted-foreground">
              {formatSessionDuration(totalMinutes)} logged so far
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ready to log your {label.toLowerCase()}
            </p>
          )}
        </div>
      </div>

      {/* Quote */}
      <p className="text-sm text-muted-foreground italic mb-4 pl-13">
        &ldquo;{quote.split(' — ')[0]}&rdquo;
        {quote.includes(' — ') && (
          <span className="not-italic text-xs block mt-1 text-zinc-400">
            — {quote.split(' — ')[1]}
          </span>
        )}
      </p>

      {/* CTA */}
      <Button
        onClick={onLogClick}
        className={`w-full bg-gradient-to-r ${colors.gradient} text-white hover:opacity-90`}
      >
        <Icon className="h-4 w-4" />
        Log {label} Session
      </Button>
    </div>
  )
}

export { PERIOD_ICONS, PERIOD_COLORS }
