'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Bell, BellOff, Clock, Loader2, Calendar, ChevronRight, Target, Moon, Sun, LogOut } from 'lucide-react'
import { useTheme } from 'next-themes'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import Toast from '@/components/Toast'
import { ReminderTime, DEFAULT_REMINDER_TIMES } from '@/lib/types'

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const push = usePushNotifications()
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch for theme
  useEffect(() => {
    setMounted(true)
  }, [])

  const [toast, setToast] = useState<{ message: string; variant?: 'default' | 'success' | 'error' } | null>(null)
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [reminderTimes, setReminderTimes] = useState<ReminderTime[]>(DEFAULT_REMINDER_TIMES)

  // Fetch preferences on mount
  useEffect(() => {
    if (session?.user?.id) {
      fetchPreferences()
    }
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
      const response = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminder_times: newTimes }),
      })

      if (response.ok) {
        setReminderTimes(newTimes)
        setToast({ message: 'Reminder times saved', variant: 'success' })
      } else {
        setToast({ message: 'Failed to save', variant: 'error' })
      }
    } catch (error) {
      console.error('Failed to save preferences:', error)
      setToast({ message: 'Failed to save', variant: 'error' })
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

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading' || isLoadingPrefs) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your notifications and preferences
          </p>
        </header>

        <div className="space-y-6">
          {/* Push Notifications Card */}
          <Card>
            <CardHeader>
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
                  <CardTitle className="text-base">Push Notifications</CardTitle>
                  <CardDescription>
                    {!push.isSupported ? (
                      'Not supported in this browser'
                    ) : push.permission === 'denied' ? (
                      'Blocked - enable in browser settings'
                    ) : push.isSubscribed ? (
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        Enabled - you&apos;ll receive reminders
                      </span>
                    ) : (
                      'Get reminders to log your time'
                    )}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!push.isSupported ? (
                <p className="text-sm text-muted-foreground">
                  Push notifications are not available in this browser. Try Chrome, Firefox, or Edge.
                </p>
              ) : push.permission === 'denied' ? (
                <p className="text-sm text-muted-foreground">
                  You&apos;ve blocked notifications. To enable them, click the lock icon in your browser&apos;s address bar and allow notifications.
                </p>
              ) : push.isSubscribed ? (
                <Button
                  variant="outline"
                  onClick={async () => {
                    const success = await push.unsubscribe()
                    if (success) {
                      setToast({ message: 'Notifications disabled', variant: 'success' })
                    } else {
                      setToast({ message: 'Failed to disable notifications', variant: 'error' })
                    }
                  }}
                  disabled={push.isLoading}
                >
                  {push.isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Disabling...
                    </>
                  ) : (
                    <>
                      <BellOff className="h-4 w-4" />
                      Disable Notifications
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={async () => {
                    const success = await push.subscribe()
                    if (success) {
                      setToast({ message: 'Notifications enabled!', variant: 'success' })
                    } else if (push.permission === 'denied') {
                      setToast({ message: 'Permission denied. Check browser settings.', variant: 'error' })
                    } else {
                      setToast({ message: 'Failed to enable notifications', variant: 'error' })
                    }
                  }}
                  disabled={push.isLoading}
                >
                  {push.isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enabling...
                    </>
                  ) : (
                    <>
                      <Bell className="h-4 w-4" />
                      Enable Notifications
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Reminder Times Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Reminder Times</CardTitle>
                  <CardDescription>
                    When should we remind you to log your time?
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reminderTimes.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={reminder.enabled}
                        onCheckedChange={() => toggleReminder(reminder.id)}
                        disabled={isSaving}
                      />
                      <div>
                        <p className="text-sm font-medium">{reminder.label}</p>
                      </div>
                    </div>
                    <input
                      type="time"
                      value={reminder.time}
                      onChange={(e) => updateReminderTime(reminder.id, e.target.value)}
                      disabled={!reminder.enabled || isSaving}
                      className="rounded-md border border-input bg-background px-2 py-1 text-sm
                               disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                ))}
              </div>
              {!push.isSubscribed && push.isSupported && push.permission !== 'denied' && (
                <p className="mt-4 text-xs text-muted-foreground">
                  Enable push notifications above to receive these reminders.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Appearance Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
                    {mounted && resolvedTheme === 'dark' ? (
                      <Moon className="h-5 w-5 text-indigo-500" />
                    ) : (
                      <Sun className="h-5 w-5 text-indigo-500" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base">Dark Mode</CardTitle>
                    <CardDescription>
                      {mounted && resolvedTheme === 'dark' ? 'Dark theme active' : 'Light theme active'}
                    </CardDescription>
                  </div>
                </div>
                {mounted && (
                  <Switch
                    checked={resolvedTheme === 'dark'}
                    onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                  />
                )}
              </div>
            </CardHeader>
          </Card>

          {/* My Intentions Link */}
          <Card
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => router.push('/intentions')}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">My Intentions</CardTitle>
                    <CardDescription>
                      What you want to focus on this week
                    </CardDescription>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
          </Card>

          {/* Connected Accounts Link */}
          <Card
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => router.push('/settings/connections')}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Connected Accounts</CardTitle>
                    <CardDescription>
                      Manage calendar integrations
                    </CardDescription>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Account info + Sign out */}
        <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{session?.user?.email}</span>
              {session?.authProvider === 'google' && ' via Google'}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Sign out
            </Button>
          </div>
        </div>
      </div>

      {toast && (
        <Toast
          title={toast.variant === 'error' ? 'Error' : 'Success'}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
