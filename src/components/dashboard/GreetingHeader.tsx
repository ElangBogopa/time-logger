'use client'

import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { TimePeriod } from '@/lib/types'

interface GreetingHeaderProps {
  greeting: { text: string; emoji: string }
  currentPeriod: TimePeriod
  selectedDate: string        // YYYY-MM-DD
  onDateChange: (date: string) => void
  isToday: boolean
}

function formatDateNav(dateStr: string, isToday: boolean): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const label = `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`
  return isToday ? `TODAY — ${label}` : label
}

function shiftDate(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + delta)
  return date.toISOString().split('T')[0]
}

export default function GreetingHeader({
  greeting,
  currentPeriod,
  selectedDate,
  onDateChange,
  isToday,
}: GreetingHeaderProps) {
  return (
    <header className="mb-3">
      {/* Date navigation bar */}
      <div className="flex items-center justify-center gap-3 mb-2">
        <button
          onClick={() => onDateChange(shiftDate(selectedDate, -1))}
          className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Previous day"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[140px] text-center">
          {formatDateNav(selectedDate, isToday)}
        </span>
        <button
          onClick={() => !isToday && onDateChange(shiftDate(selectedDate, 1))}
          className={`p-1 rounded-full transition-colors ${
            isToday
              ? 'text-muted-foreground/30 cursor-default'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
          aria-label="Next day"
          disabled={isToday}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Greeting — only show for today */}
      {isToday && (
        <div className="flex items-center gap-2">
          <span className="text-2xl" role="img" aria-label={currentPeriod}>
            {greeting.emoji}
          </span>
          <h1 className="text-xl font-bold text-foreground">{greeting.text}</h1>
        </div>
      )}
    </header>
  )
}
