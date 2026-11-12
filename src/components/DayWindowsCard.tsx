'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import SourceSheet from '@/components/SourceSheet'
import { useWakeTime } from '@/hooks/useWakeTime'
import { windowsForWake, windowsOpenAt, REFERENCE_WAKE_MINUTES, type DayWindow } from '@/lib/ideal-day'
import type { HabitEntry } from '@/lib/habits'
import { AGGREGATED_HEX } from '@/lib/palette'
import { CATEGORY_LABELS, getUserCurrentHour } from '@/lib/types'
import { formatTimeDisplay, minutesToTime } from '@/lib/time-utils'

/**
 * What this hour is best for, and what the rest of the day's are.
 *
 * The app has always had an opinion about when things belong in a day; it
 * only ever voiced it as a line of small print on a suggestion. For someone
 * who cares about the right hour for each thing, that opinion is the point,
 * so it gets a place of its own: the window that is open now, the next one,
 * the whole day behind a tap — every one with its reason and its source,
 * and all of it moved to when this person actually wakes.
 */
const clockMinutes = () => Math.min(getUserCurrentHour(), 23) * 60 + new Date().getMinutes()
const at = (minutes: number) => formatTimeDisplay(minutesToTime(minutes))
const bestFor = (window: DayWindow) =>
  window.categories.map((category) => CATEGORY_LABELS[category].toLowerCase()).join(', ')

export default function DayWindowsCard({ history }: { history: HabitEntry[] }) {
  const { wakeMinutes, source, learnedMinutes, setWake } = useWakeTime(history)
  const windows = useMemo(() => windowsForWake(wakeMinutes), [wakeMinutes])

  const [now, setNow] = useState(clockMinutes)
  useEffect(() => {
    const timer = setInterval(() => setNow(clockMinutes()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const [isOpen, setIsOpen] = useState(false)
  const [whySource, setWhySource] = useState<string | null>(null)
  const [draftWake, setDraftWake] = useState<string | null>(null)

  const open = windowsOpenAt(now, windows)[0] ?? null
  const next = windows.find((window) => window.startMinutes > now) ?? null

  // The band runs from the first window to the last, not midnight to midnight.
  const from = windows[0]?.startMinutes ?? 0
  const to = windows[windows.length - 1]?.endMinutes ?? 24 * 60
  const span = Math.max(1, to - from)
  const left = (minutes: number) => `${((minutes - from) / span) * 100}%`
  const width = (window: DayWindow) => `${((window.endMinutes - window.startMinutes) / span) * 100}%`

  const wakeLabel = at(wakeMinutes ?? REFERENCE_WAKE_MINUTES)

  return (
    <section className="mt-6" aria-label="Your windows">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="eyebrow">Your windows</h3>
        <button
          onClick={() => setIsOpen(true)}
          className="flex min-h-9 items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {source === 'unknown' ? 'Set when you wake' : `Up at ${wakeLabel}`}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <button
        onClick={() => setIsOpen(true)}
        aria-label="See all of today's windows"
        className="w-full rounded-xl border border-border bg-card p-4 text-left transition-all duration-150 hover:border-foreground/25 active:scale-[0.995]"
      >
        {/* The day as a band: the body's windows, with the two that belong
            to other people as a strip beneath. */}
        <div className="relative h-7 w-full overflow-hidden rounded-md bg-secondary/60" aria-hidden="true">
          {windows
            .filter((window) => window.anchor === 'body')
            .map((window) => (
              <span
                key={window.id}
                className="absolute top-0 bottom-0 border-r border-card"
                style={{
                  left: left(window.startMinutes),
                  width: width(window),
                  backgroundColor: AGGREGATED_HEX[window.bucket],
                  opacity: open?.id === window.id ? 1 : 0.45,
                }}
              />
            ))}
          {now >= from && now <= to && (
            <span className="absolute top-0 bottom-0 w-0.5 bg-foreground" style={{ left: left(now) }} />
          )}
        </div>
        <div className="relative mt-1 h-1 w-full" aria-hidden="true">
          {windows
            .filter((window) => window.anchor === 'clock')
            .map((window) => (
              <span
                key={window.id}
                className="absolute top-0 bottom-0 rounded-full"
                style={{
                  left: left(window.startMinutes),
                  width: width(window),
                  backgroundColor: AGGREGATED_HEX[window.bucket],
                  opacity: 0.7,
                }}
              />
            ))}
        </div>

        <div className="mt-3">
          {open ? (
            <>
              <p className="text-sm text-foreground">
                <span className="font-semibold">{open.label}</span>
                <span className="text-muted-foreground"> · until {at(open.endMinutes)}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{open.reason}.</p>
            </>
          ) : next ? (
            <p className="text-sm text-muted-foreground">Between windows.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Today&rsquo;s windows are behind you.</p>
              {windows[0] && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Tomorrow starts with <span className="text-foreground">{windows[0].label}</span> at{' '}
                  {at(windows[0].startMinutes)}
                </p>
              )}
            </>
          )}
          {next && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Next: <span className="text-foreground">{next.label}</span> at {at(next.startMinutes)}
            </p>
          )}
        </div>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-left">Today&rsquo;s windows</DialogTitle>
            <DialogDescription className="text-left">
              What each part of your day is best for, and why.
            </DialogDescription>
          </DialogHeader>

          {/* When you wake: what moves everything else */}
          <div className="rounded-xl border border-border p-3">
            <p className="text-sm text-foreground">
              {source === 'set' && <>Set for waking at {wakeLabel}.</>}
              {source === 'log' && <>From your log: you usually wake around {wakeLabel}.</>}
              {source === 'unknown' && (
                <>These are for someone who wakes at {wakeLabel}. Say when you do and they will move to you.</>
              )}
            </p>
            {draftWake === null ? (
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDraftWake(minutesToTime(wakeMinutes ?? REFERENCE_WAKE_MINUTES))}
                >
                  {source === 'unknown' ? 'Set my wake time' : 'Change'}
                </Button>
                {source === 'set' && (
                  <Button size="sm" variant="ghost" onClick={() => setWake(null)}>
                    {learnedMinutes !== null ? 'Use my log instead' : 'Clear'}
                  </Button>
                )}
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="time"
                  value={draftWake}
                  onChange={(e) => setDraftWake(e.target.value)}
                  aria-label="When you wake"
                  className="h-11 flex-1 rounded-xl border border-input bg-transparent px-3 text-base text-foreground outline-none focus:border-ring"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const [h, m] = draftWake.split(':').map(Number)
                    if (Number.isFinite(h) && Number.isFinite(m)) setWake(h * 60 + m)
                    setDraftWake(null)
                  }}
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDraftWake(null)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>

          <ul className="divide-y divide-border rounded-xl border border-border">
            {windows.map((window) => {
              const isNow = now >= window.startMinutes && now < window.endMinutes
              return (
                <li key={window.id} className={`flex gap-3 px-4 py-3 ${isNow ? 'bg-accent/50' : ''}`}>
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: AGGREGATED_HEX[window.bucket] }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium text-foreground">
                        {window.label}
                        {isNow && <span className="ml-2 text-xs font-normal text-muted-foreground">now</span>}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {at(window.startMinutes)} – {at(window.endMinutes)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {window.reason}.{' '}
                      <button
                        onClick={() => setWhySource(window.source)}
                        className="underline hover:text-foreground hover:no-underline"
                      >
                        why?
                      </button>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Best for {bestFor(window)}.</p>
                  </div>
                </li>
              )
            })}
          </ul>

          <p className="text-xs text-muted-foreground">
            The windows about your body follow when you wake; the two about other people stay on the clock.
            All of these are averages across people — when the planner suggests a time, your own log outranks
            them.
          </p>
        </DialogContent>
      </Dialog>

      <SourceSheet sourceId={whySource} onClose={() => setWhySource(null)} />
    </section>
  )
}
