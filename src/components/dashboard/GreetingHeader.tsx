'use client'

import React from 'react'
import { ChevronLeft, ChevronRight, Sun, Cloud, Moon } from 'lucide-react'
import { TimePeriod, shiftDateString } from '@/lib/types'

interface GreetingHeaderProps {
  greeting: { text: string }
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

export default function GreetingHeader({
  greeting,
  currentPeriod,
  selectedDate,
  onDateChange,
  isToday,
}: GreetingHeaderProps) {
  const PeriodIcon = currentPeriod === 'morning' ? Sun : currentPeriod === 'afternoon' ? Cloud : Moon

  return (
    <header className="mb-3">
      {/* Greeting — visible for today, invisible placeholder on other dates to keep layout stable */}
      <div className={`flex items-center gap-2 mb-2 ${isToday ? '' : 'invisible'}`}>
        {/* The emoji this replaces was the one piece of product copy that
            did not match the restrained tone of everything around it, and it
            sat next to the same three icons drawn as line art further down
            the page. */}
        <PeriodIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="page-title text-foreground">{greeting.text}</h1>
      </div>

      {/* Date navigation bar */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => onDateChange(shiftDateString(selectedDate, -1))}
          className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Previous day"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="eyebrow opacity-60 min-w-[140px] text-center">
          {formatDateNav(selectedDate, isToday)}
        </span>
        <button
          onClick={() => !isToday && onDateChange(shiftDateString(selectedDate, 1))}
          className={`p-1 rounded-full transition-colors ${
            isToday
              ? 'text-muted-foreground cursor-default'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
          aria-label="Next day"
          disabled={isToday}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
