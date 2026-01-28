'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CorrelationsResponse } from '@/lib/correlation-types'
import CorrelationInsights from './CorrelationInsights'

interface InsightsTeaserProps {
  className?: string
}

export default function InsightsTeaser({ className }: InsightsTeaserProps) {
  const router = useRouter()
  const [data, setData] = useState<CorrelationsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchInsights = useCallback(async () => {
    try {
      const response = await fetch('/api/correlations')
      if (!response.ok) return
      const result: CorrelationsResponse = await response.json()
      setData(result)
    } catch {
      // Silently fail — this is a teaser, not critical
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  // Don't show if loading, no data, or no insights
  if (isLoading || !data) return null
  if (!data.hasEnoughData || data.insights.length === 0) return null

  return (
    <div className={className}>
      {/* Section header with link */}
      <button
        onClick={() => router.push('/insights')}
        className="w-full flex items-center justify-between mb-3 group"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-foreground">Mood Insights</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
          <span>See all</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </button>

      {/* Top 2 insights */}
      <CorrelationInsights limit={2} showSections={false} />
    </div>
  )
}
