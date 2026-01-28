'use client'

import { csrfFetch } from '@/lib/api'

import { useState, useEffect } from 'react'
import { Check, Sun, Target } from 'lucide-react'
import { getUserToday } from '@/lib/types'

type SleepQuality = 'poor' | 'okay' | 'good'
type EnergyLevel = 'low' | 'medium' | 'high'

interface MorningCheckinProps {
  className?: string
}

const SLEEP_OPTIONS: { value: SleepQuality; emoji: string; label: string }[] = [
  { value: 'poor', emoji: '😴', label: 'Rough' },
  { value: 'okay', emoji: '😐', label: 'Okay' },
  { value: 'good', emoji: '😊', label: 'Great' },
]

const ENERGY_OPTIONS: { value: EnergyLevel; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'text-orange-500' },
  { value: 'medium', label: 'Medium', color: 'text-amber-500' },
  { value: 'high', label: 'High', color: 'text-green-500' },
]

const LOCALSTORAGE_KEY = 'morning-checkin'

function getLocalCheckin(date: string) {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(LOCALSTORAGE_KEY)
    if (!stored) return null
    const data = JSON.parse(stored)
    if (data.date === date) return data
    return null
  } catch {
    return null
  }
}

function saveLocalCheckin(data: {
  sleep_quality: SleepQuality
  energy_level: EnergyLevel
  priority_text: string | null
  date: string
}) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(data))
  } catch {
    // localStorage not available
  }
}

export default function MorningCheckin({ className = '' }: MorningCheckinProps) {
  const [sleepQuality, setSleepQuality] = useState<SleepQuality | null>(null)
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel | null>(null)
  const [priorityText, setPriorityText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasCompleted, setHasCompleted] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [isMorning, setIsMorning] = useState(false)

  const today = getUserToday()

  // Check if it's morning (before noon) - client-side only
  useEffect(() => {
    const hour = new Date().getHours()
    setIsMorning(hour < 12)
  }, [])

  // Fetch existing check-in on mount
  useEffect(() => {
    const controller = new AbortController()

    async function fetchCheckin() {
      // First check localStorage
      const local = getLocalCheckin(today)
      if (local) {
        setSleepQuality(local.sleep_quality)
        setEnergyLevel(local.energy_level)
        setPriorityText(local.priority_text || '')
        setHasCompleted(true)
        setIsLoading(false)
        return
      }

      // Then try API
      try {
        const response = await fetch(`/api/morning-checkin?date=${today}`, {
          signal: controller.signal,
        })
        if (response.ok) {
          const { checkin } = await response.json()
          if (checkin) {
            setSleepQuality(checkin.sleep_quality)
            setEnergyLevel(checkin.energy_level)
            setPriorityText(checkin.priority_text || '')
            setHasCompleted(true)
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        console.error('Failed to fetch morning check-in:', error)
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    fetchCheckin()
    return () => controller.abort()
  }, [today])

  const handleSubmit = async () => {
    if (!sleepQuality || !energyLevel || isSaving) return

    setIsSaving(true)

    const checkinData = {
      sleep_quality: sleepQuality,
      energy_level: energyLevel,
      priority_text: priorityText.trim() || null,
      date: today,
    }

    try {
      const response = await csrfFetch('/api/morning-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkinData),
      })

      if (response.ok) {
        const { storage } = await response.json()
        // If API signals localStorage fallback, save there
        if (storage === 'localStorage') {
          saveLocalCheckin(checkinData)
        }
      } else {
        // API failed — fallback to localStorage
        saveLocalCheckin(checkinData)
      }
    } catch {
      // Network error — fallback to localStorage
      saveLocalCheckin(checkinData)
    }

    setHasCompleted(true)
    setJustSaved(true)
    setIsSaving(false)
    setTimeout(() => setJustSaved(false), 2000)
  }

  // Don't show: loading, not morning, or already completed
  if (isLoading) {
    return (
      <div className={`rounded-xl border border-zinc-200 dark:border-zinc-700 bg-card p-4 ${className}`}>
        <div className="h-14 animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
      </div>
    )
  }

  // Don't render if not morning
  if (!isMorning && !hasCompleted) return null

  // Completed badge (compact)
  if (hasCompleted) {
    const sleepLabel = SLEEP_OPTIONS.find(o => o.value === sleepQuality)?.emoji || ''
    const energyLabel = ENERGY_OPTIONS.find(o => o.value === energyLevel)?.label || ''

    return (
      <div className={`rounded-xl border border-zinc-200 dark:border-zinc-700 bg-card p-3 transition-all duration-300 ${justSaved ? 'border-green-300 dark:border-green-700' : ''} ${className}`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
            <Check className="h-4 w-4" />
            <span className="text-sm font-medium">Morning check-in done</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
            <span>{sleepLabel} Sleep</span>
            <span className="text-zinc-300 dark:text-zinc-600">·</span>
            <span>{energyLabel} energy</span>
            {priorityText && (
              <>
                <span className="text-zinc-300 dark:text-zinc-600">·</span>
                <span className="truncate max-w-[120px]">🎯 {priorityText}</span>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Don't show the form if it's not morning
  if (!isMorning) return null

  const canSubmit = sleepQuality !== null && energyLevel !== null

  return (
    <div className={`rounded-xl border border-zinc-200 dark:border-zinc-700 bg-card p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Sun className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-foreground">Morning Check-in</h3>
      </div>

      {/* Question 1: Sleep Quality */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2">How did you sleep?</p>
        <div className="flex gap-2">
          {SLEEP_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSleepQuality(option.value)}
              className={`
                flex-1 flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg
                transition-all duration-200 border-2
                ${sleepQuality === option.value
                  ? 'border-primary bg-primary/5 scale-105'
                  : 'border-transparent bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }
              `}
            >
              <span className="text-xl">{option.emoji}</span>
              <span className={`text-xs font-medium ${sleepQuality === option.value ? 'text-primary' : 'text-muted-foreground'}`}>
                {option.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Question 2: Energy Level */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2">Energy level?</p>
        <div className="flex gap-2">
          {ENERGY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setEnergyLevel(option.value)}
              className={`
                flex-1 py-2 px-3 rounded-lg text-sm font-medium
                transition-all duration-200 border-2
                ${energyLevel === option.value
                  ? 'border-primary bg-primary/5 scale-105'
                  : 'border-transparent bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }
                ${energyLevel === option.value ? option.color : 'text-muted-foreground'}
              `}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Question 3: Priority (optional) */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
          <Target className="h-3 w-3" />
          Today&apos;s #1 priority?
          <span className="text-zinc-400 dark:text-zinc-600">(optional)</span>
        </p>
        <input
          type="text"
          value={priorityText}
          onChange={(e) => setPriorityText(e.target.value)}
          placeholder="e.g., Ship the landing page"
          maxLength={100}
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit || isSaving}
        className={`
          w-full py-2.5 rounded-lg text-sm font-medium transition-all duration-200
          ${canSubmit
            ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
          }
          ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {isSaving ? 'Saving...' : 'Done ✓'}
      </button>
    </div>
  )
}
