'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  IntentionType,
  UserIntention,
  INTENTION_LABELS,
  INTENTION_DESCRIPTIONS,
  INTENTION_CONFIGS,
  formatTarget,
  ReminderTime,
  DEFAULT_REMINDER_TIMES,
  PendingIntentionChange,
  calculateCommitmentDays,
  formatCommitmentStreak,
  getCommitmentMessage,
  getNextMonday,
  isDatePassed,
  getLocalDateString,
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
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  Flame,
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

  // Commitment tracking state
  const [committedSince, setCommittedSince] = useState<string | null>(null)
  const [pendingChanges, setPendingChanges] = useState<PendingIntentionChange[]>([])
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingAction, setPendingAction] = useState<{
    type: 'add' | 'remove'
    intentionId?: string
    intentionType?: IntentionType
    customText?: string
    weeklyTarget?: number | null
  } | null>(null)

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

  // Fetch preferences and handle commitment tracking
  const fetchPreferences = useCallback(async () => {
    try {
      const response = await fetch('/api/preferences')
      if (response.ok) {
        const data = await response.json()
        if (data.preferences) {
          setReminderEnabled(data.preferences.reminder_enabled || false)
          setReminderTimes(data.preferences.reminder_times || DEFAULT_REMINDER_TIMES)
          setCommittedSince(data.preferences.intentions_committed_since || null)

          // Check for pending changes that should be applied
          const pending = data.preferences.pending_intention_changes || []
          const stillPending: PendingIntentionChange[] = []
          let needsRefresh = false

          for (const change of pending) {
            if (isDatePassed(change.effective_date)) {
              // Apply this change
              needsRefresh = true
              if (change.action === 'add') {
                // The intention should already be added when queued
                // Just mark it as active now
              } else if (change.action === 'remove' && change.intention_id) {
                await fetch(`/api/intentions/${change.intention_id}`, {
                  method: 'DELETE',
                })
              }
            } else {
              stillPending.push(change)
            }
          }

          setPendingChanges(stillPending)

          // Update preferences with remaining pending changes
          if (pending.length !== stillPending.length) {
            await fetch('/api/preferences', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pending_intention_changes: stillPending.length > 0 ? stillPending : null,
                intentions_committed_since: stillPending.length === 0 ? getLocalDateString() : data.preferences.intentions_committed_since,
              }),
            })
            if (needsRefresh) {
              // Refresh intentions after applying changes
              const intentionsRes = await fetch('/api/intentions')
              if (intentionsRes.ok) {
                const intentionsData = await intentionsRes.json()
                setIntentions(intentionsData.intentions || [])
              }
            }
          }
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

  // Show confirmation before adding intention
  const handleAddIntention = () => {
    if (!selectedType) return

    if (selectedType === 'custom' && !customText.trim()) {
      return
    }

    // If this is the first intention (no existing ones), add immediately without delay
    if (intentions.length === 0) {
      handleFirstIntentionAdd()
      return
    }

    // Otherwise, show confirmation for the delay
    setPendingAction({
      type: 'add',
      intentionType: selectedType,
      customText: customText,
      weeklyTarget: weeklyTarget,
    })
    setShowConfirmDialog(true)
  }

  // Handle first intention add (no delay needed)
  const handleFirstIntentionAdd = async () => {
    if (!selectedType) return

    setIsSaving(true)

    try {
      const newIntentions = [
        {
          intention_type: selectedType,
          custom_text: selectedType === 'custom' ? customText : null,
          weekly_target_minutes: weeklyTarget ? weeklyTarget * 60 : null,
          priority: 1,
        },
      ]

      const response = await fetch('/api/intentions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentions: newIntentions }),
      })

      if (response.ok) {
        // Set initial commitment date
        const today = getLocalDateString()
        await fetch('/api/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intentions_committed_since: today,
          }),
        })
        setCommittedSince(today)

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

  // Show confirmation before removing intention
  const handleRemoveIntention = (id: string) => {
    setPendingAction({ type: 'remove', intentionId: id })
    setShowConfirmDialog(true)
  }

  // Actually process the confirmed action
  const handleConfirmAction = async () => {
    if (!pendingAction) return

    setIsSaving(true)
    setShowConfirmDialog(false)

    try {
      const nextMonday = getNextMonday()

      if (pendingAction.type === 'remove' && pendingAction.intentionId) {
        // Queue the removal for next Monday
        const newPendingChange: PendingIntentionChange = {
          action: 'remove',
          intention_id: pendingAction.intentionId,
          queued_at: getLocalDateString(),
          effective_date: nextMonday,
        }

        const updatedPending = [...pendingChanges, newPendingChange]
        setPendingChanges(updatedPending)

        // Save to preferences
        await fetch('/api/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pending_intention_changes: updatedPending,
          }),
        })
      } else if (pendingAction.type === 'add' && pendingAction.intentionType) {
        // Add the intention immediately but queue the "active" status
        const newIntentions = [
          ...intentions.map((i, idx) => ({
            intention_type: i.intention_type,
            custom_text: i.custom_text,
            weekly_target_minutes: i.weekly_target_minutes,
            priority: idx + 1,
          })),
          {
            intention_type: pendingAction.intentionType,
            custom_text: pendingAction.intentionType === 'custom' ? pendingAction.customText : null,
            weekly_target_minutes: pendingAction.weeklyTarget ? pendingAction.weeklyTarget * 60 : null,
            priority: intentions.length + 1,
          },
        ]

        const response = await fetch('/api/intentions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intentions: newIntentions }),
        })

        if (response.ok) {
          // Queue the change notification
          const newPendingChange: PendingIntentionChange = {
            action: 'add',
            intention_type: pendingAction.intentionType,
            custom_text: pendingAction.customText,
            queued_at: getLocalDateString(),
            effective_date: nextMonday,
          }

          const updatedPending = [...pendingChanges, newPendingChange]
          setPendingChanges(updatedPending)

          // Reset committed since (streak resets)
          await fetch('/api/preferences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pending_intention_changes: updatedPending,
              intentions_committed_since: nextMonday, // Streak starts fresh on Monday
            }),
          })

          setCommittedSince(nextMonday)
          await fetchIntentions()
          setShowAddModal(false)
          setSelectedType(null)
          setCustomText('')
          setWeeklyTarget(null)
        }
      }
    } catch (error) {
      console.error('Failed to process action:', error)
    } finally {
      setIsSaving(false)
      setPendingAction(null)
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
              <h1 className="text-2xl font-bold text-foreground">My Intentions</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                What you want to focus on
              </p>
            </div>
          </div>

          {/* Commitment Streak */}
          {intentions.length > 0 && committedSince && (
            <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 dark:bg-amber-900/20">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-amber-500" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  {formatCommitmentStreak(calculateCommitmentDays(committedSince))}
                </span>
              </div>
              <p className="mt-1 text-xs text-amber-600/80 dark:text-amber-400/80">
                {getCommitmentMessage(calculateCommitmentDays(committedSince))}
              </p>
            </div>
          )}

          {/* Pending changes notice */}
          {pendingChanges.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800 dark:bg-blue-900/20">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <span className="font-medium">Changes pending:</span> {pendingChanges.length} change{pendingChanges.length > 1 ? 's' : ''} will take effect Monday
              </div>
            </div>
          )}
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
              const config = INTENTION_CONFIGS[intention.intention_type]
              const currentMinutes = intention.weekly_target_minutes || config.defaultTargetMinutes
              const isPendingRemoval = pendingChanges.some(
                p => p.action === 'remove' && p.intention_id === intention.id
              )

              // Convert minutes to display value based on unit
              const displayValue = config.unit === 'hours'
                ? Math.round(currentMinutes / 60)
                : currentMinutes
              const maxValue = config.unit === 'hours'
                ? Math.round(config.maxTargetMinutes / 60)
                : config.maxTargetMinutes
              const minValue = config.unit === 'hours'
                ? Math.round(config.minTargetMinutes / 60)
                : config.minTargetMinutes
              const optimalMin = config.unit === 'hours'
                ? Math.round(config.optimalRangeMin / 60)
                : config.optimalRangeMin
              const optimalMax = config.unit === 'hours'
                ? Math.round(config.optimalRangeMax / 60)
                : config.optimalRangeMax

              return (
                <div
                  key={intention.id}
                  className={`rounded-xl border p-4 ${
                    isPendingRemoval
                      ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20'
                      : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800'
                  }`}
                >
                  {isPendingRemoval && (
                    <div className="mb-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                      <Clock className="h-4 w-4" />
                      Removing Monday
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {intention.intention_type === 'custom'
                              ? intention.custom_text
                              : INTENTION_LABELS[intention.intention_type]}
                          </h3>
                          {config.direction === 'minimize' ? (
                            <TrendingDown className="h-4 w-4 text-amber-500" />
                          ) : (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          )}
                        </div>
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
                      disabled={isSaving || isPendingRemoval}
                      className={isPendingRemoval ? 'text-zinc-300 cursor-not-allowed' : 'text-zinc-400 hover:text-red-500'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Weekly target slider with research-backed ranges */}
                  {intention.intention_type !== 'custom' && (
                    <div className="mt-4 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/50">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-zinc-500">
                          Weekly {config.direction === 'minimize' ? 'limit' : 'target'}
                        </span>
                        <span className="font-medium text-primary">
                          {formatTarget(currentMinutes, config.unit)}
                          {config.direction === 'minimize' ? ' max' : ''}
                        </span>
                      </div>
                      <Slider
                        value={[displayValue]}
                        onValueChange={([value]) => {
                          const minutes = config.unit === 'hours' ? value * 60 : value
                          handleUpdateTarget(intention.id, minutes)
                        }}
                        min={minValue}
                        max={maxValue}
                        step={config.unit === 'hours' ? 1 : 15}
                      />
                      {/* Show optimal range indicator */}
                      <div className="mt-1 flex justify-between text-xs text-zinc-400">
                        <span>{formatTarget(config.minTargetMinutes, config.unit)}</span>
                        <span className="text-green-600 dark:text-green-400">
                          Optimal: {formatTarget(config.optimalRangeMin, config.unit)}-{formatTarget(config.optimalRangeMax, config.unit)}
                        </span>
                        <span>{formatTarget(config.maxTargetMinutes, config.unit)}</span>
                      </div>

                      {/* Research note */}
                      <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 p-2 dark:bg-amber-900/20">
                        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          {config.researchNote}
                        </p>
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
                    const config = INTENTION_CONFIGS[type]
                    // Set default target in hours for consistency with existing state
                    if (type !== 'custom') {
                      setWeeklyTarget(config.defaultTargetMinutes / 60)
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
            {selectedType && selectedType !== 'custom' && (
              <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                {(() => {
                  const config = INTENTION_CONFIGS[selectedType]
                  const currentMinutes = weeklyTarget ? weeklyTarget * 60 : config.defaultTargetMinutes
                  const displayValue = config.unit === 'hours'
                    ? Math.round(currentMinutes / 60)
                    : currentMinutes
                  const maxValue = config.unit === 'hours'
                    ? Math.round(config.maxTargetMinutes / 60)
                    : config.maxTargetMinutes
                  const minValue = config.unit === 'hours'
                    ? Math.round(config.minTargetMinutes / 60)
                    : config.minTargetMinutes

                  return (
                    <>
                      <div className="mb-3 flex items-center justify-between">
                        <span className="font-medium">
                          Weekly {config.direction === 'minimize' ? 'limit' : 'target'}
                        </span>
                        <span className="text-lg font-bold text-primary">
                          {formatTarget(currentMinutes, config.unit)}
                          {config.direction === 'minimize' ? ' max' : ''}
                        </span>
                      </div>
                      <Slider
                        value={[displayValue]}
                        onValueChange={([value]) => {
                          setWeeklyTarget(config.unit === 'hours' ? value : value / 60)
                        }}
                        min={minValue}
                        max={maxValue}
                        step={config.unit === 'hours' ? 1 : 15}
                      />
                      <div className="mt-1 flex justify-between text-xs text-zinc-400">
                        <span>{formatTarget(config.minTargetMinutes, config.unit)}</span>
                        <span className="text-green-600 dark:text-green-400">
                          Optimal: {formatTarget(config.optimalRangeMin, config.unit)}-{formatTarget(config.optimalRangeMax, config.unit)}
                        </span>
                        <span>{formatTarget(config.maxTargetMinutes, config.unit)}</span>
                      </div>

                      {/* Research note */}
                      <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 p-2.5 dark:bg-amber-900/20">
                        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          {config.researchNote}
                        </p>
                      </div>
                    </>
                  )
                })()}
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

        {/* Confirmation Dialog for Changes */}
        <Dialog open={showConfirmDialog} onOpenChange={(open) => {
          if (!open) {
            setShowConfirmDialog(false)
            setPendingAction(null)
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                {pendingAction?.type === 'remove' ? 'Remove Intention?' : 'Add Intention?'}
              </DialogTitle>
              <DialogDescription className="pt-2">
                {committedSince && calculateCommitmentDays(committedSince) > 0 && (
                  <span className="mb-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                    <Flame className="h-4 w-4" />
                    You&apos;ve been committed for {formatCommitmentStreak(calculateCommitmentDays(committedSince))}.
                  </span>
                )}
                <span className="mt-2 block">
                  This change will take effect on <strong>Monday</strong> to protect your weekly review accuracy.
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-zinc-600 dark:text-zinc-400">
                  Effective: {new Date(getNextMonday() + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfirmDialog(false)
                  setPendingAction(null)
                }}
                className="flex-1"
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmAction}
                disabled={isSaving}
                className="flex-1"
                variant={pendingAction?.type === 'remove' ? 'destructive' : 'default'}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Confirm
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
