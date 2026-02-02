'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { csrfFetch } from '@/lib/api'
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
import { ArrowRight, ArrowLeft, Loader2, User, TrendingUp, Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface OnboardingModalProps {
  isOpen: boolean
  onComplete: () => void
}

export default function OnboardingModal({ isOpen, onComplete }: OnboardingModalProps) {
  const { data: session } = useSession()
  const [step, setStep] = useState(0)
  const [preferredName, setPreferredName] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [productivityTarget, setProductivityTarget] = useState(80)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session?.user) {
      const name = session.user.preferredName || session.user.name || ''
      setPreferredName(name)
    }
  }, [session])

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
      if (!selectedPlan) {
        setError('Please select a plan')
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
      // Create the goal
      const goalResponse = await csrfFetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Increase Productivity',
          description: 'Track your daily priorities and build consistent follow-through',
        }),
      })
      if (!goalResponse.ok) {
        const data = await goalResponse.json()
        throw new Error(data.error || 'Failed to create goal')
      }

      // Save productivity target to preferences
      const prefsResponse = await csrfFetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productivity_target: productivityTarget }),
      })
      if (!prefsResponse.ok) {
        const data = await prefsResponse.json()
        throw new Error(data.error || 'Failed to save preferences')
      }

      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <TooltipProvider>
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
              Welcome to Better! Complete the setup process by entering your name and setting your productivity goal.
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
                  Welcome to Better!
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

          {/* Step 1: Pick a Plan */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  Choose your plan
                </h2>
                <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                  What do you want to focus on?
                </p>
              </div>

              <div className="grid gap-3">
                <button
                  onClick={() => setSelectedPlan('increase_productivity')}
                  className={`relative rounded-xl border-2 p-5 text-left transition-all ${
                    selectedPlan === 'increase_productivity'
                      ? 'border-primary bg-primary/5 dark:bg-primary/10'
                      : 'border-border hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  {selectedPlan === 'increase_productivity' && (
                    <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                      <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                      <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">
                      Increase Productivity
                    </span>
                  </div>

                  <p className="text-sm text-zinc-500 dark:text-zinc-400 ml-[52px]">
                    Track your daily priorities and build consistent follow-through
                  </p>
                </button>
              </div>

              <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
                More plans coming soon
              </p>
            </div>
          )}

          {/* Step 2: Set Productivity Target */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  Set your target{preferredName ? `, ${preferredName}` : ''}
                </h2>
                <div className="mt-2 flex items-center justify-center gap-1">
                  <p className="text-zinc-500 dark:text-zinc-400">
                    Your daily productivity goal
                  </p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[280px]">
                      <p className="text-sm">
                        We measure productivity by how well you follow through on your daily plan.
                        Each day, you set 1-3 priority tasks — your score is based on completing them,
                        weighted by priority. Your #1 task is worth the most.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div className="rounded-xl border border-border p-6">
                {/* Target display */}
                <div className="text-center mb-6">
                  <span className="text-6xl font-bold text-primary">
                    {productivityTarget}%
                  </span>
                </div>

                {/* Slider */}
                <Slider
                  value={[productivityTarget]}
                  onValueChange={([val]) => setProductivityTarget(val)}
                  min={50}
                  max={100}
                  step={5}
                  className="mb-3"
                />

                <div className="flex justify-between text-xs text-zinc-400">
                  <span>50%</span>
                  <span>100%</span>
                </div>

                {/* Recommendation */}
                <div className="mt-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
                  <p className="text-sm text-green-700 dark:text-green-400">
                    <span className="font-medium">Recommended: 80%</span>
                    {' — '}
                    Studies show 80% task completion correlates with sustainable high performance without burnout.
                  </p>
                </div>
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
                    (step === 1 && !selectedPlan)
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
    </TooltipProvider>
  )
}
