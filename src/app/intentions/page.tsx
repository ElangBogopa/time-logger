'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  WeeklyTarget,
  WeeklyTargetType,
  WEEKLY_TARGET_CONFIGS,
  WEEKLY_TARGET_TYPES,
  MAX_WEEKLY_TARGETS,
  formatTargetValue,
  calculateTargetProgress,
  ReminderTime,
  DEFAULT_REMINDER_TIMES,
  getLocalDateString,
  getUserToday,
  TimeEntry,
} from '@/lib/types'
import { fetchWeeklyTargets, updateWeeklyTarget, fetchEntries, createWeeklyTargets, deleteWeeklyTarget, csrfFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Check,
  Target,
} from 'lucide-react'

function getWeekStartDate(): string {
  const userToday = getUserToday()
  const todayDate = new Date(userToday + 'T12:00:00')
  const dayOfWeek = todayDate.getDay()
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  todayDate.setDate(todayDate.getDate() - diff)
  return getLocalDateString(todayDate)
}

export default function TargetsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [targets, setTargets] = useState<WeeklyTarget[]>([])
  const [weeklyMinutes, setWeeklyMinutes] = useState<Map<WeeklyTargetType, number>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedType, setSelectedType] = useState<WeeklyTargetType | null>(null)
  const [selectedMinutes, setSelectedMinutes] = useState<number>(0)

  // Reminder settings
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderTimes, setReminderTimes] = useState<ReminderTime[]>(DEFAULT_REMINDER_TIMES)
  const [isSavingReminders, setIsSavingReminders] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const fetchData = useCallback(async () => {
    try {
      const weekStart = getWeekStartDate()
      const today = getLocalDateString()

      const [targetsData, entries] = await Promise.all([
        fetchWeeklyTargets(),
        fetchEntries({ status: 'confirmed', dateFrom: weekStart, dateTo: today }),
      ])

      setTargets(targetsData)

      // Calculate weekly minutes for each target type
      const minutesMap = new Map<WeeklyTargetType, number>()
      for (const target of targetsData) {
        const config = WEEKLY_TARGET_CONFIGS[target.target_type as WeeklyTargetType]
        if (!config) continue
        const total = entries
          .filter((e: TimeEntry) => config.categories.includes(e.category as never))
          .reduce((sum: number, e: TimeEntry) => sum + e.duration_minutes, 0)
        minutesMap.set(target.target_type as WeeklyTargetType, total)
      }
      setWeeklyMinutes(minutesMap)
    } catch (error) {
      console.error('Failed to fetch targets:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchPreferences = useCallback(async () => {
    try {
      const response = await fetch('/api/preferences')
      if (response.ok) {
        const data = await response.json()
        if (data.preferences) {
          setReminderEnabled(data.preferences.reminder_enabled || false)
          setReminderTimes(data.preferences.reminder_times || DEFAULT_REMINDER_TIMES)
        }
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData()
      fetchPreferences()
    }
  }, [status, fetchData, fetchPreferences])

  const handleUpdateTarget = async (id: string, minutes: number) => {
    try {
      const updated = await updateWeeklyTarget(id, { weekly_target_minutes: minutes })
      setTargets(prev => prev.map(t => (t.id === id ? updated : t)))
    } catch (error) {
      console.error('Failed to update target:', error)
    }
  }

  const handleRemoveTarget = async (id: string) => {
    setIsSaving(true)
    try {
      await deleteWeeklyTarget(id)
      setTargets(prev => prev.filter(t => t.id !== id))
    } catch (error) {
      console.error('Failed to remove target:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddTarget = async () => {
    if (!selectedType) return
    setIsSaving(true)

    try {
      // Re-create all targets including the new one
      const existingMapped = targets.map(t => ({
        target_type: t.target_type as WeeklyTargetType,
        weekly_target_minutes: t.weekly_target_minutes,
      }))
      const newTargets = [
        ...existingMapped,
        { target_type: selectedType, weekly_target_minutes: selectedMinutes },
      ]
      const created = await createWeeklyTargets(newTargets)
      setTargets(created)
      setShowAddModal(false)
      setSelectedType(null)
    } catch (error) {
      console.error('Failed to add target:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Reminder handlers
  const handleReminderToggle = async (enabled: boolean) => {
    setReminderEnabled(enabled)
    setIsSavingReminders(true)
    try {
      await csrfFetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminder_enabled: enabled }),
      })
    } catch (error) {
      console.error('Failed to update reminder setting:', error)
      setReminderEnabled(!enabled)
    } finally {
      setIsSavingReminders(false)
    }
  }

  const handleReminderTimeChange = async (id: string, time: string) => {
    const newTimes = reminderTimes.map(rt => (rt.id === id ? { ...rt, time } : rt))
    setReminderTimes(newTimes)
    try {
      await csrfFetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminder_times: newTimes }),
      })
    } catch (error) {
      console.error('Failed to update reminder time:', error)
    }
  }

  const handleReminderItemToggle = async (id: string, enabled: boolean) => {
    const newTimes = reminderTimes.map(rt => (rt.id === id ? { ...rt, enabled } : rt))
    setReminderTimes(newTimes)
    try {
      await csrfFetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminder_times: newTimes }),
      })
    } catch (error) {
      console.error('Failed to update reminder:', error)
    }
  }

  // Available types that aren't already selected
  const availableTypes = WEEKLY_TARGET_TYPES.filter(
    type => !targets.some(t => t.target_type === type)
  )

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Header */}
        <header className="mb-6">
          <button
            onClick={() => router.push('/settings')}
            className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Settings
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Weekly Targets</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Research-backed goals to track each week
              </p>
            </div>
          </div>
        </header>

        {/* Targets list */}
        <div className="space-y-4">
          {targets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-800/50">
              <Target className="mx-auto mb-3 h-12 w-12 text-zinc-400" />
              <h3 className="font-semibold text-zinc-700 dark:text-zinc-300">
                No targets set
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                Add weekly targets to track progress toward your goals.
              </p>
            </div>
          ) : (
            targets.map(target => {
              const config = WEEKLY_TARGET_CONFIGS[target.target_type as WeeklyTargetType]
              if (!config) return null

              const actual = weeklyMinutes.get(target.target_type as WeeklyTargetType) || 0
              const progress = calculateTargetProgress(actual, target.weekly_target_minutes, target.direction as 'at_least' | 'at_most')

              const isHours = config.unit === 'hours'
              const sliderValue = isHours ? Math.round(target.weekly_target_minutes / 60) : target.weekly_target_minutes
              const sliderMin = isHours ? Math.floor(config.minMinutes / 60) : config.minMinutes
              const sliderMax = isHours ? Math.floor(config.maxMinutes / 60) : config.maxMinutes
              const sliderStep = isHours ? 1 : 15

              return (
                <div
                  key={target.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{config.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {config.label}
                          </h3>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            target.direction === 'at_least'
                              ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>
                            {target.direction === 'at_least' ? 'At least' : 'At most'}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-500">{config.description}</p>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRemoveTarget(target.id)}
                      disabled={isSaving}
                      className="text-zinc-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Progress ring inline */}
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, progress)}%`,
                            backgroundColor: config.ringColor,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                      {formatTargetValue(actual, config.unit)} / {formatTargetValue(target.weekly_target_minutes, config.unit)}
                    </span>
                    <span className="text-sm font-bold" style={{ color: config.ringColor }}>
                      {progress}%
                    </span>
                  </div>

                  {/* Slider to adjust target */}
                  <div className="mt-4 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/50">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-zinc-500">
                        Weekly {target.direction === 'at_most' ? 'limit' : 'target'}
                      </span>
                      <span className="font-medium text-primary">
                        {formatTargetValue(target.weekly_target_minutes, config.unit)}
                      </span>
                    </div>
                    <Slider
                      value={[sliderValue]}
                      onValueChange={([val]) => {
                        const mins = isHours ? val * 60 : val
                        handleUpdateTarget(target.id, mins)
                      }}
                      min={sliderMin}
                      max={sliderMax}
                      step={sliderStep}
                    />
                    <div className="mt-1 flex justify-between text-xs text-zinc-400">
                      <span>{formatTargetValue(config.minMinutes, config.unit)}</span>
                      <span>{formatTargetValue(config.maxMinutes, config.unit)}</span>
                    </div>

                    <p className="mt-2 text-[10px] text-zinc-400 italic">
                      {config.researchNote}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Add button */}
        {targets.length < MAX_WEEKLY_TARGETS && availableTypes.length > 0 && (
          <Button
            onClick={() => {
              const firstAvailable = availableTypes[0]
              setSelectedType(firstAvailable)
              setSelectedMinutes(WEEKLY_TARGET_CONFIGS[firstAvailable].defaultMinutes)
              setShowAddModal(true)
            }}
            className="mt-6 w-full"
            variant="outline"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add target ({MAX_WEEKLY_TARGETS - targets.length} remaining)
          </Button>
        )}

        {targets.length >= MAX_WEEKLY_TARGETS && (
          <p className="mt-4 text-center text-sm text-zinc-500">
            Maximum {MAX_WEEKLY_TARGETS} targets. Remove one to add another.
          </p>
        )}

        {/* Add target modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add target</DialogTitle>
              <DialogDescription>
                Choose a weekly target to track
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid gap-3">
              {availableTypes.map(type => {
                const config = WEEKLY_TARGET_CONFIGS[type]
                const isSelected = selectedType === type

                return (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedType(type)
                      setSelectedMinutes(config.defaultMinutes)
                    }}
                    className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 dark:bg-primary/10'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{config.icon}</span>
                      <span className="font-semibold text-sm">{config.label}</span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                      {config.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        config.direction === 'at_least'
                          ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        {config.direction === 'at_least' ? 'At least' : 'At most'}
                      </span>
                      <span className="text-xs text-zinc-400">
                        Default: {formatTargetValue(config.defaultMinutes, config.unit)}/wk
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Slider for selected type */}
            {selectedType && (() => {
              const config = WEEKLY_TARGET_CONFIGS[selectedType]
              const isHours = config.unit === 'hours'
              const sliderVal = isHours ? Math.round(selectedMinutes / 60) : selectedMinutes
              const sliderMin = isHours ? Math.floor(config.minMinutes / 60) : config.minMinutes
              const sliderMax = isHours ? Math.floor(config.maxMinutes / 60) : config.maxMinutes
              const sliderStep = isHours ? 1 : 15

              return (
                <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-medium">
                      Weekly {config.direction === 'at_most' ? 'limit' : 'target'}
                    </span>
                    <span className="text-lg font-bold text-primary">
                      {formatTargetValue(selectedMinutes, config.unit)}
                    </span>
                  </div>
                  <Slider
                    value={[sliderVal]}
                    onValueChange={([val]) => {
                      setSelectedMinutes(isHours ? val * 60 : val)
                    }}
                    min={sliderMin}
                    max={sliderMax}
                    step={sliderStep}
                  />
                  <div className="mt-1 flex justify-between text-xs text-zinc-400">
                    <span>{formatTargetValue(config.minMinutes, config.unit)}</span>
                    <span>{formatTargetValue(config.maxMinutes, config.unit)}</span>
                  </div>
                  <p className="mt-2 text-[10px] text-zinc-400 italic">
                    {config.researchNote}
                  </p>
                </div>
              )
            })()}

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddModal(false)
                  setSelectedType(null)
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddTarget}
                disabled={!selectedType || isSaving}
                className="flex-1"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Add
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
