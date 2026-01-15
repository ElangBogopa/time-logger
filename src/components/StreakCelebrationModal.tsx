'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import { Button } from '@/components/ui/button'
import { StreakConfig, StreakType } from '@/lib/types'
import { Flame, Trophy, Sparkles } from 'lucide-react'

type CelebrationType = 'milestone' | 'personal_best'

interface StreakCelebrationModalProps {
  type: CelebrationType
  streakType: StreakType
  config: StreakConfig
  days: number
  previousBest?: number
  onClose: () => void
}

export default function StreakCelebrationModal({
  type,
  config,
  days,
  previousBest,
  onClose,
}: StreakCelebrationModalProps) {
  const [showContent, setShowContent] = useState(false)

  // Animate in
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const isMilestone = type === 'milestone'
  const isPB = type === 'personal_best'

  // Milestone messages
  const getMilestoneMessage = (days: number): string => {
    if (days >= 365) return "A full year! You're unstoppable!"
    if (days >= 100) return "Triple digits! Legendary commitment!"
    if (days >= 60) return "Two months strong! Amazing discipline!"
    if (days >= 30) return "One month! A habit is forming!"
    if (days >= 14) return "Two weeks! You're building momentum!"
    if (days >= 7) return "One week down! Keep it going!"
    return "Great start!"
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md border-0 bg-transparent shadow-none">
        <VisuallyHidden.Root>
          <DialogTitle>
            {isPB ? 'New Personal Best' : 'Milestone Reached'}
          </DialogTitle>
        </VisuallyHidden.Root>
        <div
          className={`relative overflow-hidden rounded-2xl p-8 text-center transition-all duration-500 ${
            showContent ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          } ${
            isPB
              ? 'bg-gradient-to-br from-amber-500 via-orange-400 to-rose-400'
              : 'bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600'
          }`}
        >
          {/* Decorative circles */}
          <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-white/10" />

          {/* Icon */}
          <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 transition-transform duration-700 ${showContent ? 'scale-100' : 'scale-0'}`}>
            {isPB ? (
              <Trophy className="h-10 w-10 text-white" />
            ) : (
              <Sparkles className="h-10 w-10 text-white" />
            )}
          </div>

          {/* Title */}
          <h2 className="mb-2 text-2xl font-bold text-white">
            {isPB ? 'New Personal Best!' : 'Milestone Reached!'}
          </h2>

          {/* Streak display */}
          <div className="mb-4 flex items-center justify-center gap-2">
            <Flame className="h-8 w-8 text-white" />
            <span className="text-5xl font-bold text-white">{days}</span>
            <span className="text-xl text-white/80">days</span>
          </div>

          {/* Streak type badge */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2">
            <span className="text-lg">{config.emoji}</span>
            <span className="font-medium text-white">{config.label}</span>
          </div>

          {/* Message */}
          <p className="mb-6 text-white/90">
            {isPB && previousBest ? (
              <>You beat your previous record of {previousBest} days!</>
            ) : (
              getMilestoneMessage(days)
            )}
          </p>

          {/* Close button */}
          <Button
            onClick={onClose}
            className="bg-white/20 text-white hover:bg-white/30 border-white/30 border"
          >
            Keep Going!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
