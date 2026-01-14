'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  IntentionType,
  UserIntention,
  INTENTION_LABELS,
  INTENTION_DESCRIPTIONS,
  ReminderTime,
  DEFAULT_REMINDER_TIMES,
} from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import IntentionCard from '@/components/IntentionCard'
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
  Bell,
} from 'lucide-react'

const INTENTION_TYPES: IntentionType[] = [
  'deep_work',
  'less_distraction',
  'work_life_balance',
  'exercise',
  'self_care',
  'relationships',
  'learning',
  'custom',
]

const SUGGESTED_TARGETS: Partial<Record<IntentionType, { min: number; max: number; default: number }>> = {
  deep_work: { min: 5, max: 40, default: 15 },
  exercise: { min: 1, max: 15, default: 5 },
  learning: { min: 1, max: 20, default: 5 },
  relationships: { min: 2, max: 20, default: 7 },
  self_care: { min: 2, max: 15, default: 5 },
}

export default function IntentionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [intentions, setIntentions] = useState<UserIntention[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedType, setSelectedType] = useState<IntentionType | null>(null)
  const [customText, setCustomText] = useState('')
  const [weeklyTarget, setWeeklyTarget] = useState<number | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Reminder settings state
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderTimes, setReminderTimes] = useState<ReminderTime[]>(DEFAULT_REMINDER_TIMES)
  const [isSavingReminders, setIsSavingReminders] = useState(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // Fetch intentions
  const fetchIntentions = useCallback(async () => {
    try {
      const response = await fetch('/api/intentions')
      if (response.ok) {
        const data = await response.json()
        setIntentions(data.intentions || [])
      }
    } catch (error) {
      console.error('Failed to fetch intentions:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch preferences
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
      fetchIntentions()
      fetchPreferences()
    }
  }, [status, fetchIntentions, fetchPreferences])

  // Update reminder enabled
  const handleReminderToggle = async (enabled: boolean) => {
    setReminderEnabled(enabled)
    setIsSavingReminders(true)

    try {
      await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminder_enabled: enabled }),
      })
    } catch (error) {
      console.error('Failed to update reminder setting:', error)
      setReminderEnabled(!enabled) // Revert on error
    } finally {
      setIsSavingReminders(false)
    }
  }

  // Update reminder time
  const handleReminderTimeChange = async (id: string, time: string) => {
    const newTimes = reminderTimes.map((rt) =>
      rt.id === id ? { ...rt, time } : rt
    )
    setReminderTimes(newTimes)

    // Debounced save
    try {
      await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminder_times: newTimes }),
      })
    } catch (error) {
      console.error('Failed to update reminder time:', error)
    }
  }

  // Toggle individual reminder
  const handleReminderItemToggle = async (id: string, enabled: boolean) => {
    const newTimes = reminderTimes.map((rt) =>
      rt.id === id ? { ...rt, enabled } : rt
    )
    setReminderTimes(newTimes)

    try {
      await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminder_times: newTimes }),
      })
    } catch (error) {
      console.error('Failed to update reminder:', error)
    }
  }

  // Add new intention
  const handleAddIntention = async () => {
    if (!selectedType) return

    if (selectedType === 'custom' && !customText.trim()) {
      return
    }

    setIsSaving(true)

    try {
      // Get all current intentions plus the new one
      const newIntentions = [
        ...intentions.map((i, idx) => ({
          intention_type: i.intention_type,
          custom_text: i.custom_text,
          weekly_target_minutes: i.weekly_target_minutes,
          priority: idx + 1,
        })),
        {
          intention_type: selectedType,
          custom_text: selectedType === 'custom' ? customText : null,
          weekly_target_minutes: weeklyTarget ? weeklyTarget * 60 : null,
          priority: intentions.length + 1,
        },
      ]

      const response = await fetch('/api/intentions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentions: newIntentions }),
      })

      if (response.ok) {
        await fetchIntentions()
        setShowAddModal(false)
        setSelectedType(null)
        setCustomText('')
        setWeeklyTarget(null)
      }
    } catch (error) {
      console.error('Failed to add intention:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Remove intention
  const handleRemoveIntention = async (id: string) => {
    setIsSaving(true)

    try {
      const response = await fetch(`/api/intentions/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchIntentions()
      }
    } catch (error) {
      console.error('Failed to remove intention:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Update intention target
  const handleUpdateTarget = async (id: string, minutes: number | null) => {
    try {
      const response = await fetch(`/api/intentions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekly_target_minutes: minutes }),
      })

      if (response.ok) {
        setIntentions((prev) =>
          prev.map((i) =>
            i.id === id ? { ...i, weekly_target_minutes: minutes } : i
          )
        )
      }
    } catch (error) {
      console.error('Failed to update target:', error)
    }
  }

  // Get available intention types (not already selected)
  const availableTypes = INTENTION_TYPES.filter(
    (type) => !intentions.some((i) => i.intention_type === type)
  )

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="mb-4 flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">My Intentions</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                What you want to focus on
              </p>
            </div>
          </div>
        </header>

        {/* Intentions list */}
        <div className="space-y-4">
          {intentions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-800/50">
              <Target className="mx-auto mb-3 h-12 w-12 text-zinc-400" />
              <h3 className="font-semibold text-zinc-700 dark:text-zinc-300">
                No intentions set
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                Add intentions to track your progress toward your goals.
              </p>
            </div>
          ) : (
            intentions.map((intention, index) => {
              const config = SUGGESTED_TARGETS[intention.intention_type]
              const currentHours = intention.weekly_target_minutes
                ? intention.weekly_target_minutes / 60
                : null

              return (
                <div
                  key={intention.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {intention.intention_type === 'custom'
                            ? intention.custom_text
                            : INTENTION_LABELS[intention.intention_type]}
                        </h3>
                        {intention.intention_type !== 'custom' && (
                          <p className="text-sm text-zinc-500">
                            {INTENTION_DESCRIPTIONS[intention.intention_type]}
                          </p>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRemoveIntention(intention.id)}
                      disabled={isSaving}
                      className="text-zinc-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Weekly target slider */}
                  {config && (
                    <div className="mt-4 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/50">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Weekly target</span>
                        <span className="font-medium text-primary">
                          {currentHours ? `${currentHours}h/week` : 'No target'}
                        </span>
                      </div>
                      <Slider
                        value={[currentHours || 0]}
                        onValueChange={([value]) => {
                          handleUpdateTarget(
                            intention.id,
                            value ? value * 60 : null
                          )
                        }}
                        min={0}
                        max={config.max}
                        step={1}
                      />
                      <div className="mt-1 flex justify-between text-xs text-zinc-400">
                        <span>Skip</span>
                        <span>{config.max}h</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Add button */}
        {intentions.length < 3 && availableTypes.length > 0 && (
          <Button
            onClick={() => setShowAddModal(true)}
            className="mt-6 w-full"
            variant="outline"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add intention ({3 - intentions.length} remaining)
          </Button>
        )}

        {intentions.length >= 3 && (
          <p className="mt-4 text-center text-sm text-zinc-500">
            Maximum 3 intentions. Remove one to add another.
          </p>
        )}

        {/* Reminder Settings Section */}
        <div className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-700">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <Bell className="h-5 w-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground">Logging Reminders</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Get reminded to log your time
              </p>
            </div>
            <Switch
              checked={reminderEnabled}
              onCheckedChange={handleReminderToggle}
              disabled={isSavingReminders}
            />
          </div>

          {reminderEnabled && (
            <div className="space-y-3">
              {reminderTimes.map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <Switch
                    checked={reminder.enabled}
                    onCheckedChange={(checked) => handleReminderItemToggle(reminder.id, checked)}
                    className="shrink-0"
                  />
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${reminder.enabled ? 'text-foreground' : 'text-zinc-400'}`}>
                      {reminder.label}
                    </p>
                  </div>
                  <Input
                    type="time"
                    value={reminder.time}
                    onChange={(e) => handleReminderTimeChange(reminder.id, e.target.value)}
                    disabled={!reminder.enabled}
                    className="w-28 text-center"
                  />
                </div>
              ))}
              <p className="text-xs text-zinc-500 text-center mt-4">
                Push notifications coming soon with mobile app
              </p>
            </div>
          )}
        </div>

        {/* Add intention modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add intention</DialogTitle>
              <DialogDescription>
                Choose what you want to focus on
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid gap-3">
              {availableTypes.map((type) => (
                <IntentionCard
                  key={type}
                  type={type}
                  selected={selectedType === type}
                  onSelect={() => {
                    setSelectedType(type)
                    const config = SUGGESTED_TARGETS[type]
                    if (config) {
                      setWeeklyTarget(config.default)
                    } else {
                      setWeeklyTarget(null)
                    }
                  }}
                  customText={customText}
                  onCustomTextChange={setCustomText}
                />
              ))}
            </div>

            {/* Target slider for selected type */}
            {selectedType && SUGGESTED_TARGETS[selectedType] && (
              <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-medium">Weekly target</span>
                  <span className="text-lg font-bold text-primary">
                    {weeklyTarget ? `${weeklyTarget}h/week` : 'No target'}
                  </span>
                </div>
                <Slider
                  value={[weeklyTarget || 0]}
                  onValueChange={([value]) => setWeeklyTarget(value || null)}
                  min={0}
                  max={SUGGESTED_TARGETS[selectedType]!.max}
                  step={1}
                />
                <div className="mt-1 flex justify-between text-xs text-zinc-400">
                  <span>Skip</span>
                  <span>{SUGGESTED_TARGETS[selectedType]!.max}h</span>
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddModal(false)
                  setSelectedType(null)
                  setCustomText('')
                  setWeeklyTarget(null)
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddIntention}
                disabled={
                  !selectedType ||
                  (selectedType === 'custom' && !customText.trim()) ||
                  isSaving
                }
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
