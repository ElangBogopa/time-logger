'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ArrowLeft, Calendar, Loader2, X } from 'lucide-react'
import Toast from '@/components/Toast'
import { useCalendar } from '@/contexts/CalendarContext'
import { csrfFetch } from '@/lib/api'

interface ConflictData {
  email: string
  pendingId: string
  googleUserId: string
}

function ConnectionsContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Use shared CalendarContext instead of local state
  const { calendarStatus, isCheckingStatus, checkCalendarStatus } = useCalendar()

  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [toast, setToast] = useState<{ message: string; variant?: 'default' | 'success' | 'error' } | null>(null)
  const [conflictModal, setConflictModal] = useState<ConflictData | null>(null)
  const [isMerging, setIsMerging] = useState(false)

  // Check for URL params (success, error, or conflict)
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    const conflictEmail = searchParams.get('conflict_email')
    const pendingId = searchParams.get('pending_id')
    const googleUserId = searchParams.get('source_user_id') // The existing Google user's ID

    if (success === 'true') {
      setToast({ message: 'Google Calendar connected successfully!', variant: 'success' })
      checkCalendarStatus() // Update shared context
      router.replace('/settings/connections', { scroll: false })
    } else if (conflictEmail && pendingId && googleUserId) {
      // Show conflict modal with merge option
      setConflictModal({
        email: conflictEmail,
        pendingId: pendingId,
        googleUserId: googleUserId,
      })
      router.replace('/settings/connections', { scroll: false })
    } else if (error) {
      const errorMessages: Record<string, string> = {
        calendar_auth_denied: 'Calendar access was denied',
        calendar_token_failed: 'Failed to get calendar access',
        calendar_save_failed: 'Failed to save calendar connection',
        calendar_callback_failed: 'Calendar connection failed',
        calendar_invalid_response: 'Invalid response from Google',
      }
      setToast({ message: errorMessages[error] || 'Calendar connection failed', variant: 'error' })
      router.replace('/settings/connections', { scroll: false })
    }
  }, [searchParams, router, checkCalendarStatus])

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // Loading state is either session loading or calendar status checking
  const isLoading = status === 'loading' || isCheckingStatus

  // Handle connect calendar
  const handleConnect = () => {
    setIsConnecting(true)
    // Redirect to connect endpoint which will redirect to Google OAuth
    window.location.href = '/api/calendar/connect?redirect=/settings/connections'
  }

  // Handle disconnect calendar
  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      const response = await csrfFetch('/api/calendar/status', { method: 'DELETE' })
      if (response.ok) {
        checkCalendarStatus() // Update shared context
        setToast({ message: 'Calendar disconnected', variant: 'success' })
      } else {
        const data = await response.json()
        setToast({ message: data.error || 'Failed to disconnect', variant: 'error' })
      }
    } catch (error) {
      console.error('Failed to disconnect:', error)
      setToast({ message: 'Failed to disconnect', variant: 'error' })
    } finally {
      setIsDisconnecting(false)
    }
  }

  // Handle cancel conflict - clean up pending connection
  const handleCancelConflict = async () => {
    if (!conflictModal) return
    try {
      await csrfFetch('/api/calendar/callback/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pending_id: conflictModal.pendingId,
          action: 'cancel',
        }),
      })
    } catch (error) {
      console.error('Failed to cancel:', error)
    }
    setConflictModal(null)
  }

  // Handle conflict resolution - merge and sign in with Google
  const handleMergeAndSignIn = async () => {
    if (!conflictModal || !session?.user?.id) return
    setIsMerging(true)
    try {
      const response = await csrfFetch('/api/auth/merge-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailUserId: session.user.id,
          googleUserId: conflictModal.googleUserId,
          pendingId: conflictModal.pendingId,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setConflictModal(null)
        signOut({ callbackUrl: '/login?merged=true' })
      } else {
        setToast({ message: data.error || 'Failed to merge accounts', variant: 'error' })
        setIsMerging(false)
      }
    } catch (error) {
      console.error('Failed to merge accounts:', error)
      setToast({ message: 'Failed to merge accounts', variant: 'error' })
      setIsMerging(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  const isGoogleOAuthUser = session?.authProvider === 'google'

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Header */}
        <header className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/settings')}
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Settings
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Connected Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your calendar integrations
          </p>
        </header>

        {/* Connections */}
        <div className="space-y-4">
          {/* Google Calendar Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 text-blue-500" fill="currentColor">
                      <path d="M19.5 22h-15A2.5 2.5 0 0 1 2 19.5v-15A2.5 2.5 0 0 1 4.5 2h15A2.5 2.5 0 0 1 22 4.5v15a2.5 2.5 0 0 1-2.5 2.5zM9.047 6.5v.469c-.703 0-1.266.562-1.266 1.265v1.266c0 .703.563 1.266 1.266 1.266h.469v4.968h-.469c-.703 0-1.266.563-1.266 1.266v1.266c0 .703.563 1.265 1.266 1.265V20h5.906v-.469c.703 0 1.266-.562 1.266-1.265V17c0-.703-.563-1.266-1.266-1.266h-.469V10.766h.469c.703 0 1.266-.563 1.266-1.266V8.234c0-.703-.563-1.265-1.266-1.265V6.5H9.047z"/>
                    </svg>
                  </div>
                  <div>
                    <CardTitle className="text-base">Google Calendar</CardTitle>
                    <CardDescription>
                      {calendarStatus?.connected ? (
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                          Connected as {calendarStatus.googleEmail}
                        </span>
                      ) : (
                        'View your calendar events in the timeline'
                      )}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {calendarStatus?.connected ? (
                <div className="space-y-3">
                  {isGoogleOAuthUser && calendarStatus.source === 'google_oauth' ? (
                    <p className="text-sm text-muted-foreground">
                      Calendar is connected through your Google sign-in.
                    </p>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={handleDisconnect}
                      disabled={isDisconnecting}
                      className="text-destructive hover:text-destructive"
                    >
                      {isDisconnecting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Disconnecting...
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4" />
                          Disconnect
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <Button onClick={handleConnect} disabled={isConnecting}>
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Calendar className="h-4 w-4" />
                      Connect Google Calendar
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Coming Soon - Other Calendars */}
          <Card className="opacity-60">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Apple Calendar</CardTitle>
                    <CardDescription>Coming soon</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="opacity-60">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Outlook Calendar</CardTitle>
                    <CardDescription>Coming soon</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Conflict Modal */}
      <Dialog open={!!conflictModal} onOpenChange={(open) => !open && !isMerging && handleCancelConflict()}>
        <DialogContent showCloseButton={false} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Looks like you&apos;re already signed up!</DialogTitle>
            <DialogDescription className="text-center">
              {conflictModal?.email} is already registered. Would you like to sign in with Google instead?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-4">
            <Button
              className="w-full"
              onClick={handleMergeAndSignIn}
              disabled={isMerging}
            >
              {isMerging ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Sign in with Google'
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleCancelConflict}
              disabled={isMerging}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

export default function ConnectionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ConnectionsContent />
    </Suspense>
  )
}
