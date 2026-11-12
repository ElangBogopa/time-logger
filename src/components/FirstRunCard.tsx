'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Circle, X, ChevronRight } from 'lucide-react'
import { readFirstRun, dismissFirstRun } from '@/lib/first-run'
import { getUserToday, getUserCurrentHour, getCurrentPeriod, shiftDateString } from '@/lib/types'
import { STATUS_CLASSES } from '@/lib/palette'

/**
 * The first trip round the loop, as three things to do.
 *
 * A tour would describe the app; this has the person use it. Plan
 * something, log something, read a review — each row goes to the place it
 * names and ticks itself when the thing has actually happened. Once all
 * three are done it says so and gets out of the way for good.
 *
 * Only ever shown to someone who went through onboarding on this device.
 */
export default function FirstRunCard({ hasLoggedToday }: { hasLoggedToday: boolean }) {
  const router = useRouter()
  const [state, setState] = useState(readFirstRun)

  if (!state.started || state.dismissed) return null

  const today = getUserToday()
  const hour = getUserCurrentHour()
  const period = getCurrentPeriod(Math.min(hour, 23))
  // The first review that can be opened: today's after 9pm, otherwise
  // tomorrow morning's look back at today.
  const reviewReady = hour >= 21

  const steps = [
    {
      key: 'planned',
      done: state.planned,
      title: 'Give something a time',
      hint: 'Pick what matters and let Better fit it around your calendar.',
      go: () => router.push(`/calendar?date=${hour < 15 ? today : shiftDateString(today, 1)}`),
    },
    {
      key: 'logged',
      done: hasLoggedToday,
      title: 'Log what you did',
      hint: 'Tick a planned item off, or add anything else in a tap.',
      go: () => router.push(`/log/${period}`),
    },
    {
      key: 'reviewed',
      done: state.reviewed,
      title: 'Read your first review',
      hint: reviewReady ? 'Today’s is open.' : 'It opens at 9:00 PM, once the day has something in it.',
      go: () => router.push('/review'),
    },
  ]

  const doneCount = steps.filter((step) => step.done).length
  const allDone = doneCount === steps.length

  const dismiss = () => {
    dismissFirstRun()
    setState(readFirstRun())
  }

  return (
    <section className="mt-6" aria-label="Getting started">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="eyebrow">{allDone ? 'That is the whole loop' : 'Getting started'}</h3>
        <button
          onClick={dismiss}
          aria-label="Hide getting started"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
        {allDone ? (
          <button onClick={dismiss} className="w-full px-4 py-4 text-left">
            <p className="text-sm text-foreground">Plan, do, review, plan again. You have been round once.</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Tap to put this away.</p>
          </button>
        ) : (
          steps.map((step) => (
            <button
              key={step.key}
              onClick={step.go}
              className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-accent/40 active:bg-accent/60"
            >
              <span className="mt-0.5 shrink-0">
                {step.done ? (
                  <Check className={`h-4 w-4 ${STATUS_CLASSES.green.icon}`} strokeWidth={2.5} aria-label="Done" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" aria-label="Not done yet" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-medium ${step.done ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {step.title}
                </span>
                {!step.done && <span className="block text-xs text-muted-foreground">{step.hint}</span>}
              </span>
              {!step.done && <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
            </button>
          ))
        )}
      </div>
    </section>
  )
}
