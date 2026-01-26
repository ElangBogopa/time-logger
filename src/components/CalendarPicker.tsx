'use client'

import { useState, useMemo } from 'react'
import { getUserToday, getLocalDateString } from '@/lib/types'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CalendarPickerProps {
  selectedDate: string
  onDateSelect: (date: string) => void
  datesWithEntries?: string[]
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

export default function CalendarPicker({ selectedDate, onDateSelect, datesWithEntries = [] }: CalendarPickerProps) {
  const today = getUserToday()

  // Parse selected date to get initial month/year
  const [viewDate, setViewDate] = useState(() => {
    const [year, month] = selectedDate.split('-').map(Number)
    return { year, month: month - 1 } // month is 0-indexed
  })

  // Sync view when selectedDate changes externally (render-time pattern)
  const [prevSelectedDate, setPrevSelectedDate] = useState(selectedDate)
  if (selectedDate !== prevSelectedDate) {
    setPrevSelectedDate(selectedDate)
    const [year, month] = selectedDate.split('-').map(Number)
    setViewDate({ year, month: month - 1 })
  }

  const { year, month } = viewDate

  const monthName = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const daysInMonth = getDaysInMonth(year, month)
  const firstDayOfMonth = getFirstDayOfMonth(year, month)

  // Create set for quick lookup of dates with entries
  const entryDatesSet = useMemo(() => new Set(datesWithEntries), [datesWithEntries])

  const days = useMemo(() => {
    const result: (number | null)[] = []

    // Add empty slots for days before the 1st
    for (let i = 0; i < firstDayOfMonth; i++) {
      result.push(null)
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      result.push(day)
    }

    return result
  }, [daysInMonth, firstDayOfMonth])

  const goToPrevMonth = () => {
    setViewDate(prev => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 }
      }
      return { ...prev, month: prev.month - 1 }
    })
  }

  const goToNextMonth = () => {
    setViewDate(prev => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 }
      }
      return { ...prev, month: prev.month + 1 }
    })
  }

  const formatDateString = (day: number): string => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const isToday = (day: number): boolean => {
    return formatDateString(day) === today
  }

  const isSelected = (day: number): boolean => {
    return formatDateString(day) === selectedDate
  }

  const hasEntries = (day: number): boolean => {
    return entryDatesSet.has(formatDateString(day))
  }

  const isFuture = (day: number): boolean => {
    return formatDateString(day) > today
  }

  return (
    <div className="w-64 p-3">
      {/* Month Navigation */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={goToPrevMonth}
          className="rounded p-1 hover:bg-accent"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">{monthName}</span>
        <button
          type="button"
          onClick={goToNextMonth}
          className="rounded p-1 hover:bg-accent"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="mb-1 grid grid-cols-7 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
          <div key={day} className="py-1 text-xs font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="h-8" />
          }

          const dateStr = formatDateString(day)
          const dayIsToday = isToday(day)
          const dayIsSelected = isSelected(day)
          const dayHasEntries = hasEntries(day)
          const dayIsFuture = isFuture(day)

          return (
            <button
              key={day}
              type="button"
              onClick={() => onDateSelect(dateStr)}
              className={`
                relative flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors
                ${dayIsSelected
                  ? 'bg-primary text-primary-foreground'
                  : dayIsToday
                    ? 'bg-accent font-semibold text-accent-foreground'
                    : dayIsFuture
                      ? 'text-muted-foreground hover:bg-accent'
                      : 'hover:bg-accent'
                }
              `}
            >
              {day}
              {/* Dot indicator for dates with entries */}
              {dayHasEntries && !dayIsSelected && (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </button>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="mt-3 flex gap-2 border-t pt-3">
        <button
          type="button"
          onClick={() => onDateSelect(today)}
          className="flex-1 rounded-md bg-accent px-2 py-1.5 text-xs font-medium hover:bg-accent/80"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => {
            // Tomorrow relative to user's today (accounts for late-night rollover)
            const userToday = getUserToday()
            const tomorrowDate = new Date(userToday + 'T12:00:00')
            tomorrowDate.setDate(tomorrowDate.getDate() + 1)
            onDateSelect(getLocalDateString(tomorrowDate))
          }}
          className="flex-1 rounded-md bg-accent px-2 py-1.5 text-xs font-medium hover:bg-accent/80"
        >
          Tomorrow
        </button>
      </div>
    </div>
  )
}
