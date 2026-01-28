'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  WeeklyTargetType,
  WEEKLY_TARGET_CONFIGS,
  WEEKLY_TARGET_TYPES,
  MAX_WEEKLY_TARGETS,
  formatTargetValue,
} from '@/lib/types'
import { createWeeklyTargets, csrfFetch } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { ArrowRight, ArrowLeft, Loader2, Sparkles, Check, User } from 'lucide-react'

interface SelectedTarget {
  type: WeeklyTargetType
  minutes: number
}

interface OnboardingModalProps {
  isOpen: boolean
  onComplete: () => void
}

export default function OnboardingModal({ isOpen, onComplete }: OnboardingModalProps) {
  const { data: session } = useSession()
  const [step, setStep] = useState(0)
  const [preferredName, setPreferredName] = useState('')
  const [selectedTargets, setSelectedTargets] = useState<SelectedTarget[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session?.user) {
      const name = session.user.preferredName || session.user.name || ''
      setPreferredName(name)
    }
  }, [session])

  const toggleTarget = (type: WeeklyTargetType) => {
    setSelectedTargets(prev => {
      const exists = prev.find(t => t.type === type)
      if (exists) {
        return prev.filter(t => t.type !== type)
      }
      if (prev.length >= MAX_WEEKLY_TARGETS) {
        return prev
      }
      const config = WEEKLY_TARGET_CONFIGS[type]
      return [...prev, { type, minutes: config.defaultMinutes }]
    })
  }

  const updateMinutes = (type: WeeklyTargetType, minutes: number) => {
    setSelectedTargets(prev =>
      prev.map(t => (t.type === type ? { ...t, minutes } : t))
    )
  }

  const handleNext = async () => {
    setError(null)

    if (step === 0) {
      if (!preferredName.trim()) {
        setError('Please enter your name')
        return
      }
      setIsSubmitting(true)
      try {
        const response = await csrfFetch('/api/user', {
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
      if (selectedTargets.length === 0) {
        setError('Please select at least one target')
        return
      }
      setStep(2)
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
      await createWeeklyTargets(
        selectedTargets.map(t => ({
          target_type: t.type,
          weekly_target_minutes: t.minutes,
        }))
      )
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

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
          <DialogDescription>
            Welcome to Time Logger! Complete the setup process by entering your name and choosing weekly targets to track your productivity goals.
          </DialogDescription>
        </VisuallyHidden>

        {/* Progress indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {[0, 1, 2].map(s => (
            <div
              key={s}
              className={`h-2 w-16 rounded-full transition-colors ${
                s <= step ? 'bg-primary' : 'bg-zinc-200 dark:bg-zinc-700'
              }`}
            />
          ))}
        </div>

        {/* Step 0: Name */}
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
                onChange={e => setPreferredName(e.target.value)}
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

        {/* Step 1: Select targets */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Set your weekly targets
              </h2>
              <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                Pick up to {MAX_WEEKLY_TARGETS} targets to track. Each is backed by research.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {WEEKLY_TARGET_TYPES.map(type => {
                const config = WEEKLY_TARGET_CONFIGS[type]
                const isSelected = selectedTargets.some(t => t.type === type)
                const isDisabled = !isSelected && selectedTargets.length >= MAX_WEEKLY_TARGETS

                return (
                  <button
                    key={type}
                    onClick={() => toggleTarget(type)}
                    disabled={isDisabled}
                    className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 dark:bg-primary/10'
                        : isDisabled
                          ? 'border-zinc-100 dark:border-zinc-800 opacity-40 cursor-not-allowed'
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }`}
                  >
                    {/* Selection check */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{config.icon}</span>
                      <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        {config.label}
                      </span>
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

            {selectedTargets.length >= MAX_WEEKLY_TARGETS && (
              <p className="text-center text-sm text-zinc-500">
                Maximum {MAX_WEEKLY_TARGETS} targets selected
              </p>
            )}
          </div>
        )}

        {/* Step 2: Set values + confirm */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <Sparkles className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Tune your targets, {preferredName}
              </h2>
              <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                Adjust the weekly amount for each target. Defaults are research-backed.
              </p>
            </div>

            <div className="space-y-5">
              {selectedTargets.map(target => {
                const config = WEEKLY_TARGET_CONFIGS[target.type]
                const isHours = config.unit === 'hours'
                const sliderMin = isHours ? Math.floor(config.minMinutes / 60) : config.minMinutes
                const sliderMax = isHours ? Math.floor(config.maxMinutes / 60) : config.maxMinutes
                const sliderValue = isHours ? Math.round(target.minutes / 60) : target.minutes
                const sliderStep = isHours ? 1 : 15

                return (
                  <div
                    key={target.type}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{config.icon}</span>
                        <span className="font-semibold text-sm">{config.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          config.direction === 'at_least'
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          {config.direction === 'at_least' ? 'At least' : 'At most'}
                        </span>
                      </div>
                      <span className="text-lg font-bold text-primary">
                        {formatTargetValue(target.minutes, config.unit)}/wk
                      </span>
                    </div>

                    <Slider
                      value={[sliderValue]}
                      onValueChange={([val]) => {
                        const mins = isHours ? val * 60 : val
                        updateMinutes(target.type, mins)
                      }}
                      min={sliderMin}
                      max={sliderMax}
                      step={sliderStep}
                      className="mb-2"
                    />

                    <div className="flex justify-between text-[10px] text-zinc-400">
                      <span>{formatTargetValue(config.minMinutes, config.unit)}</span>
                      <span>{formatTargetValue(config.maxMinutes, config.unit)}</span>
                    </div>

                    <p className="mt-2 text-[10px] text-zinc-400 italic">
                      {config.researchNote}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="mt-4 text-center text-sm text-red-500">{error}</p>
        )}

        {/* Navigation */}
        <div className="mt-6 space-y-3">
          <div className="flex gap-3">
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

            {step < 2 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={
                  isSubmitting ||
                  (step === 0 && !preferredName.trim()) ||
                  (step === 1 && selectedTargets.length === 0)
                }
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

          {/* Skip option - only on step 0 */}
          {step === 0 && (
            <button
              type="button"
              onClick={() => {
                // Set a flag to remind later
                localStorage.setItem('onboarding-skipped', 'true')
                onComplete()
              }}
              className="w-full text-center text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              disabled={isSubmitting}
            >
              Skip for now
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
