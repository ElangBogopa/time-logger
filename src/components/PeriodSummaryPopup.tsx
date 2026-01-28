'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { TimePeriod, PERIOD_LABELS, TimeEntry, CATEGORY_LABELS, TimeCategory, PERIOD_TIME_RANGES } from '@/lib/types'
import { Sun, Cloud, Moon, Sparkles, ArrowRight, X, TrendingUp, Zap, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PreviousPeriodStats {
  totalMinutes: number
  productiveMinutes: number
  entryCount: number
}

interface PeriodSummaryPopupProps {
  isOpen: boolean
  onClose: () => void
  period: TimePeriod
  entries: TimeEntry[]
  commentary: string | null
  insight: string | null
  prediction: string | null
  isLoading: boolean
  isEvening: boolean
  onViewDayReview?: () => void
  previousPeriodStats?: PreviousPeriodStats
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

// Confetti particle for celebration
function ConfettiParticle({ index, total }: { index: number; total: number }) {
  const angle = (index / total) * 360
  const distance = 60 + Math.random() * 40
  const size = 4 + Math.random() * 4
  const duration = 0.8 + Math.random() * 0.4
  const delay = Math.random() * 0.2
  const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']
  const color = colors[index % colors.length]
  const isRound = index % 3 === 0

  return (
    <div
      className="absolute"
      style={{
        width: isRound ? size : size * 0.6,
        height: isRound ? size : size * 1.5,
        backgroundColor: color,
        borderRadius: isRound ? '50%' : '2px',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        animation: `confetti-burst ${duration}s ease-out ${delay}s forwards`,
        ['--confetti-x' as string]: `${Math.cos((angle * Math.PI) / 180) * distance}px`,
        ['--confetti-y' as string]: `${Math.sin((angle * Math.PI) / 180) * distance - 20}px`,
        ['--confetti-rotate' as string]: `${Math.random() * 360}deg`,
        opacity: 0,
      }}
    />
  )
}

export default function PeriodSummaryPopup({
  isOpen,
  onClose,
  period,
  entries,
  commentary,
  insight,
  prediction,
  isLoading,
  isEvening,
  onViewDayReview,
  previousPeriodStats,
}: PeriodSummaryPopupProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const shareCardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true))
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- animation state driven by prop changes
      setIsVisible(false)
      setIsLeaving(false)
    }
  }, [isOpen])

  const handleClose = () => {
    setIsLeaving(true)
    setTimeout(onClose, 300)
  }

  const handleShare = async () => {
    try {
      // Dynamically import html2canvas
      const html2canvas = (await import('html2canvas')).default

      // Prepare data for ShareableSessionCard
      const topCategories = sortedCategories.slice(0, 3).map(([cat, mins]) => ({
        category: cat as TimeCategory,
        minutes: mins,
      }))

      // Create the shareable card component
      const { default: ShareableSessionCard } = await import('./ShareableSessionCard')
      const { createRoot } = await import('react-dom/client')

      // Create a temporary container
      const container = document.createElement('div')
      container.style.position = 'fixed'
      container.style.left = '-9999px'
      container.style.top = '-9999px'
      document.body.appendChild(container)

      // Render the card and wait for element
      const root = createRoot(container)
      let cardElement: HTMLDivElement | null = null

      const elementPromise = new Promise<HTMLDivElement>((resolve) => {
        root.render(
          <ShareableSessionCard
            ref={(el) => {
              if (el) {
                cardElement = el
                resolve(el)
              }
            }}
            period={period}
            date={new Date().toISOString().split('T')[0]}
            sessionScore={sessionScore}
            totalMinutes={totalMinutes}
            topCategories={topCategories}
            commentary={commentary || `Great ${PERIOD_LABELS[period].toLowerCase()} session!`}
          />
        )
      })

      await elementPromise

      // Wait for rendering
      await new Promise((resolve) => setTimeout(resolve, 100))

      if (!cardElement) {
        throw new Error('Failed to render card')
      }

      // Capture the card
      const canvas = await html2canvas(cardElement, {
        backgroundColor: null,
        scale: 2,
        logging: false,
      })

      // Clean up
      root.unmount()
      document.body.removeChild(container)

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b)
          else reject(new Error('Failed to create blob'))
        }, 'image/png')
      })

      // Try Web Share API first
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], 'session-card.png', { type: 'image/png' })
        const shareData = {
          files: [file],
          title: `${PERIOD_LABELS[period]} Session`,
          text: `My ${PERIOD_LABELS[period].toLowerCase()} session - Score: ${sessionScore}/100`,
        }

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData)
          return
        }
      }

      // Fallback to download
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `session-${period}-${Date.now()}.png`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Share failed:', error)
    }
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

  // Calculate session score (0-100)
  const sessionScore = useMemo(() => {
    if (periodEntries.length === 0) return 0

    const totalMinutes = periodEntries.reduce((sum, e) => sum + e.duration_minutes, 0)
    const productiveMinutes = periodEntries
      .filter(e => ['deep_work', 'learning', 'exercise', 'creating'].includes(e.category || ''))
      .reduce((sum, e) => sum + e.duration_minutes, 0)

    // Base score on productive ratio (50 points max)
    const productiveRatio = totalMinutes > 0 ? productiveMinutes / totalMinutes : 0
    const productiveScore = productiveRatio * 50

    // Engagement score based on entry count (30 points max)
    const engagementScore = Math.min(30, periodEntries.length * 6)

    // Bonus for hitting target categories (20 points max)
    const targetScore = 20

    // Calculate total and cap at 100
    const score = Math.min(100, Math.round(productiveScore + engagementScore + targetScore))

    return score
  }, [periodEntries])

  // Show confetti for high scores
  useEffect(() => {
    if (isOpen && sessionScore > 80) {
      setShowConfetti(true)
      const timer = setTimeout(() => setShowConfetti(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, sessionScore])

  // Find session MVP (activity with most time)
  const sessionMVP = useMemo(() => {
    if (periodEntries.length === 0) return null

    const sorted = [...periodEntries].sort((a, b) => b.duration_minutes - a.duration_minutes)
    return sorted[0]
  }, [periodEntries])

  // Calculate comparison with previous period
  const comparison = useMemo(() => {
    if (!previousPeriodStats) return null

    const currentTotal = periodEntries.reduce((sum, e) => sum + e.duration_minutes, 0)
    const currentProductive = periodEntries
      .filter(e => ['deep_work', 'learning', 'exercise', 'creating'].includes(e.category || ''))
      .reduce((sum, e) => sum + e.duration_minutes, 0)

    const diffMinutes = currentProductive - previousPeriodStats.productiveMinutes
    if (Math.abs(diffMinutes) < 15) return null // Too small to mention

    const isPositive = diffMinutes > 0
    const hours = Math.floor(Math.abs(diffMinutes) / 60)
    const minutes = Math.abs(diffMinutes) % 60
    const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`

    return {
      isPositive,
      text: `${isPositive ? '+' : '-'}${timeStr} productive time`,
    }
  }, [periodEntries, previousPeriodStats])

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
    <>
      {/* Confetti animation styles */}
      {showConfetti && (
        <style jsx global>{`
          @keyframes confetti-burst {
            0% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(0) rotate(0deg);
            }
            50% {
              opacity: 1;
            }
            100% {
              opacity: 0;
              transform: translate(
                calc(-50% + var(--confetti-x)),
                calc(-50% + var(--confetti-y))
              ) scale(1) rotate(var(--confetti-rotate));
            }
          }
          @keyframes glow-pulse {
            0%, 100% {
              opacity: 0.3;
              transform: scale(1);
            }
            50% {
              opacity: 0.6;
              transform: scale(1.1);
            }
          }
        `}</style>
      )}

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
              {/* Confetti particles for celebration */}
              {showConfetti && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <ConfettiParticle key={i} index={i} total={30} />
                  ))}
                </div>
              )}

              {/* Header buttons */}
              <div className="absolute right-4 top-4 flex items-center gap-2">
                <button
                  onClick={handleShare}
                  className="rounded-full p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                  title="Share session"
                >
                  <Share2 className="h-5 w-5" />
                </button>
                <button
                  onClick={handleClose}
                  className="rounded-full p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

            {/* Header with Session Score */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 ${colors.border} border`}>
                <Icon className={`h-6 w-6 ${colors.icon}`} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white">{periodLabel} Complete</h2>
                <p className="text-sm text-zinc-400">
                  {periodEntries.length} {periodEntries.length === 1 ? 'activity' : 'activities'} logged
                </p>
              </div>
              {/* Session Score */}
              <div className="relative">
                {sessionScore > 80 && (
                  <div
                    className={`absolute inset-0 rounded-full bg-gradient-to-br ${colors.gradient} blur-lg`}
                    style={{ animation: 'glow-pulse 2s ease-in-out infinite' }}
                  />
                )}
                <div className={`relative flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800 ${colors.border} border-2`}>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${sessionScore >= 80 ? 'text-green-400' : sessionScore >= 60 ? 'text-blue-400' : 'text-zinc-400'}`}>
                      {sessionScore}
                    </div>
                    <div className="text-[10px] text-zinc-500">score</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Comparison line */}
            {comparison && (
              <div className="mb-4 flex items-center gap-2 text-sm">
                <TrendingUp className={`h-4 w-4 ${comparison.isPositive ? 'text-green-400' : 'text-red-400'}`} />
                <span className={comparison.isPositive ? 'text-green-400' : 'text-red-400'}>
                  vs last {periodLabel.toLowerCase()}: {comparison.text}
                </span>
              </div>
            )}

            {/* Time summary with MVP */}
            <div className="mb-4 rounded-xl bg-zinc-800/50 p-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">
                  {hours > 0 && `${hours}h `}{minutes}m
                </p>
                <p className="text-sm text-zinc-400">total time tracked</p>
              </div>

              {/* Session MVP */}
              {sessionMVP && (
                <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-zinc-700/30 px-3 py-2">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <div className="flex-1 text-center">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Session MVP</p>
                    <p className="text-sm font-medium text-white truncate">{sessionMVP.activity}</p>
                    <p className="text-xs text-zinc-400">
                      {Math.floor(sessionMVP.duration_minutes / 60) > 0
                        ? `${Math.floor(sessionMVP.duration_minutes / 60)}h `
                        : ''}
                      {sessionMVP.duration_minutes % 60}m
                    </p>
                  </div>
                </div>
              )}

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
            <div className="mb-5 rounded-xl bg-zinc-800/30 p-4 space-y-3">
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

              {/* Data-driven insight */}
              {insight && !isLoading && (
                <div className="flex items-start gap-2 pt-2 border-t border-zinc-700/50">
                  <TrendingUp className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-400 font-medium">{insight}</p>
                </div>
              )}

              {/* Forward-looking prediction */}
              {prediction && !isLoading && (
                <div className="flex items-start gap-2 pt-2 border-t border-zinc-700/50">
                  <ArrowRight className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-purple-400 font-medium">{prediction}</p>
                </div>
              )}
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

      {/* Hidden ShareableSessionCard for capture - will be added later */}
      <div ref={shareCardRef} className="fixed -left-[9999px] -top-[9999px]" />
    </div>
    </>
  )
}
