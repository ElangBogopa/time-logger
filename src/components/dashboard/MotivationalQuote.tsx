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
    <div className="mb-3 rounded-xl bg-secondary/60 px-3.5 py-3 border border-border">
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