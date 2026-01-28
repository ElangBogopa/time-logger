'use client'

import React from 'react'
import { TimePeriod } from '@/lib/types'

interface GreetingHeaderProps {
  greeting: { text: string; emoji: string }
  currentPeriod: TimePeriod
}

export default function GreetingHeader({ greeting, currentPeriod }: GreetingHeaderProps) {
  return (
    <header className="mb-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl" role="img" aria-label={currentPeriod}>
          {greeting.emoji}
        </span>
        <h1 className="text-xl font-bold text-foreground">{greeting.text}</h1>
      </div>
    </header>
  )
}