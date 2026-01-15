'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { getLocalDateString } from '@/lib/types'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface WeekStripProps {
  selectedDate: string
  onDateSelect: (date: string) => void
  datesWithEntries?: string[]
}

function getWeekDates(centerDate: string): string[] {
  const [year, month, day] = centerDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const dayOfWeek = date.getDay() // 0 = Sunday

  // Get Sunday of the current week
  const sunday = new Date(date)
  sunday.setDate(date.getDate() - dayOfWeek)

  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday)
    d.setDate(sunday.getDate() + i)
    days.push(formatDate(d))
  }
  return days
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDayName(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1)
}

function getDayNumber(dateStr: string): number {
  return parseInt(dateStr.split('-')[2], 10)
}

function getMonthYear(dateStr: string): string {
  const [year, month] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default function WeekStrip({ selectedDate, onDateSelect, datesWithEntries = [] }: WeekStripProps) {
  const today = getLocalDateString()
  const [weekStart, setWeekStart] = useState(selectedDate)
  const touchStartX = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Update week when selectedDate changes externally
  useEffect(() => {
    setWeekStart(selectedDate)
  }, [selectedDate])

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])
  const entryDatesSet = useMemo(() => new Set(datesWithEntries), [datesWithEntries])

  const goToPrevWeek = () => {
    const [year, month, day] = weekStart.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    date.setDate(date.getDate() - 7)
    const newDate = formatDate(date)
    setWeekStart(newDate)
    onDateSelect(newDate)
  }

  const goToNextWeek = () => {
    const [year, month, day] = weekStart.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    date.setDate(date.getDate() + 7)
    const newDate = formatDate(date)
    setWeekStart(newDate)
    onDateSelect(newDate)
  }

  const goToToday = () => {
    setWeekStart(today)
    onDateSelect(today)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return

    const touchEndX = e.changedTouches[0].clientX
    const diff = touchStartX.current - touchEndX

    // Require at least 50px swipe
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        goToNextWeek()
      } else {
        goToPrevWeek()
      }
    }

    touchStartX.current = null
  }

  const isToday = (dateStr: string): boolean => dateStr === today
  const isSelected = (dateStr: string): boolean => dateStr === selectedDate
  const hasEntries = (dateStr: string): boolean => entryDatesSet.has(dateStr)
  const isFuture = (dateStr: string): boolean => dateStr > today
  const isCurrentWeek = weekDates.includes(today)

  return (
    <div className="w-full">
      {/* Month/Year header with Today button */}
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-medium text-muted-foreground">
          {getMonthYear(weekDates[0])}
        </span>
        {!isCurrentWeek && (
          <button
            type="button"
            onClick={goToToday}
            className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Today
          </button>
        )}
      </div>

      {/* Week strip */}
      <div
        ref={containerRef}
        className="flex items-center gap-1"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Previous week button */}
        <button
          type="button"
          onClick={goToPrevWeek}
          className="flex h-10 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Days */}
        <div className="flex flex-1 justify-between">
          {weekDates.map((dateStr) => {
            const dayIsToday = isToday(dateStr)
            const dayIsSelected = isSelected(dateStr)
            const dayHasEntries = hasEntries(dateStr)
            const dayIsFuture = isFuture(dateStr)

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => onDateSelect(dateStr)}
                className={`
                  relative flex h-14 w-10 flex-col items-center justify-center rounded-xl transition-all
                  ${dayIsSelected
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : dayIsToday
                      ? 'bg-accent/70 font-semibold'
                      : dayIsFuture
                        ? 'text-muted-foreground hover:bg-accent/50'
                        : 'hover:bg-accent/50'
                  }
                `}
              >
                <span className={`text-[10px] uppercase ${dayIsSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  {getDayName(dateStr)}
                </span>
                <span className={`text-base font-medium ${dayIsSelected ? '' : ''}`}>
                  {getDayNumber(dateStr)}
                </span>
                {/* Entry indicator dot */}
                {dayHasEntries && !dayIsSelected && (
                  <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-primary" />
                )}
                {/* Today ring indicator when not selected */}
                {dayIsToday && !dayIsSelected && (
                  <span className="absolute inset-0 rounded-xl ring-2 ring-primary/50" />
                )}
              </button>
            )
          })}
        </div>

        {/* Next week button */}
        <button
          type="button"
          onClick={goToNextWeek}
          className="flex h-10 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
