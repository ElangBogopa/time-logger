'use client'

import { useState, useEffect, useRef } from 'react'
import { useFocusSession } from '@/hooks/useFocusSession'
import { CATEGORY_LABELS, TimeCategory } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Target,
  Play,
  Square,
  X,
  Check,
  Pencil,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react'

const FOCUS_COLOR = '#6B8CAE'
const FOCUS_COLOR_LIGHT = '#8BACC8'

const DURATION_PRESETS = [
  { label: '25m', minutes: 25, sublabel: 'Pomodoro' },
  { label: '45m', minutes: 45, sublabel: 'Deep work' },
  { label: '60m', minutes: 60, sublabel: '1 hour' },
  { label: '90m', minutes: 90, sublabel: 'Flow state' },
]

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// Progress ring component
function ProgressRing({
  progress,
  size = 180,
  strokeWidth = 6,
  color = FOCUS_COLOR,
}: {
  progress: number
  size?: number
  strokeWidth?: number
  color?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-zinc-300 dark:text-zinc-800"
      />
      {/* Progress ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-1000 ease-linear"
      />
    </svg>
  )
}

// Confetti particle
function Confetti() {
  const [particles, setParticles] = useState<Array<{
    id: number
    x: number
    delay: number
    color: string
    size: number
  }>>([])

  useEffect(() => {
    const colors = ['#6B8CAE', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6']
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 6 + 4,
    }))
    setParticles(newParticles)
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti"
          style={{
            left: `${p.x}%`,
            top: '-10px',
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

export default function FocusSession() {
  const {
    state,
    sessionData,
    remainingSeconds,
    totalSeconds,
    elapsedSeconds,
    progress,
    completedData,
    isSaving,
    saved,
    startSession,
    endEarly,
    cancelSession,
    saveEntry,
    reset,
  } = useFocusSession()

  const [customMinutes, setCustomMinutes] = useState('')
  const [activityLabel, setActivityLabel] = useState('Focus Session')
  const [showCustom, setShowCustom] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showEditBeforeSave, setShowEditBeforeSave] = useState(false)
  const [editActivity, setEditActivity] = useState('')
  const [editCategory, setEditCategory] = useState('deep_work')
  const [showConfetti, setShowConfetti] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const autoSavedRef = useRef(false)

  // Auto-save on completion
  useEffect(() => {
    if (state === 'completed' && completedData && !autoSavedRef.current) {
      autoSavedRef.current = true
      setShowConfetti(true)
      saveEntry().catch(() => {
        setSaveError('Failed to save — you can retry or edit before saving.')
        autoSavedRef.current = false
      })
      const timer = setTimeout(() => setShowConfetti(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [state, completedData, saveEntry])

  // Reset auto-save ref when going back to idle
  useEffect(() => {
    if (state === 'idle') {
      autoSavedRef.current = false
      setSaveError(null)
    }
  }, [state])

  const handleStart = (minutes: number) => {
    startSession(minutes, activityLabel.trim() || 'Focus Session')
    setShowCustom(false)
    setCustomMinutes('')
  }

  const handleCustomStart = () => {
    const mins = parseInt(customMinutes, 10)
    if (mins > 0 && mins <= 480) {
      handleStart(mins)
    }
  }

  const handleEndEarly = () => {
    endEarly()
  }

  const handleCancel = () => {
    cancelSession()
    setShowCancelConfirm(false)
  }

  const handleEditAndSave = async () => {
    try {
      await saveEntry({
        activity: editActivity,
        category: editCategory,
      })
      setShowEditBeforeSave(false)
    } catch {
      setSaveError('Failed to save entry.')
    }
  }

  const handleDone = () => {
    reset()
    setActivityLabel('Focus Session')
  }

  // === IDLE STATE ===
  if (state === 'idle') {
    return (
      <div className="rounded-xl border border-[#6B8CAE]/30 bg-gradient-to-br from-[#6B8CAE]/5 to-[#6B8CAE]/10 dark:from-[#6B8CAE]/10 dark:to-[#6B8CAE]/5 p-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6B8CAE]/20">
              <Target className="h-5 w-5 text-[#6B8CAE]" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm text-foreground">Start Focus Session</p>
              <p className="text-xs text-muted-foreground">
                Timer + auto-log deep work
              </p>
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="mt-4 space-y-3">
            {/* Activity label input */}
            <Input
              value={activityLabel}
              onChange={(e) => setActivityLabel(e.target.value)}
              placeholder="What are you focusing on?"
              className="bg-background/50 text-sm"
            />

            {/* Duration presets */}
            <div className="grid grid-cols-4 gap-2">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.minutes}
                  onClick={() => handleStart(preset.minutes)}
                  className="flex flex-col items-center rounded-lg border border-[#6B8CAE]/20 bg-background/50 px-2 py-2.5 hover:border-[#6B8CAE]/50 hover:bg-[#6B8CAE]/10 transition-all"
                >
                  <span className="text-sm font-semibold text-foreground">{preset.label}</span>
                  <span className="text-[10px] text-muted-foreground">{preset.sublabel}</span>
                </button>
              ))}
            </div>

            {/* Custom duration */}
            {!showCustom ? (
              <button
                onClick={() => setShowCustom(true)}
                className="w-full text-center text-xs text-[#6B8CAE] hover:text-[#8BACC8] transition-colors"
              >
                Custom duration...
              </button>
            ) : (
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  placeholder="Minutes"
                  min="1"
                  max="480"
                  className="bg-background/50 text-sm flex-1"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomStart()}
                />
                <Button
                  size="sm"
                  onClick={handleCustomStart}
                  disabled={!customMinutes || parseInt(customMinutes, 10) <= 0}
                  className="bg-[#6B8CAE] hover:bg-[#5A7B9D] text-white"
                >
                  <Play className="h-3 w-3" />
                  Start
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // === ACTIVE STATE ===
  if (state === 'active') {
    return (
      <div className="rounded-xl border border-[#6B8CAE]/30 bg-gradient-to-br from-[#6B8CAE]/5 to-[#6B8CAE]/10 dark:from-[#6B8CAE]/10 dark:to-[#6B8CAE]/5 p-6">
        {/* Timer display */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <ProgressRing progress={progress} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-mono font-bold text-foreground tracking-tight">
                {formatCountdown(remainingSeconds)}
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                {formatMinutes(Math.floor(elapsedSeconds / 60))} / {formatMinutes(Math.floor(totalSeconds / 60))}
              </span>
            </div>
          </div>

          {/* Activity label */}
          <div className="mt-4 text-center">
            <p className="text-sm font-medium text-foreground flex items-center gap-1.5 justify-center">
              <Target className="h-3.5 w-3.5 text-[#6B8CAE]" />
              {sessionData?.activity || 'Focus Session'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEndEarly}
              className="text-[#6B8CAE] border-[#6B8CAE]/30 hover:bg-[#6B8CAE]/10"
            >
              <Square className="h-3 w-3" />
              End Early
            </Button>
            {showCancelConfirm ? (
              <div className="flex gap-1.5">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCancel}
                >
                  Discard
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCancelConfirm(false)}
                >
                  Keep going
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCancelConfirm(true)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // === COMPLETED STATE ===
  if (state === 'completed' && completedData) {
    return (
      <>
        {showConfetti && <Confetti />}
        <div className="rounded-xl border border-green-500/30 bg-gradient-to-br from-green-500/5 to-green-500/10 dark:from-green-500/10 dark:to-green-500/5 p-6">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 mb-3">
              <Sparkles className="h-6 w-6 text-green-500" />
            </div>

            <h3 className="text-lg font-bold text-foreground">
              Focus session complete!
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {formatMinutes(completedData.actualElapsedMinutes)} of deep focus logged
            </p>

            {saved && !saveError && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-green-500">
                <Check className="h-3 w-3" />
                <span>Entry saved</span>
              </div>
            )}

            {saveError && (
              <p className="mt-2 text-xs text-amber-400">{saveError}</p>
            )}

            {/* Edit before re-saving */}
            {showEditBeforeSave ? (
              <div className="w-full mt-4 space-y-3 text-left">
                <div>
                  <label className="text-xs text-muted-foreground">Activity</label>
                  <Input
                    value={editActivity}
                    onChange={(e) => setEditActivity(e.target.value)}
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEditBeforeSave(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleEditAndSave}
                    disabled={isSaving}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isSaving ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditActivity(completedData.activity)
                    setEditCategory(completedData.category)
                    setShowEditBeforeSave(true)
                  }}
                >
                  <Pencil className="h-3 w-3" />
                  Edit entry
                </Button>
                <Button
                  size="sm"
                  onClick={handleDone}
                  className="bg-[#6B8CAE] hover:bg-[#5A7B9D] text-white"
                >
                  Done
                </Button>
              </div>
            )}
          </div>
        </div>
      </>
    )
  }

  return null
}
