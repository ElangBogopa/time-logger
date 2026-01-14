'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { IntentionType, INTENTION_LABELS } from '@/lib/types'
import IntentionCard from './IntentionCard'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { ArrowRight, ArrowLeft, Loader2, Sparkles, Check, User } from 'lucide-react'

interface SelectedIntention {
  type: IntentionType
  customText?: string
  weeklyTargetMinutes?: number | null
}

interface OnboardingModalProps {
  isOpen: boolean
  onComplete: () => void
}

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

// Suggested weekly targets in hours for each intention type
const SUGGESTED_TARGETS: Partial<Record<IntentionType, { min: number; max: number; default: number }>> = {
  deep_work: { min: 5, max: 40, default: 15 },
  exercise: { min: 1, max: 15, default: 5 },
  learning: { min: 1, max: 20, default: 5 },
  relationships: { min: 2, max: 20, default: 7 },
  self_care: { min: 2, max: 15, default: 5 },
}

export default function OnboardingModal({ isOpen, onComplete }: OnboardingModalProps) {
  const { data: session } = useSession()
  const [step, setStep] = useState(0) // Start at step 0 (name)
  const [preferredName, setPreferredName] = useState('')
  const [selectedIntentions, setSelectedIntentions] = useState<SelectedIntention[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-fill preferred name from session
  useEffect(() => {
    if (session?.user) {
      const name = session.user.preferredName || session.user.name || ''
      setPreferredName(name)
    }
  }, [session])

  const toggleIntention = (type: IntentionType) => {
    setSelectedIntentions((prev) => {
      const exists = prev.find((i) => i.type === type)
      if (exists) {
        return prev.filter((i) => i.type !== type)
      }
      if (prev.length >= 3) {
        return prev // Max 3 intentions
      }
      return [...prev, { type, customText: '', weeklyTargetMinutes: null }]
    })
  }

  const updateCustomText = (text: string) => {
    setSelectedIntentions((prev) =>
      prev.map((i) => (i.type === 'custom' ? { ...i, customText: text } : i))
    )
  }

  const updateTarget = (type: IntentionType, hours: number | null) => {
    setSelectedIntentions((prev) =>
      prev.map((i) =>
        i.type === type
          ? { ...i, weeklyTargetMinutes: hours ? hours * 60 : null }
          : i
      )
    )
  }

  const handleNext = async () => {
    setError(null)

    if (step === 0) {
      // Save preferred name
      if (!preferredName.trim()) {
        setError('Please enter your name')
        return
      }

      setIsSubmitting(true)
      try {
        const response = await fetch('/api/user', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferredName: preferredName.trim() }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to save name')
        }

        setStep(1)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    if (step === 1) {
      if (selectedIntentions.length === 0) {
        setError('Please select at least one intention')
        return
      }
      // Check if custom intention has text
      const customIntention = selectedIntentions.find((i) => i.type === 'custom')
      if (customIntention && !customIntention.customText?.trim()) {
        setError('Please describe your custom goal')
        return
      }
      setStep(2)
    } else if (step === 2) {
      setStep(3)
    }
  }

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1)
      setError(null)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/intentions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentions: selectedIntentions.map((intention, index) => ({
            intention_type: intention.type,
            custom_text: intention.type === 'custom' ? intention.customText : null,
            weekly_target_minutes: intention.weeklyTargetMinutes,
            priority: index + 1,
          })),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save intentions')
      }

      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get intentions that have suggested targets
  const intentionsWithTargets = selectedIntentions.filter(
    (i) => SUGGESTED_TARGETS[i.type]
  )

  // Total steps: 0 (name) + 1 (intentions) + 2 (targets) + 3 (confirm) = 4 steps
  const totalSteps = 4

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <VisuallyHidden>
          <DialogTitle>Set up your account</DialogTitle>
        </VisuallyHidden>

        {/* Progress indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {[0, 1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 w-12 rounded-full transition-colors ${
                s <= step ? 'bg-primary' : 'bg-zinc-200 dark:bg-zinc-700'
              }`}
            />
          ))}
        </div>

        {/* Step 0: Preferred Name */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <User className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Welcome to Time Logger!
              </h2>
              <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                What should we call you?
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredName">Your first name</Label>
              <Input
                id="preferredName"
                type="text"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder="e.g., Alex"
                autoFocus
                className="text-lg"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                We&apos;ll use this in your personalized greetings and weekly reviews.
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Select intentions */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                What do you want to change?
              </h2>
              <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                Pick 1-3 intentions to focus on. We&apos;ll help you track progress.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {INTENTION_TYPES.map((type) => (
                <IntentionCard
                  key={type}
                  type={type}
                  selected={selectedIntentions.some((i) => i.type === type)}
                  onSelect={() => toggleIntention(type)}
                  disabled={
                    selectedIntentions.length >= 3 &&
                    !selectedIntentions.some((i) => i.type === type)
                  }
                  customText={
                    selectedIntentions.find((i) => i.type === type)?.customText
                  }
                  onCustomTextChange={updateCustomText}
                />
              ))}
            </div>

            {selectedIntentions.length === 3 && (
              <p className="text-center text-sm text-zinc-500">
                Maximum 3 intentions selected
              </p>
            )}
          </div>
        )}

        {/* Step 2: Set targets (optional) */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Set weekly targets
              </h2>
              <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                Optional: How much time feels right per week?
              </p>
            </div>

            {intentionsWithTargets.length > 0 ? (
              <div className="space-y-6">
                {intentionsWithTargets.map((intention) => {
                  const config = SUGGESTED_TARGETS[intention.type]!
                  const currentHours = intention.weeklyTargetMinutes
                    ? intention.weeklyTargetMinutes / 60
                    : config.default

                  return (
                    <div
                      key={intention.type}
                      className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {INTENTION_LABELS[intention.type]}
                        </h3>
                        <span className="text-lg font-bold text-primary">
                          {intention.weeklyTargetMinutes
                            ? `${currentHours}h/week`
                            : 'No target'}
                        </span>
                      </div>

                      <Slider
                        value={[intention.weeklyTargetMinutes ? currentHours : 0]}
                        onValueChange={([value]) =>
                          updateTarget(intention.type, value || null)
                        }
                        min={0}
                        max={config.max}
                        step={1}
                        className="mb-2"
                      />

                      <div className="flex justify-between text-xs text-zinc-500">
                        <span>Skip</span>
                        <span>{config.max}h</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-800/50">
                <p className="text-zinc-500 dark:text-zinc-400">
                  Your selected intentions don&apos;t have suggested time targets.
                  <br />
                  We&apos;ll track your progress based on your logged activities.
                </p>
              </div>
            )}

            <p className="text-center text-sm text-zinc-500">
              You can always adjust these later in settings.
            </p>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <Sparkles className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                You&apos;re all set, {preferredName}!
              </h2>
              <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                We&apos;ll help you track progress toward:
              </p>
            </div>

            <div className="space-y-3">
              {selectedIntentions.map((intention, index) => (
                <div
                  key={intention.type}
                  className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {intention.type === 'custom'
                        ? intention.customText
                        : INTENTION_LABELS[intention.type]}
                    </p>
                    {intention.weeklyTargetMinutes && (
                      <p className="text-sm text-zinc-500">
                        Target: {intention.weeklyTargetMinutes / 60}h per week
                      </p>
                    )}
                  </div>
                  <Check className="h-5 w-5 text-green-500" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="mt-4 text-center text-sm text-red-500">{error}</p>
        )}

        {/* Navigation buttons */}
        <div className="mt-6 flex gap-3">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
              className="flex-1"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}

          {step < 3 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={isSubmitting || (step === 0 && !preferredName.trim()) || (step === 1 && selectedIntentions.length === 0)}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Start logging
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
