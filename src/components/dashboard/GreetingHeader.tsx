'use client'

import React from 'react'
import { TimePeriod } from '@/lib/types'

interface GreetingHeaderProps {
  greeting: { text: string; emoji: string }
  currentPeriod: TimePeriod
}

function formatDateHeader(): string {
  const now = new Date()
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
  return `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`
}

export default function GreetingHeader({ greeting, currentPeriod }: GreetingHeaderProps) {
  return (
    <header className="mb-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {formatDateHeader()}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-2xl" role="img" aria-label={currentPeriod}>
          {greeting.emoji}
        </span>
        <h1 className="text-xl font-bold text-foreground">{greeting.text}</h1>
      </div>
    </header>
  )
}