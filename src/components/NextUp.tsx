'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarDays, Check, Circle, Loader2, Minus, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import CommitTimeModal from '@/components/CommitTimeModal'
import { useCalendar } from '@/contexts/CalendarContext'
import { useDayPlan, useSkipped, type DayPlanTask } from '@/hooks/useDayPlan'
import { buildNextUp, nowLineIndex, type NextUpItem } from '@/lib/next-up'
import { createEntry, deleteEntry, categorizeActivities, csrfFetch } from '@/lib/api'
import { formatTimeDisplay, timeToMinutes } from '@/lib/time-utils'
import {
  TimeEntry,
  TimePeriod,
  PERIOD_TIME_RANGES,
  getUserToday,
  getUserCurrentHour,
  isTaskCompletable,
} from '@/lib/types'
import { STATUS_CLASSES } from '@/lib/palette'

/**
 * Next up — what the day holds, and a way to say what became of it.
 *
 * Two places show it. Today shows the whole day: calendar and plan in time
 * order, with a line for now. A session shows only its own planned items,
 * because that is where you are when you are logging that part of the day.
 *
 * "Did it" is the join between the plan and the record. One tap writes the
 * entry at the planned time and marks the plan kept, tagged with the
 * session it belongs to — which is the tagging the post-session popup did,
 * moved to where the plan can actually be seen.
 */
interface NextUpProps {
  date: string
  /** The day's logged entries; the list reads the plan's fate from them. */
  entries: TimeEntry[]
  /** Called after anything is logged or changed, so the screen can refetch. */
  onChanged?: () => void
  /** Show only this session's planned items, with no calendar and no chrome. */
  period?: TimePeriod
}

const clockMinutes = () => getUserCurrentHour() * 60 + new Date().getMinutes()

const sessionOf = (startTime: string): TimePeriod => {
  const hour = parseInt(startTime.split(':')[0], 10)
  return hour < PERIOD_TIME_RANGES.afternoon.start
    ? 'morning'
    : hour < PERIOD_TIME_RANGES.evening.start
      ? 'afternoon'
      : 'evening'
}

const hhmm = (time: string) => time.slice(0, 5)

function untilLabel(startTime: string, now: number): string | null {
  const minutes = timeToMinutes(startTime) - now
  if (minutes <= 0 || minutes > 120) return null
  if (minutes < 60) return `in ${minutes} min`
  const rest = minutes % 60
  return rest === 0 ? `in ${minutes / 60}h` : `in ${Math.floor(minutes / 60)}h ${rest}m`
}

export default function NextUp({ date, entries, onChanged, period }: NextUpProps) {
  const router = useRouter()
  const { getEventsForDate } = useCalendar()
  const { plans, isLoading, refetch } = useDayPlan(date)
  const { skipped, skip, unskip } = useSkipped(date)

  const today = getUserToday()
  const isToday = date === today
  const isSession = period !== undefined

  // The clock, re-read each minute so the line moves and the hour that has
  // just passed starts asking its question.
  const [now, setNow] = useState(clockMinutes)
  useEffect(() => {
    if (!isToday) return
    const timer = setInterval(() => setNow(clockMinutes()), 60_000)
    return () => clearInterval(timer)
  }, [isToday])

  const nowMinutes = isToday ? now : date > today ? 0 : null

  const [busy, setBusy] = useState<string | null>(null)
  const [moving, setMoving] = useState<DayPlanTask | null>(null)

  const events = useMemo(
    () => (isSession ? [] : getEventsForDate(date).filter((e) => !e.isAllDay && e.startTime && e.endTime)),
    [isSession, getEventsForDate, date]
  )

  const { items: allItems, untimed } = useMemo(
    () => buildNextUp({ plans, entries, events, nowMinutes, skipped }),
    [plans, entries, events, nowMinutes, skipped]
  )

  const items = useMemo(() => {
    if (!period) return allItems
    const range = PERIOD_TIME_RANGES[period]
    return allItems.filter((item) => {
      const hour = parseInt(item.startTime.split(':')[0], 10)
      return item.kind === 'plan' && hour >= range.start && hour < range.end
    })
  }, [allItems, period])

  // Which items have been seen waiting, so the tick can land with a little
  // weight when one of them is done — and stay still for the ones that were
  // already done when the screen opened.
  const seenWaiting = useRef<Set<string>>(new Set())
  useEffect(() => {
    for (const item of allItems) {
      if (item.state !== 'done') seenWaiting.current.add(item.key)
    }
  }, [allItems])

  // Ticking a plan is only allowed on today and yesterday, as it always was.
  const canAct = isTaskCompletable(date)
  const nowLine = !isSession && isToday ? nowLineIndex(items, nowMinutes) : null

  const refresh = async () => {
    await refetch()
    onChanged?.()
  }

  const patchPlan = async (body: Record<string, unknown>) => {
    const res = await csrfFetch('/api/plans', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Failed to update plan')
  }

  const run = async (key: string, action: () => Promise<void>) => {
    if (busy) return
    setBusy(key)
    try {
      await action()
    } catch (err) {
      console.error('Next up action failed:', err)
      toast.error('That did not save. Try again.')
    } finally {
      setBusy(null)
    }
  }

  /** Write the entry at the time it was planned (or scheduled) for. */
  const logAt = async (item: NextUpItem) => {
    const start = hhmm(item.startTime)
    const end = hhmm(item.endTime)
    // One model call, and the entry still lands if it fails.
    const [category] = await categorizeActivities([item.title]).catch(() => [null])
    return createEntry({
      date,
      activity: item.title,
      category: category ?? null,
      duration_minutes: Math.max(5, timeToMinutes(end) - timeToMinutes(start)),
      start_time: start,
      end_time: end,
      commentary: 'Logged',
    })
  }

  const handleDidIt = (item: NextUpItem) =>
    run(item.key, async () => {
      const entry = await logAt(item)
      await patchPlan({ id: item.id, completed: true, completed_session: sessionOf(item.startTime) })
      await refresh()
      toast.success(`Logged ${item.title}`, {
        action: {
          label: 'Undo',
          onClick: () =>
            run(item.key, async () => {
              await deleteEntry(entry.id)
              await patchPlan({ id: item.id, completed: false })
              await refresh()
            }),
        },
      })
    })

  /** Something was logged in the plan's hour, and it was the plan. */
  const handleThatWasIt = (item: NextUpItem) =>
    run(item.key, async () => {
      await patchPlan({ id: item.id, completed: true, completed_session: sessionOf(item.startTime) })
      await refresh()
    })

  const handleConfirmEvent = (item: NextUpItem) =>
    run(item.key, async () => {
      const entry = await logAt(item)
      await refresh()
      toast.success(`Confirmed ${item.title}`, {
        action: {
          label: 'Undo',
          onClick: () =>
            run(item.key, async () => {
              await deleteEntry(entry.id)
              await refresh()
            }),
        },
      })
    })

  const openMove = (item: NextUpItem) => {
    const task = plans.find((plan) => plan.id === item.id)
    if (task) setMoving(task)
  }

  if (isSession && items.length === 0) return null
  if (isLoading && items.length === 0 && !isSession) return null

  const planHref = isToday ? '/calendar' : `/calendar?date=${date}`

  const rows = items.map((item, index) => (
    <div key={item.key}>
      {nowLine === index && <NowLine minutes={nowMinutes ?? 0} />}
      <Row
        item={item}
        nowMinutes={nowMinutes}
        isBusy={busy === item.key}
        disabled={busy !== null}
        canAct={canAct}
        justDone={item.state === 'done' && seenWaiting.current.has(item.key)}
        onDidIt={() => handleDidIt(item)}
        onThatWasIt={() => handleThatWasIt(item)}
        onConfirm={() => handleConfirmEvent(item)}
        onMove={() => openMove(item)}
        onSkip={() => skip(item.key)}
        onUnskip={() => unskip(item.key)}
      />
    </div>
  ))

  const sheet = moving && (
    <CommitTimeModal
      isOpen
      onClose={() => setMoving(null)}
      onCommit={async (start, end) => {
        await patchPlan({ id: moving.id, committed_start: start, committed_end: end })
        await refresh()
      }}
      taskTitle={moving.title}
      date={date}
      planId={moving.id}
      existingStart={moving.committed_start}
      existingEnd={moving.committed_end}
      onUnschedule={async () => {
        await patchPlan({ id: moving.id, committed_start: null, committed_end: null })
        await refresh()
      }}
      onDelete={async () => {
        const res = await csrfFetch(`/api/plans?id=${moving.id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Failed to delete task')
        await refresh()
      }}
    />
  )

  if (isSession) {
    return (
      <section className="mb-4">
        <h2 className="eyebrow mb-2">Planned</h2>
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">{rows}</div>
        {sheet}
      </section>
    )
  }

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="eyebrow">{isToday ? 'Next up' : 'Planned'}</h3>
        <button
          onClick={() => router.push(planHref)}
          className="flex min-h-9 items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Open the plan
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {items.length > 0 ? (
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          {rows}
          {nowLine === items.length && <NowLine minutes={nowMinutes ?? 0} />}
        </div>
      ) : (
        <button
          onClick={() => router.push(planHref)}
          className="w-full rounded-xl border border-dashed border-border bg-card/50 px-4 py-4 text-left transition-all duration-150 hover:border-foreground/25 active:scale-[0.99]"
        >
          <p className="text-sm text-foreground">
            {isToday ? 'Nothing planned for today' : 'Nothing planned yet'}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Give the things only you are waiting for a time, around your calendar.
          </p>
        </button>
      )}

      {untimed.length > 0 && (
        <button
          onClick={() => router.push(planHref)}
          className="mt-2 flex min-h-9 w-full items-center justify-between text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="truncate">
            {untimed.length === 1 ? '1 task' : `${untimed.length} tasks`} without a time:{' '}
            {untimed.map((task) => task.title).join(' · ')}
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        </button>
      )}

      {sheet}
    </section>
  )
}

function NowLine({ minutes }: { minutes: number }) {
  const clock = `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
  return (
    <div className="flex items-center gap-2 px-4 py-1.5" role="separator" aria-label={`Now, ${formatTimeDisplay(clock)}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
      <span className="text-xs font-medium uppercase tracking-wider text-foreground">
        Now · {formatTimeDisplay(clock)}
      </span>
      <span className="h-px flex-1 bg-foreground/30" />
    </div>
  )
}

interface RowProps {
  item: NextUpItem
  nowMinutes: number | null
  isBusy: boolean
  disabled: boolean
  canAct: boolean
  /** Became done while on screen: the tick animates in. */
  justDone: boolean
  onDidIt: () => void
  onThatWasIt: () => void
  onConfirm: () => void
  onMove: () => void
  onSkip: () => void
  onUnskip: () => void
}

function Row({
  item,
  nowMinutes,
  isBusy,
  disabled,
  canAct,
  justDone,
  onDidIt,
  onThatWasIt,
  onConfirm,
  onMove,
  onSkip,
  onUnskip,
}: RowProps) {
  const isPlan = item.kind === 'plan'
  const quiet = item.state === 'done' || item.state === 'skipped'

  const marker =
    item.state === 'done' ? (
      <Check
        className={`h-4 w-4 ${STATUS_CLASSES.green.icon} ${justDone ? 'animate-check-draw' : ''}`}
        strokeWidth={2.5}
        aria-label="Done"
      />
    ) : item.state === 'skipped' ? (
      <Minus className="h-4 w-4 text-muted-foreground" aria-label="Skipped" />
    ) : item.state === 'now' ? (
      <span className="flex h-4 w-4 items-center justify-center" aria-label="Now">
        <span className="h-2 w-2 rounded-full bg-foreground" />
      </span>
    ) : !isPlan ? (
      <CalendarDays className="h-4 w-4 text-muted-foreground" aria-label="Calendar event" />
    ) : (
      <Circle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    )

  const aside =
    item.state === 'done'
      ? item.outcome === 'moved'
        ? 'Done, another time'
        : 'Done'
      : item.state === 'skipped'
        ? 'Skipped'
        : item.state === 'now'
          ? 'Now'
          : item.state === 'upcoming' && nowMinutes !== null && nowMinutes > 0
            ? untilLabel(item.startTime, nowMinutes)
            : null

  const body = (
    <>
      <span className="mt-0.5 shrink-0">{marker}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${quiet ? 'text-muted-foreground' : 'text-foreground'} ${item.state === 'now' ? 'font-medium' : ''}`}>
          {item.title}
        </span>
        <span className="block text-xs tabular-nums text-muted-foreground">
          {formatTimeDisplay(hhmm(item.startTime))} – {formatTimeDisplay(hhmm(item.endTime))}
          {!isPlan && ' · Calendar'}
        </span>
        {item.state === 'due' && isPlan && item.loggedActivity && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            You logged {item.loggedActivity} then
          </span>
        )}
      </span>
      {aside && <span className="shrink-0 text-xs text-muted-foreground">{aside}</span>}
    </>
  )

  // A plan that has not been settled can be opened to move it; a calendar
  // event is not ours to move.
  const canOpen = isPlan && canAct && (item.state === 'upcoming' || item.state === 'now')

  return (
    <div className="px-4 py-3">
      {canOpen ? (
        <button
          onClick={onMove}
          aria-label={`${item.title}, ${formatTimeDisplay(hhmm(item.startTime))}. Change the time`}
          className="flex w-full items-start gap-3 text-left"
        >
          {body}
        </button>
      ) : (
        <div className="flex items-start gap-3">{body}</div>
      )}

      {item.state === 'due' && canAct && (
        <div className="mt-2.5 flex gap-2 pl-7">
          {isPlan ? (
            <>
              {item.loggedActivity ? (
                <Button size="sm" className="min-h-11 flex-1" onClick={onThatWasIt} disabled={disabled}>
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'That was it'}
                </Button>
              ) : (
                <Button size="sm" className="min-h-11 flex-1" onClick={onDidIt} disabled={disabled}>
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Did it'}
                </Button>
              )}
              <Button size="sm" variant="outline" className="min-h-11 flex-1" onClick={onMove} disabled={disabled}>
                Move
              </Button>
              <Button size="sm" variant="ghost" className="min-h-11 flex-1" onClick={onSkip} disabled={disabled}>
                Skip
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" className="min-h-11 flex-1" onClick={onConfirm} disabled={disabled}>
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
              </Button>
              <Button size="sm" variant="ghost" className="min-h-11 flex-1" onClick={onSkip} disabled={disabled}>
                Didn&rsquo;t happen
              </Button>
            </>
          )}
        </div>
      )}

      {item.state === 'skipped' && canAct && (
        <div className="pl-7">
          <button
            onClick={onUnskip}
            className="min-h-9 text-xs text-muted-foreground underline hover:no-underline"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
