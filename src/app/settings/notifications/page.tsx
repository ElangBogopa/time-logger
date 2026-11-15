'use client'

import { useEffect, useState } from 'react'
import { useAccount } from '@/hooks/useAccount'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { csrfFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useInstall } from '@/hooks/useInstall'
import { InstallSheet } from '@/components/InstallHint'
import { ReminderTime, DEFAULT_REMINDER_TIMES } from '@/lib/types'
import { formatHour, reminderHour, reminderLabel } from '@/lib/reminders'

const CACHE_KEY = 'reminder-times'
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

function cachedTimes(): ReminderTime[] | null {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '').times ?? null
  } catch {
    return null
  }
}

/**
 * Reminders: three a day, each asking for the part of the day just gone.
 *
 * This screen was unreachable for most of a year — its row under More was
 * commented out — and turning reminders on here never enrolled anybody.
 * The switch is now the subscription itself, there is a way to send a test,
 * and where a device cannot receive notifications the screen says why
 * instead of "not supported".
 */
export default function NotificationsPage() {
  const { status } = useAccount()
  const router = useRouter()
  const push = usePushNotifications()
  const install = useInstall()

  const [reminderTimes, setReminderTimes] = useState<ReminderTime[]>(() => cachedTimes() ?? DEFAULT_REMINDER_TIMES)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [showInstall, setShowInstall] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    let cancelled = false
    fetch('/api/preferences')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const times: ReminderTime[] | undefined = data?.preferences?.reminder_times
        if (cancelled || !times) return
        setReminderTimes(times)
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ times }))
        } catch {
          /* storage is a convenience */
        }
      })
      .catch((error) => console.error('Failed to fetch preferences:', error))
    return () => {
      cancelled = true
    }
  }, [status])

  const save = async (next: ReminderTime[]) => {
    const previous = reminderTimes
    setReminderTimes(next)
    setIsSaving(true)
    try {
      const response = await csrfFetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminder_times: next }),
      })
      if (!response.ok) throw new Error('save failed')
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ times: next }))
      } catch {
        /* storage is a convenience */
      }
    } catch {
      // Put the screen back to what the server still has.
      setReminderTimes(previous)
      toast.error('That change could not be saved')
    } finally {
      setIsSaving(false)
    }
  }

  const sendTest = async () => {
    setIsTesting(true)
    const problem = await push.sendTest()
    setIsTesting(false)
    if (problem) toast.error(problem)
    else toast.success('Sent. It should arrive in a moment.')
  }

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // An iPhone in a browser tab has no way to receive a notification at all;
  // from the Home Screen it does. "Not supported" was true and no help.
  const needsHomeScreen = !push.isSupported && install.platform === 'ios' && !install.standalone

  const state = !push.isSupported
    ? needsHomeScreen
      ? 'On an iPhone, reminders work once Better is on your Home Screen.'
      : 'This browser cannot receive notifications.'
    : push.permission === 'denied'
      ? 'Notifications are blocked for Better. Allow them in your device’s settings, then come back.'
      : push.isSubscribed
        ? 'On for this device.'
        : 'Off. Turn them on for a nudge to log each part of your day.'

  const canSwitch = push.isSupported && push.permission !== 'denied'
  const locked = !push.isSubscribed

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-6">
          <button
            onClick={() => router.back()}
            className="mb-4 flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="page-title text-foreground">Reminders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Three a day, each asking for the part of the day that has just gone.
          </p>
        </header>

        <section className="rounded-xl border border-border bg-card p-4" aria-label="Reminders on this device">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Reminders</p>
              <p className="mt-0.5 text-sm text-muted-foreground" role="status">
                {state}
              </p>
            </div>
            {canSwitch && (
              <Button
                variant={push.isSubscribed ? 'outline' : 'default'}
                size="sm"
                className="shrink-0"
                disabled={push.isLoading}
                onClick={() => (push.isSubscribed ? push.unsubscribe() : push.subscribe())}
              >
                {push.isLoading && <Loader2 className="animate-spin" />}
                {push.isSubscribed ? 'Turn off' : 'Turn on'}
              </Button>
            )}
            {needsHomeScreen && (
              <Button size="sm" className="shrink-0" onClick={() => setShowInstall(true)}>
                Show me how
              </Button>
            )}
          </div>

          {push.error && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {push.error}
            </p>
          )}

          {push.isSubscribed && (
            <div className="mt-4 border-t border-border pt-3">
              <Button variant="outline" size="sm" disabled={isTesting} onClick={sendTest}>
                {isTesting && <Loader2 className="animate-spin" />}
                Send a test
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Sends one notification to your devices now, so you can see it arrive.
              </p>
            </div>
          )}
        </section>

        <h2 className="eyebrow mt-6 mb-2">When</h2>
        <section
          className={`overflow-hidden rounded-xl border border-border bg-card divide-y divide-border ${locked ? 'opacity-60' : ''}`}
          aria-label="When"
        >
          {reminderTimes.map((reminder) => {
            const label = reminderLabel(reminder)
            const hour = reminderHour(reminder.time)
            return (
              <div key={reminder.id} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
                <label className="flex min-w-0 flex-1 items-center gap-3">
                  <Switch
                    checked={!locked && reminder.enabled}
                    disabled={locked || isSaving}
                    aria-label={label}
                    onCheckedChange={(enabled) =>
                      save(reminderTimes.map((rt) => (rt.id === reminder.id ? { ...rt, enabled } : rt)))
                    }
                  />
                  <span className="truncate text-sm font-medium text-foreground">{label}</span>
                </label>
                <select
                  value={hour}
                  disabled={locked || !reminder.enabled || isSaving}
                  aria-label={`${label}: time`}
                  onChange={(event) => {
                    const time = `${String(event.target.value).padStart(2, '0')}:00`
                    save(reminderTimes.map((rt) => (rt.id === reminder.id ? { ...rt, time } : rt)))
                  }}
                  className="h-11 shrink-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {HOURS.map((option) => (
                    <option key={option} value={option}>
                      {formatHour(option)}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
        </section>
        <p className="mt-2 text-xs text-muted-foreground">
          {canSwitch && locked && !push.isLoading
            ? 'Turn reminders on to choose the times.'
            : 'Sent on the hour, give or take a few minutes, and skipped when you have already logged that part of the day.'}
        </p>
      </div>

      <InstallSheet open={showInstall} onOpenChange={setShowInstall} />
    </div>
  )
}
