'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { AppSession } from '@/lib/session'
import { getUserCurrentHour } from '@/lib/types'
import { fetchGoals } from '@/lib/goals'

interface UseDashboardStateReturn {
  showOnboarding: boolean
  setShowOnboarding: (show: boolean) => void
  currentHour: number | null
  hasCheckedTargets: boolean
}

interface UseDashboardStateProps {
  session: AppSession | null
  status: string
}

export function useDashboardState({ session, status }: UseDashboardStateProps): UseDashboardStateReturn {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [hasCheckedTargets, setHasCheckedTargets] = useState(false)
  // Compute eagerly — avoids extra render cycle on client
  const [currentHour, setCurrentHour] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null // SSR safety
    return getUserCurrentHour()
  })
  
  const router = useRouter()
  const searchParams = useSearchParams()

  // Handle calendar connection URL params - redirect to connections page
  useEffect(() => {
    const hasCalendarParams = searchParams.has('calendar_connected') ||
      searchParams.has('conflict_email') ||
      searchParams.has('pending_id') ||
      (searchParams.get('error')?.startsWith('calendar_'))

    if (hasCalendarParams) {
      const params = new URLSearchParams()
      searchParams.forEach((value, key) => {
        if (key === 'calendar_connected') {
          params.set('success', 'true')
        } else {
          params.set(key, value)
        }
      })
      router.replace(`/settings/connections?${params.toString()}`)
    }
  }, [searchParams, router])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // Check if user needs onboarding (no set-up flag, and no saved goal from before the flag)
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id || hasCheckedTargets) {
      return
    }

    const controller = new AbortController()

    async function checkOnboardingNeeded() {
      try {
        // `productivity_target` is the flag that marks an account as set up.
        const prefsResponse = await fetch('/api/preferences', { signal: controller.signal })

        if (prefsResponse.ok) {
          const prefsData = await prefsResponse.json()

          if (prefsData.preferences?.productivity_target == null) {
            // No flag. A saved goal still means set up: the lookup exists
            // only for accounts set up before the flag was written, because
            // goals are no longer shown or created. If it throws, the catch
            // below runs and setup is not shown: a failed lookup must never
            // put a set-up account back through setup.
            const goals = await fetchGoals()
            if (goals.length === 0) {
              setShowOnboarding(true)
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        console.error('Failed to check onboarding status:', error)
      } finally {
        if (!controller.signal.aborted) {
          setHasCheckedTargets(true)
        }
      }
    }

    checkOnboardingNeeded()
    return () => controller.abort()
  }, [status, session?.user?.id, hasCheckedTargets])

  return {
    showOnboarding,
    setShowOnboarding,
    currentHour,
    hasCheckedTargets,
  }
}