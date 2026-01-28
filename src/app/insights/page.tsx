'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Lightbulb, Grid3X3 } from 'lucide-react'
import CorrelationInsights from '@/components/insights/CorrelationInsights'

export default function InsightsPage() {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground mb-4 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
              <Lightbulb className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Insights</h1>
              <p className="text-sm text-muted-foreground">
                How your activities affect your mood
              </p>
            </div>
          </div>
        </header>

        {/* Year in Pixels Link */}
        <button
          onClick={() => router.push('/pixels')}
          className="mb-6 w-full rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors text-left"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
            <Grid3X3 className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Year in Pixels</p>
            <p className="text-sm text-muted-foreground">See your entire year at a glance</p>
          </div>
          <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180" />
        </button>

        {/* Insights */}
        <CorrelationInsights showSections={true} />
      </div>
    </div>
  )
}
