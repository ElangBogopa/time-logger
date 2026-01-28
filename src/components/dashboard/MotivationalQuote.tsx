'use client'

import React from 'react'
import { TimePeriod } from '@/lib/types'

interface MotivationalQuoteProps {
  quote: string
  currentPeriod: TimePeriod
}

export default function MotivationalQuote({ quote, currentPeriod }: MotivationalQuoteProps) {
  if (!quote) return null

  return (
    <div className="mb-3 rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-800/50 dark:to-zinc-900/50 px-3.5 py-3 border border-zinc-200/50 dark:border-zinc-700/50">
      <p className="text-[13px] text-muted-foreground italic leading-relaxed">
        &ldquo;{quote.split(' — ')[0]}&rdquo;
      </p>
      {quote.includes(' — ') && (
        <p className="text-[11px] text-muted-foreground/70 mt-1.5">
          — {quote.split(' — ')[1]}
        </p>
      )}
    </div>
  )
}