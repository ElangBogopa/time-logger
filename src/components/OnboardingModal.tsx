'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { ArrowRight, ArrowLeft, Loader2, CalendarDays, Check, Plus } from 'lucide-react'
import { invalidateGoals } from '@/lib/goals'
import { useCalendar } from '@/contexts/CalendarContext'
import { getUserToday, getUserCurrentHour, shiftDateString } from '@/lib/types'
import { formatTimeDisplay } from '@/lib/time-utils'
import { METRIC_TEXT_HEX } from '@/lib/palette'
import { startFirstRun } from '@/lib/first-run'

/**
 * The first four screens.
 *
 * This used to be a name, a "choice" between one plan with the button
 * disabled until you tapped the only option, and an 80% slider that nothing
 * in the app ever read. It never mentioned the calendar, the three scores,
 * the planner or the review — so a new person landed on three empty rings
 * with no idea what would fill them.
 *
 * It now says what the app is for, using the person's own calendar to do
 * it; says what the three numbers are; and ends by doing the thing the app
 * is for — picking what matters and handing it to the planner — rather
 * than describing it.
 */
interface OnboardingModalProps {
  isOpen: boolean
  /** `planDate` is set when the person chose things to plan: go and place them. */
  onComplete: (next?: { planDate: string }) => void
}

/** The things with no owner and no time. Starting points, not a taxonomy. */
const STARTERS = ['Exercise', 'Deep work', 'Call someone', 'Read', 'An errand']
const MAX_PICKS = 3
const STEPS = 4

const SCORES: { key: keyof typeof METRIC_TEXT_HEX; name: string; what: string }[] = [
  { key: 'body', name: 'Body', what: 'Sleep, meals and looking after yourself — and exercise, which is the only thing that takes it past 70.' },
  { key: 'focus', name: 'Mind', what: 'Focused work, counted above meetings and admin. About four hours is the target, not eight.' },
  { key: 'social', name: 'Heart', what: 'Time with people. An hour is the target.' },
]

export default function OnboardingModal({ isOpen, onComplete }: OnboardingModalProps) {
  const { data: session } = useSession()
  const { getEventsForDate } = useCalendar()
  const [step, setStep] = useState(0)
  const [preferredName, setPreferredName] = useState('')
  const [picks, setPicks] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [extras, setExtras] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.user) return
    const name = session.user.preferredName || session.user.name || ''
    const prefill = setTimeout(() => setPreferredName((current) => current || name.split(' ')[0]), 0)
    return () => clearTimeout(prefill)
  }, [session])

  // Plan what is left of today while there is still a day to plan; after
  // mid-afternoon the useful day is tomorrow.
  const today = getUserToday()
  const planToday = getUserCurrentHour() < 15
  const planDate = planToday ? today : shiftDateString(today, 1)
  const dayWord = planToday ? 'today' : 'tomorrow'

  // The person's own calendar, as the argument for the app: here is what
  // already has a time. Everything else is what this is for.
  const events = useMemo(
    () =>
      getEventsForDate(planDate)
        .filter((event) => !event.isAllDay && event.startTime && event.endTime)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .slice(0, 3),
    [getEventsForDate, planDate]
  )

  const toggle = (title: string) => {
    setPicks((current) =>
      current.includes(title)
        ? current.filter((t) => t !== title)
        : current.length >= MAX_PICKS
          ? current
          : [...current, title]
    )
  }

  const addCustom = () => {
    const title = custom.trim()
    if (!title) return
    if (!STARTERS.includes(title) && !extras.includes(title)) setExtras((current) => [...current, title])
    setPicks((current) => (current.includes(title) || current.length >= MAX_PICKS ? current : [...current, title]))
    setCustom('')
  }

  const saveName = async () => {
    setError(null)
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
  }

  /**
   * Finish, with or without a first plan. Either way the account is marked
   * as set up — skipping used to set a flag nothing read, so the sheet came
   * back on every visit.
   */
  const finish = async (titles: string[]) => {
    setIsSubmitting(true)
    setError(null)
    try {
      // The goal page hangs off this goal, and nothing else creates one.
      const existingGoals = await csrfFetch('/api/goals')
      const goalsData = existingGoals.ok ? await existingGoals.json() : { goals: [] }
      const hasGoal = goalsData.goals?.some(
        (g: { title: string; active: boolean }) => g.title === 'Increase Productivity' && g.active
      )
      if (!hasGoal) {
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
          throw new Error(data.error || 'Failed to finish setting up')
        }
        invalidateGoals()
      }

      // `productivity_target` is what marks an account as onboarded. It was
      // a slider here; nothing ever read the number, so it is no longer
      // asked for — but the column is still the flag.
      const prefsResponse = await csrfFetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productivity_target: 80 }),
      })
      if (!prefsResponse.ok) {
        const data = await prefsResponse.json()
        throw new Error(data.error || 'Failed to finish setting up')
      }

      for (const title of titles) {
        await csrfFetch('/api/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: planDate, title }),
        })
      }

      startFirstRun()
      onComplete(titles.length > 0 ? { planDate } : undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  const chips = [...STARTERS, ...extras]

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <VisuallyHidden>
          <DialogTitle>Welcome to Better</DialogTitle>
          <DialogDescription>
            Four short steps: your name, what Better is for, how a day is scored, and a first plan.
          </DialogDescription>
        </VisuallyHidden>

        {/* Progress */}
        <div className="flex items-center justify-center gap-1.5" aria-label={`Step ${step + 1} of ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, s) => (
            <span
              key={s}
              className={`h-1 w-10 rounded-full transition-colors duration-300 ${s <= step ? 'bg-foreground' : 'bg-border'}`}
            />
          ))}
        </div>

        {/* 1 — name */}
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="page-title text-foreground">Welcome to Better</h2>
              <p className="mt-1 text-sm text-muted-foreground">What should we call you?</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferredName">Your first name</Label>
              <Input
                id="preferredName"
                type="text"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                placeholder="e.g., Alex"
                autoFocus
              />
            </div>
          </div>
        )}

        {/* 2 — what it is for, argued from the person's own calendar */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="page-title text-foreground">Your calendar holds what other people need from you</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Better is for the rest: the deep work, the gym, the call home. They have no owner and no
                time, which is most of why they don&rsquo;t happen.
              </p>
            </div>

            <div className="rounded-xl border border-border">
              <p className="field-label px-4 pt-3">On your calendar {dayWord}</p>
              {events.length > 0 ? (
                <ul className="divide-y divide-border">
                  {events.map((event) => (
                    <li key={event.id} className="flex items-center gap-3 px-4 py-2.5">
                      <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{event.title}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatTimeDisplay(event.startTime)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 text-sm text-foreground">Nothing yet. A clear day to give to what matters.</p>
              )}
              <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                Better reads your Google Calendar and never writes to it.
              </p>
            </div>
          </div>
        )}

        {/* 3 — the three scores */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="page-title text-foreground">A day is three numbers</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Each is out of 100. Reaching the target scores 80, and 100 is out of reach on purpose.
              </p>
            </div>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {SCORES.map((score) => (
                <li key={score.key} className="flex gap-3 px-4 py-3">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: METRIC_TEXT_HEX[score.key] }}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">{score.name}</p>
                    <p className="text-xs text-muted-foreground">{score.what}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Every target comes from published research. It is all under More → The Science.
            </p>
          </div>
        )}

        {/* 4 — a first plan */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="page-title text-foreground">What matters {dayWord}?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Pick up to three. Better will fit them around your calendar and say why it chose each hour.
              </p>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label={`What matters ${dayWord}`}>
              {chips.map((title) => {
                const selected = picks.includes(title)
                const full = !selected && picks.length >= MAX_PICKS
                return (
                  <button
                    key={title}
                    type="button"
                    onClick={() => toggle(title)}
                    aria-pressed={selected}
                    disabled={full}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm transition-all duration-150 active:scale-[0.97] disabled:opacity-40 ${
                      selected
                        ? 'border-foreground bg-foreground font-medium text-background'
                        : 'border-border text-foreground hover:border-foreground/40'
                    }`}
                  >
                    {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    {title}
                  </button>
                )
              })}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                addCustom()
              }}
              className="flex gap-2"
            >
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Or something of your own"
                aria-label="Something of your own"
                className="flex-1"
              />
              <Button type="submit" variant="outline" size="icon" disabled={!custom.trim()} aria-label="Add it">
                <Plus className="h-4 w-4" />
              </Button>
            </form>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {/* Navigation */}
        <div className="space-y-2">
          <div className="flex gap-2">
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  setStep(step - 1)
                  setError(null)
                }}
                disabled={isSubmitting}
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}

            {step === 0 && (
              <Button type="button" onClick={saveName} disabled={isSubmitting || !preferredName.trim()} className="flex-1">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Next <ArrowRight className="h-4 w-4" /></>}
              </Button>
            )}
            {(step === 1 || step === 2) && (
              <Button type="button" onClick={() => setStep(step + 1)} className="flex-1">
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {step === 3 && (
              <Button type="button" onClick={() => finish(picks)} disabled={isSubmitting || picks.length === 0} className="flex-1">
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>Find them a time <ArrowRight className="h-4 w-4" /></>
                )}
              </Button>
            )}
          </div>

          {(step === 0 || step === 3) && (
            <button
              type="button"
              onClick={() => finish([])}
              disabled={isSubmitting}
              className="min-h-11 w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              {step === 0 ? 'Skip for now' : 'I’ll plan later'}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
