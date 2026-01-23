'use client'

import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import {
  MoodLevel,
  TimePeriod,
  SESSION_MOOD_CONFIG,
  MOOD_EMOJIS,
  MOOD_COLORS,
  getMoodMessage,
} from '@/lib/types'

interface MoodCheckInProps {
  period: TimePeriod
  onMoodSelected?: (mood: MoodLevel) => void
  className?: string
}

export default function MoodCheckIn({ period, onMoodSelected, className = '' }: MoodCheckInProps) {
  const [selectedMood, setSelectedMood] = useState<MoodLevel | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasCheckedIn, setHasCheckedIn] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [motivationalMessage, setMotivationalMessage] = useState<string>('')

  const config = SESSION_MOOD_CONFIG[period]

  // Fetch this session's mood check-in on mount
  useEffect(() => {
    const controller = new AbortController()

    async function fetchSessionMood() {
      try {
        const response = await fetch(`/api/mood?period=${period}`, {
          signal: controller.signal,
        })
        if (response.ok) {
          const { checkin } = await response.json()
          if (checkin) {
            setSelectedMood(checkin.mood)
            setHasCheckedIn(true)
            // Set a motivational message for the existing mood
            setMotivationalMessage(getMoodMessage(period, checkin.mood))
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        console.error('Failed to fetch mood:', error)
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    fetchSessionMood()
    return () => controller.abort()
  }, [period])

  const handleMoodSelect = async (mood: MoodLevel) => {
    if (isSaving) return

    setIsSaving(true)
    setSelectedMood(mood)

    try {
      const response = await fetch('/api/mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood, period }),
      })

      if (response.ok) {
        setHasCheckedIn(true)
        setJustSaved(true)
        setIsEditing(false)
        // Generate a new motivational message
        setMotivationalMessage(getMoodMessage(period, mood))
        onMoodSelected?.(mood)
        // Clear the "just saved" animation after a moment
        setTimeout(() => setJustSaved(false), 1500)
      } else {
        // Revert on error
        setSelectedMood(hasCheckedIn ? selectedMood : null)
      }
    } catch (error) {
      console.error('Failed to save mood:', error)
      setSelectedMood(hasCheckedIn ? selectedMood : null)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTapToChange = () => {
    setIsEditing(true)
  }

  // Show loading skeleton
  if (isLoading) {
    return (
      <div className={`rounded-xl border border-zinc-200 dark:border-zinc-700 bg-card p-4 ${className}`}>
        <div className="h-14 animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
      </div>
    )
  }

  const moods: MoodLevel[] = ['low', 'okay', 'great']

  // Collapsed state: show motivational message after check-in
  if (hasCheckedIn && selectedMood && !isEditing) {
    const label = config.labels[selectedMood]
    const emoji = MOOD_EMOJIS[selectedMood]
    const color = MOOD_COLORS[selectedMood]

    return (
      <div
        className={`rounded-xl border border-zinc-200 dark:border-zinc-700 bg-card p-4 transition-all duration-300 ${justSaved ? 'border-green-300 dark:border-green-700' : ''} ${className}`}
      >
        {/* Header with emoji and label */}
        <div className="flex items-center gap-3 mb-3">
          <span className={`text-2xl ${justSaved ? 'animate-in zoom-in-50 duration-300' : ''}`} role="img" aria-label={label}>
            {emoji}
          </span>
          <div className="flex-1">
            <span className={`font-medium ${color}`}>{label}</span>
            {justSaved && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 animate-in fade-in slide-in-from-left-2 duration-200">
                <Check className="h-3 w-3" />
              </span>
            )}
          </div>
        </div>

        {/* Motivational message */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {motivationalMessage}
        </p>

        {/* Tap to change link */}
        <button
          onClick={handleTapToChange}
          className="mt-3 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors"
        >
          Tap to change
        </button>
      </div>
    )
  }

  // Expanded state: show mood picker
  return (
    <div className={`rounded-xl border border-zinc-200 dark:border-zinc-700 bg-card p-4 transition-all duration-300 ${className}`}>
      <p className="text-sm text-muted-foreground mb-3">
        {config.prompt}
      </p>

      <div className="flex gap-2">
        {moods.map((mood) => {
          const isSelected = selectedMood === mood
          const label = config.labels[mood]
          const emoji = MOOD_EMOJIS[mood]
          const color = MOOD_COLORS[mood]

          return (
            <button
              key={mood}
              onClick={() => handleMoodSelect(mood)}
              disabled={isSaving}
              className={`
                flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-lg
                transition-all duration-200 border-2
                ${isSelected
                  ? 'border-primary bg-primary/5 scale-105'
                  : 'border-transparent bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }
                ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              aria-label={label}
              aria-pressed={isSelected}
            >
              <span className="text-2xl" role="img" aria-hidden="true">
                {emoji}
              </span>
              <span className={`text-xs font-medium ${isSelected ? color : 'text-muted-foreground'}`}>
                {label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Cancel button when editing */}
      {isEditing && (
        <button
          onClick={() => setIsEditing(false)}
          className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  )
}
