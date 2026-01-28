'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lightbulb, Sun, BarChart3 } from 'lucide-react'
import dynamic from 'next/dynamic'

const InsightsContent = dynamic(() => import('@/components/review/InsightsContent'), {
  loading: () => <TabSkeleton />,
})
const DayReviewContent = dynamic(() => import('@/components/review/DayReviewContent'), {
  loading: () => <TabSkeleton />,
})
const WeeklyReviewContent = dynamic(() => import('@/components/review/WeeklyReviewContent'), {
  loading: () => <TabSkeleton />,
})

function TabSkeleton() {
  return (
    <div className="space-y-4 py-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      <div className="h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      <div className="h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
    </div>
  )
}

type ReviewTab = 'insights' | 'day' | 'weekly'

const tabs: { id: ReviewTab; label: string; icon: React.ElementType }[] = [
  { id: 'insights', label: 'Insights', icon: Lightbulb },
  { id: 'day', label: 'Today', icon: Sun },
  { id: 'weekly', label: 'Weekly', icon: BarChart3 },
]

export default function ReviewPage() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<ReviewTab>(
    (searchParams.get('tab') as ReviewTab) || 'insights'
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
          <h1 className="text-2xl font-bold text-foreground">Review</h1>
          <p className="text-sm text-muted-foreground">
            Your progress, insights, and reflections
          </p>
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

        {/* Tab Content */}
        {activeTab === 'insights' && <InsightsContent />}
        {activeTab === 'day' && <DayReviewContent />}
        {activeTab === 'weekly' && <WeeklyReviewContent />}
      </div>
    </div>
  )
}
