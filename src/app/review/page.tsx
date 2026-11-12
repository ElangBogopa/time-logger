'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Sun, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
import { getUserToday, getUserCurrentHour, shiftDateString } from '@/lib/types'
import dynamic from 'next/dynamic'

const DayReviewContent = dynamic(() => import('@/components/review/DayReviewContent'), {
  loading: () => <TabSkeleton />,
})
const WeeklyReviewContent = dynamic(() => import('@/components/review/WeeklyReviewContent'), {
  loading: () => <TabSkeleton />,
})

function TabSkeleton() {
  return (
    <div className="space-y-4 py-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-secondary" />
      <div className="h-32 animate-pulse rounded-xl bg-secondary" />
      <div className="h-32 animate-pulse rounded-xl bg-secondary" />
    </div>
  )
}

type ReviewTab = 'day' | 'weekly'

function dayLabel(date: string, today: string): string {
  const formatted = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  if (date === today) return `Today · ${formatted}`
  if (date === shiftDateString(today, -1)) return `Yesterday · ${formatted}`
  return formatted
}

const tabs: { id: ReviewTab; label: string; icon: React.ElementType }[] = [
  { id: 'day', label: 'Day', icon: Sun },
  { id: 'weekly', label: 'Weekly', icon: BarChart3 },
]

function ReviewContent() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<ReviewTab>(
    (searchParams.get('tab') as ReviewTab) || 'day'
  )

  /**
   * The day under review. Today's review opens at 9pm, so until then the
   * tab shows the last day that is finished: yesterday. It used to show
   * today regardless — a padlock for twenty-one hours of every day — with
   * no way to any other day from here.
   */
  const today = getUserToday()
  const [reviewDate, setReviewDate] = useState(() =>
    getUserCurrentHour() >= 21 ? today : shiftDateString(today, -1)
  )

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const handleTabChange = (tab: ReviewTab) => {
    setActiveTab(tab)
    // Update URL without navigation
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tab)
    window.history.replaceState({}, '', url.toString())
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (status === 'unauthenticated') return null

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Header */}
        <header className="mb-4">
          <h1 className="page-title text-foreground">Review</h1>
        </header>

        {/* Tab Bar */}
        <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800 mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium transition-all
                  ${isActive
                    ? 'bg-white text-foreground shadow-sm dark:bg-zinc-700'
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab Content — conditionally render (caching handles fast re-mounts) */}
        {activeTab === 'day' && (
          <>
            <div className="mb-5 flex items-center justify-between rounded-xl bg-secondary p-1.5">
              <button
                onClick={() => setReviewDate(shiftDateString(reviewDate, -1))}
                aria-label="Previous day"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-accent transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <p className="text-sm font-medium" aria-live="polite">
                {dayLabel(reviewDate, today)}
              </p>
              <button
                onClick={() => setReviewDate(shiftDateString(reviewDate, 1))}
                disabled={reviewDate >= today}
                aria-label="Next day"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-accent transition-colors disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            {/* Keyed by day: each review starts from its own cache, not the last day's state. */}
            <DayReviewContent key={reviewDate} embedded date={reviewDate} />
          </>
        )}
        {activeTab === 'weekly' && <WeeklyReviewContent />}
      </div>
    </div>
  )
}

export default function ReviewPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    }>
      <ReviewContent />
    </Suspense>
  )
}
