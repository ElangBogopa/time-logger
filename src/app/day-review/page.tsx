'use client'

import { Suspense } from 'react'
import DayReviewContent from '@/components/review/DayReviewContent'

/**
 * /day-review — the dashboard links here with ?date=. The screen itself lives
 * in DayReviewContent, which the review tab renders too, so there is one
 * implementation behind both routes.
 */
export default function DayReviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    }>
      <DayReviewContent />
    </Suspense>
  )
}
