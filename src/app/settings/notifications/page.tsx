'use client'

import { csrfFetch } from '@/lib/api'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Bell, BellOff, Clock, Loader2 } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { ReminderTime, DEFAULT_REMINDER_TIMES } from '@/lib/types'

export default function NotificationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const push = usePushNotifications()

  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [reminderTimes, setReminderTimes] = useState<ReminderTime[]>(DEFAULT_REMINDER_TIMES)

  useEffect(() => {
    if (session?.user?.id) fetchPreferences()
  }, [session?.user?.id])

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/preferences')
      if (response.ok) {
        const data = await response.json()
        if (data.preferences?.reminder_times) {
          setReminderTimes(data.preferences.reminder_times)
        }
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error)
    } finally {
      setIsLoadingPrefs(false)
    }
  }

  const saveReminderTimes = async (newTimes: ReminderTime[]) => {
    setIsSaving(true)
    try {
      await csrfFetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminder_times: newTimes }),
      })
      setReminderTimes(newTimes)
    } catch (error) {
      console.error('Failed to save preferences:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleReminder = (id: string) => {
    const newTimes = reminderTimes.map(rt =>
      rt.id === id ? { ...rt, enabled: !rt.enabled } : rt
    )
    saveReminderTimes(newTimes)
  }

  const updateReminderTime = (id: string, time: string) => {
    const newTimes = reminderTimes.map(rt =>
      rt.id === id ? { ...rt, time } : rt
    )
    saveReminderTimes(newTimes)
  }

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  if (status === 'loading' || isLoadingPrefs) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage push notifications and reminders</p>
        </header>

        <div className="space-y-4">
          {/* Push Toggle */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  push.isSubscribed ? 'bg-green-500/10' : 'bg-muted'
                }`}>
                  {push.isSubscribed ? (
                    <Bell className="h-5 w-5 text-green-500" />
                  ) : (
                    <BellOff className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Push Notifications</p>
                  <p className="text-[11px] text-muted-foreground">
                    {!push.isSupported
                      ? 'Not supported in this browser'
                      : push.permission === 'denied'
                        ? 'Blocked — enable in browser settings'
                        : push.isSubscribed
                          ? 'Enabled'
                          : 'Get reminders to log your time'}
                  </p>
                </div>
              </div>
              {push.isSupported && push.permission !== 'denied' && (
                <Button
                  variant={push.isSubscribed ? 'outline' : 'default'}
                  size="sm"
                  onClick={async () => {
                    if (push.isSubscribed) await push.unsubscribe()
                    else await push.subscribe()
                  }}
                  disabled={push.isLoading}
                >
                  {push.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : push.isSubscribed ? 'Disable' : 'Enable'}
                </Button>
              )}
            </div>
          </div>

          {/* Reminder Times */}
          <div className={`rounded-xl border border-border bg-card p-4 ${!push.isSubscribed ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Reminder Times</p>
                <p className="text-[11px] text-muted-foreground">When to remind you to log</p>
              </div>
            </div>
            <div className="space-y-3">
              {reminderTimes.map((reminder) => (
                <div key={reminder.id} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={push.isSubscribed && reminder.enabled}
                      onCheckedChange={() => toggleReminder(reminder.id)}
                      disabled={!push.isSubscribed || isSaving}
                    />
                    <p className="text-sm font-medium">{reminder.label}</p>
                  </div>
                  <input
                    type="time"
                    value={reminder.time}
                    onChange={(e) => updateReminderTime(reminder.id, e.target.value)}
                    disabled={!push.isSubscribed || !reminder.enabled || isSaving}
                    className="rounded-md border border-input bg-background px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
