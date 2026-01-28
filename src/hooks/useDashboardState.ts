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
  // Hydration-safe: initialize to null, set on client
  const [currentHour, setCurrentHour] = useState<number | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()

  // Set current hour on client to avoid hydration mismatch
  // Uses getUserCurrentHour which returns 24+ for late night (before 3am)
  useEffect(() => {
    setCurrentHour(getUserCurrentHour())
  }, [])

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

  // Check if user needs onboarding (no weekly targets set)
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id || hasCheckedTargets) {
      return
    }

    const controller = new AbortController()

    async function checkTargets() {
      try {
        const response = await fetch('/api/targets', {
          signal: controller.signal,
        })
        if (response.ok) {
          const data = await response.json()
          if (!data.targets || data.targets.length === 0) {
            setShowOnboarding(true)
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        console.error('Failed to check targets:', error)
      } finally {
        if (!controller.signal.aborted) {
          setHasCheckedTargets(true)
        }
      }
    }

    checkTargets()
    return () => controller.abort()
  }, [status, session?.user?.id, hasCheckedTargets])

  return {
    showOnboarding,
    setShowOnboarding,
    currentHour,
    hasCheckedTargets,
  }
}