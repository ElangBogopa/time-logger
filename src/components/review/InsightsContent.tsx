'use client'

import { useRouter } from 'next/navigation'
import { Grid3X3, ArrowRight } from 'lucide-react'
import CorrelationInsights from '@/components/insights/CorrelationInsights'

export default function InsightsContent() {
  const router = useRouter()

  return (
    <div>
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
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Insights */}
      <CorrelationInsights showSections={true} />
    </div>
  )
}
