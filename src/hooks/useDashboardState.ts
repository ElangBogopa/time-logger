'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Session } from 'next-auth'
import { getUserCurrentHour } from '@/lib/types'

interface UseDashboardStateReturn {
  showOnboarding: boolean
  setShowOnboarding: (show: boolean) => void
  currentHour: number | null
  hasCheckedTargets: boolean
}

interface UseDashboardStateProps {
  session: Session | null
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

  // Check if user needs onboarding (no productivity target or goals set)
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id || hasCheckedTargets) {
      return
    }

    const controller = new AbortController()

    async function checkOnboardingNeeded() {
      try {
        // Check preferences for productivity_target and goals in parallel
        const [prefsResponse, goalsResponse] = await Promise.all([
          fetch('/api/preferences', { signal: controller.signal }),
          fetch('/api/goals', { signal: controller.signal }),
        ])

        if (prefsResponse.ok && goalsResponse.ok) {
          const prefsData = await prefsResponse.json()
          const goalsData = await goalsResponse.json()

          const hasProductivityTarget = prefsData.preferences?.productivity_target != null
          const hasGoals = goalsData.goals && goalsData.goals.length > 0

          if (!hasProductivityTarget && !hasGoals) {
            setShowOnboarding(true)
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